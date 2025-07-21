import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage, PluginStatus } from '@lib/shared/common';
import { IPlugin } from '@lib/shared/plugin-types';

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
  createdAt: Date;
  lastActivity?: Date;
  health: 'healthy' | 'unhealthy' | 'unknown';
}

@Injectable()
export class PluginInstanceService {
  private readonly logger = new Logger(PluginInstanceService.name);
  private readonly instances = new Map<string, PluginInstance>();

  async createInstance(
    pluginModule: PluginModule,
    name: string,
    version: string,
  ): Promise<string> {
    const id = this.generateInstanceId(name, version);

    try {
      const instance: IPlugin = new pluginModule.default();

      const pluginInstance: PluginInstance = {
        id,
        name,
        version,
        status: PluginStatus.STARTING,
        instance,
        createdAt: new Date(),
        health: 'unknown',
      };

      this.instances.set(id, pluginInstance);

      await this.initializePlugin(pluginInstance);

      this.logger.log(`Created plugin instance: ${id}`);
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
    if (!instance) {
      throw new Error(`Plugin instance not found: ${instanceId}`);
    }

    try {
      instance.status = PluginStatus.STOPPING;

      if (instance.instance.onDestroy) {
        await instance.instance.onDestroy();
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
    if (!instance) return;

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

  private generateInstanceId(name: string, version: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${name}-${version}-${timestamp}-${random}`;
  }
}
