import { getErrorMessage, PluginStatus } from '@lib/shared/common';
import type { IPlugin } from '@lib/shared/plugin-types';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { type PluginExecutionContext, PluginSandboxService } from './plugin-sandbox.service';

export interface PluginModuleConstructor {
  new (): IPlugin;
}

export interface PluginModule {
  default: PluginModuleConstructor;
}

export interface PluginInstance {
  id: string;
  name: string;
  version: string;
  status: PluginStatus;
  instance: IPlugin;
  sandboxId?: string;
  pluginPath?: string;
  createdAt: Date;
  lastActivity?: Date;
  health: 'healthy' | 'unhealthy' | 'unknown';
  memoryUsage?: number;
  cleanupHandlers: (() => Promise<void>)[];
}

@Injectable()
export class PluginInstanceService implements OnModuleDestroy {
  private readonly logger = new Logger(PluginInstanceService.name);
  private readonly instances = new Map<string, PluginInstance>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(private readonly sandboxService: PluginSandboxService) {
    // Start cleanup interval
    this.cleanupInterval = setInterval(
        () => { void this.performCleanup(); },
      5 * 60 * 1000, // Every 5 minutes
    );
  }

  async createInstance(
    pluginModule: PluginModule,
    name: string,
    version: string,
    pluginPath?: string,
  ): Promise<string> {
    const id = this.generateInstanceId(name, version);

    try {
      const instance: IPlugin = new pluginModule.default();

      // Create sandbox for plugin isolation
      const sandboxId = await this.sandboxService.createSandbox(id, {
        maxMemory: 128, // 128MB limit
        allowNetworkAccess: false,
        allowFileSystemAccess: false,
        allowedPermissions: ['read:data', 'write:data'],
        timeoutMs: 30000,
      });

      const pluginInstance: PluginInstance = {
        id,
        name,
        version,
        status: PluginStatus.STARTING,
        instance,
        sandboxId,
        pluginPath: pluginPath ?? '',
        createdAt: new Date(),
        health: 'unknown',
        cleanupHandlers: [],
      };

      this.instances.set(id, pluginInstance);

      await this.initializePlugin(pluginInstance);

      this.logger.log(`Created plugin instance: ${id} with sandbox: ${sandboxId}`);
      return id;
    } catch (error) {
      this.logger.error(
        `Failed to create plugin instance ${id}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async destroyInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance == null) {
      throw new Error(`Plugin instance not found: ${instanceId}`);
    }

    try {
      instance.status = PluginStatus.STOPPING;

      // Run cleanup handlers first
      await this.runCleanupHandlers(instance);

      // Call plugin's onDestroy if available
      if (instance.instance.onDestroy) {
        await instance.instance.onDestroy();
      }

      // Destroy sandbox
      if (instance.sandboxId != null) {
        await this.sandboxService.destroySandbox(instance.sandboxId);
      }

      this.instances.delete(instanceId);
      this.logger.log(`Destroyed plugin instance: ${instanceId}`);
    } catch (error) {
      this.logger.error(
        `Failed to destroy plugin instance ${instanceId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  getInstance(instanceId: string): PluginInstance | undefined {
    return this.instances.get(instanceId);
  }

  getAllInstances(): PluginInstance[] {
    return Array.from(this.instances.values());
  }

  getInstancesByName(name: string): PluginInstance[] {
    return Array.from(this.instances.values()).filter(
      (instance) => instance.name === name,
    );
  }

  async updateInstanceHealth(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance == null) return;

    try {
      if (instance.instance.healthCheck) {
        const isHealthy = await instance.instance.healthCheck();
        instance.health = isHealthy ? 'healthy' : 'unhealthy';
      } else {
        instance.health = 'unknown';
      }
      instance.lastActivity = new Date();
    } catch (error) {
      instance.health = 'unhealthy';
      this.logger.warn(
        `Health check failed for ${instanceId}: ${getErrorMessage(error)}`,
      );
    }
  }

  private async initializePlugin(
    pluginInstance: PluginInstance,
  ): Promise<void> {
    try {
      pluginInstance.status = PluginStatus.INITIALIZING;

      if (pluginInstance.instance.onInit) {
        await pluginInstance.instance.onInit();
      }

      pluginInstance.status = PluginStatus.RUNNING;
      pluginInstance.health = 'healthy';
      pluginInstance.lastActivity = new Date();
    } catch (error) {
      pluginInstance.status = PluginStatus.ERROR;
      pluginInstance.health = 'unhealthy';
      throw error;
    }
  }

  async executePluginMethod(
    instanceId: string,
    method: string,
    data?: unknown,
    permissions: string[] = [],
  ): Promise<unknown> {
    const instance = this.instances.get(instanceId);
    if ((instance?.sandboxId) == null) {
      throw new Error(`Plugin instance not found or no sandbox: ${instanceId}`);
    }

    const context: PluginExecutionContext = {
      pluginPath: instance.pluginPath ?? '',
      config: {},
      requestData: data,
      method,
      permissions,
    };

    const result = await this.sandboxService.executePlugin(
      instance.sandboxId,
      context,
    );

    // Update instance stats
    instance.lastActivity = new Date();
    if (result.memoryUsed) {
      instance.memoryUsage = result.memoryUsed;
    }

    return result;
  }

  addCleanupHandler(instanceId: string, handler: () => Promise<void>): void {
    const instance = this.instances.get(instanceId);
    if (instance != null) {
      instance.cleanupHandlers.push(handler);
    }
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.cleanupInterval);
    
    // Destroy all instances
    const instances = Array.from(this.instances.keys());
    await Promise.all(
      instances.map(instanceId => this.destroyInstance(instanceId)),
    );
  }

  private async runCleanupHandlers(instance: PluginInstance): Promise<void> {
    const handlerPromises = instance.cleanupHandlers.map(async (handler) => {
      try {
        await handler();
      } catch (error) {
        this.logger.warn(
          `Cleanup handler failed for ${instance.id}: ${getErrorMessage(error)}`,
        );
      }
    });
    
    await Promise.allSettled(handlerPromises);
    instance.cleanupHandlers.length = 0; // Clear array
  }

  private async performCleanup(): Promise<void> {
    try {
      // Check for stale instances
      const staleThreshold = 60 * 60 * 1000; // 1 hour
      const now = Date.now();

      const staleInstances = Array.from(this.instances.entries())
        .filter(([_, instance]) => {
          const lastActivity = instance.lastActivity?.getTime() ?? instance.createdAt.getTime();
          return now - lastActivity > staleThreshold;
        })
        .map(([instanceId]) => instanceId);

      if (staleInstances.length > 0) {
        this.logger.log(`Cleaning up ${staleInstances.length} stale instances`);
        await Promise.allSettled(
          staleInstances.map(instanceId => this.destroyInstance(instanceId))
        );
      }

      // Clean up sandbox service
      await this.sandboxService.cleanupInactiveSandboxes();
    } catch (error) {
      this.logger.error(`Cleanup failed: ${getErrorMessage(error)}`);
    }
  }

  private generateInstanceId(name: string, version: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${name}-${version}-${timestamp}-${random}`;
  }
}
