import { getErrorMessage } from '@lib/shared/common';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { resolve } from 'path';
import { MessageChannel, MessagePort, Worker } from 'worker_threads';

export interface SandboxConfig {
  maxMemory: number; // in MB
  maxCpuTime: number; // in seconds
  allowNetworkAccess: boolean;
  allowFileSystemAccess: boolean;
  allowedPermissions: string[];
  timeoutMs: number;
}

export interface PluginExecutionContext {
  pluginPath: string;
  config: Record<string, unknown>;
  requestData?: unknown;
  method?: string;
  permissions: string[];
}

export interface SandboxInstance {
  id: string;
  worker: Worker;
  port: MessagePort;
  eventEmitter: EventEmitter;
  createdAt: Date;
  lastActivity: Date;
  memoryUsage: number;
  cpuUsage: number;
  isActive: boolean;
}

export interface PluginExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime: number;
  memoryUsed: number;
}

interface SandboxMessage {
  type: 'stats' | 'log' | 'error' | 'result';
  data: unknown;
}

interface StatsMessage extends SandboxMessage {
  type: 'stats';
  data: {
    memoryUsage: number;
    cpuUsage: number;
  };
}

interface LogMessage extends SandboxMessage {
  type: 'log';
  data: {
    message: string;
  };
}

interface ErrorMessage extends SandboxMessage {
  type: 'error';
  data: {
    error: string;
  };
}

interface ResultMessage extends SandboxMessage {
  type: 'result';
  data: unknown;
}

type SandboxMessageTypes = StatsMessage | LogMessage | ErrorMessage | ResultMessage;

@Injectable()
export class PluginSandboxService {
  private readonly logger = new Logger(PluginSandboxService.name);
  private readonly sandboxes = new Map<string, SandboxInstance>();
  private readonly workerScript = resolve(__dirname, 'plugin-worker.js');

  private readonly defaultConfig: SandboxConfig = {
    maxMemory: 128, // 128MB
    maxCpuTime: 30, // 30 seconds
    allowNetworkAccess: false,
    allowFileSystemAccess: false,
    allowedPermissions: [],
    timeoutMs: 30000, // 30 seconds
  };

  createSandbox(
    pluginId: string,
    config: Partial<SandboxConfig> = {},
  ): Promise<string> {
    try {
      const sandboxConfig = { ...this.defaultConfig, ...config };
      const sandboxId = this.generateSandboxId(pluginId);

      // Create message channel for secure communication
      const { port1, port2 } = new MessageChannel();

      // Create worker with resource limits
      const worker = new Worker(this.workerScript, {
        transferList: [port2],
        workerData: {
          port: port2,
          config: sandboxConfig,
          sandboxId,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: sandboxConfig.maxMemory,
          maxYoungGenerationSizeMb: Math.floor(sandboxConfig.maxMemory * 0.3),
          codeRangeSizeMb: 16,
        },
      });

      const eventEmitter = new EventEmitter();
      
      const sandbox: SandboxInstance = {
        id: sandboxId,
        worker,
        port: port1,
        eventEmitter,
        createdAt: new Date(),
        lastActivity: new Date(),
        memoryUsage: 0,
        cpuUsage: 0,
        isActive: true,
      };

      // Set up worker event handlers
      this.setupWorkerEventHandlers(sandbox);

      // Set up communication channel
      this.setupCommunicationChannel(sandbox);

      this.sandboxes.set(sandboxId, sandbox);

      this.logger.log(`Created sandbox: ${sandboxId} for plugin: ${pluginId}`);
      return Promise.resolve(sandboxId);
    } catch (error) {
      this.logger.error(
        `Failed to create sandbox for plugin ${pluginId}: ${getErrorMessage(error)}`,
      );
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async executePlugin(
    sandboxId: string,
    context: PluginExecutionContext,
  ): Promise<PluginExecutionResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!((sandbox?.isActive) ?? false)) {
      throw new Error(`Sandbox not found or inactive: ${sandboxId}`);
    }

    const startTime = Date.now();
    
    try {
      // Check permissions
      await this.validatePermissions(context.permissions, sandbox!);

      // Execute plugin in sandbox
      const result = await this.executeInSandbox(sandbox!, context);
      
      const executionTime = Date.now() - startTime;
      sandbox!.lastActivity = new Date();

      this.logger.debug(
        `Plugin executed in sandbox ${sandboxId} in ${executionTime}ms`,
      );

      return {
        success: true,
        data: result,
        executionTime,
        memoryUsed: sandbox!.memoryUsage,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error(
        `Plugin execution failed in sandbox ${sandboxId}: ${getErrorMessage(error)}`,
      );

      return {
        success: false,
        error: getErrorMessage(error),
        executionTime,
        memoryUsed: sandbox!.memoryUsage,
      };
    }
  }

  async destroySandbox(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return;
    }

    try {
      sandbox.isActive = false;
      
      // Close communication channel
      sandbox.port.close();
      
      // Terminate worker gracefully
      await sandbox.worker.terminate();
      
      // Remove event listeners
      sandbox.eventEmitter.removeAllListeners();
      
      this.sandboxes.delete(sandboxId);
      
      this.logger.log(`Destroyed sandbox: ${sandboxId}`);
    } catch (error) {
      this.logger.error(
        `Failed to destroy sandbox ${sandboxId}: ${getErrorMessage(error)}`,
      );
    }
  }

  getSandboxStats(sandboxId: string): Promise<{
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
    isActive: boolean;
  } | null> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return Promise.resolve(null);
    }

    const uptime = Date.now() - sandbox.createdAt.getTime();

    return Promise.resolve({
      memoryUsage: sandbox.memoryUsage,
      cpuUsage: sandbox.cpuUsage,
      uptime,
      isActive: sandbox.isActive,
    });
  }

  async cleanupInactiveSandboxes(): Promise<void> {
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();

    const inactiveSandboxes = Array.from(this.sandboxes.entries())
      .filter(([_, sandbox]) => {
        const lastActivityTime = sandbox.lastActivity.getTime();
        return now - lastActivityTime > inactiveThreshold;
      })
      .map(([sandboxId]) => sandboxId);

    if (inactiveSandboxes.length > 0) {
      this.logger.log(`Cleaning up ${inactiveSandboxes.length} inactive sandboxes`);
      await Promise.allSettled(
        inactiveSandboxes.map(sandboxId => this.destroySandbox(sandboxId))
      );
    }
  }

  getAllSandboxes(): SandboxInstance[] {
    return Array.from(this.sandboxes.values());
  }

  private setupWorkerEventHandlers(sandbox: SandboxInstance): void {
    sandbox.worker.on('error', (error) => {
      this.logger.error(
        `Worker error in sandbox ${sandbox.id}: ${getErrorMessage(error)}`,
      );
      sandbox.isActive = false;
      sandbox.eventEmitter.emit('error', error);
    });

    sandbox.worker.on('exit', (code) => {
      this.logger.log(
        `Worker exited in sandbox ${sandbox.id} with code: ${code}`,
      );
      sandbox.isActive = false;
      sandbox.eventEmitter.emit('exit', code);
    });

    sandbox.worker.on('messageerror', (error) => {
      this.logger.error(
        `Message error in sandbox ${sandbox.id}: ${getErrorMessage(error)}`,
      );
      sandbox.eventEmitter.emit('messageerror', error);
    });
  }

  private setupCommunicationChannel(sandbox: SandboxInstance): void {
    sandbox.port.on('message', (message: SandboxMessageTypes) => {
      switch (message.type) {
        case 'stats':
          sandbox.memoryUsage = (message).data.memoryUsage;
          sandbox.cpuUsage = (message).data.cpuUsage;
          break;
        case 'log':
          this.logger.debug(
            `Sandbox ${sandbox.id}: ${(message).data.message}`,
          );
          break;
        case 'error':
          this.logger.error(
            `Sandbox ${sandbox.id} error: ${(message).data.error}`,
          );
          sandbox.eventEmitter.emit('pluginError', (message).data);
          break;
        case 'result':
          sandbox.eventEmitter.emit('result', (message).data);
          break;
        default:
          this.logger.warn(
            `Unknown message type from sandbox ${sandbox.id}: ${String(message)}`,
          );
      }
    });

    sandbox.port.on('close', () => {
      this.logger.debug(`Communication channel closed for sandbox ${sandbox.id}`);
      sandbox.isActive = false;
    });
  }

  private async executeInSandbox(
    sandbox: SandboxInstance,
    context: PluginExecutionContext,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Plugin execution timeout'));
      }, this.defaultConfig.timeoutMs);

      const resultHandler = (result: unknown): void => {
        clearTimeout(timeout);
        sandbox.eventEmitter.removeListener('pluginError', errorHandler);
        resolve(result);
      };

      const errorHandler = (error: unknown): void => {
        clearTimeout(timeout);
        sandbox.eventEmitter.removeListener('result', resultHandler);
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      sandbox.eventEmitter.once('result', resultHandler);
      sandbox.eventEmitter.once('pluginError', errorHandler);

      // Send execution request to worker
      sandbox.port.postMessage({
        type: 'execute',
        data: context,
      });
    });
  }

  private validatePermissions(
    requestedPermissions: string[],
    _sandbox: SandboxInstance,
  ): Promise<void> {
    // Implementation would check against allowed permissions
    // This is a simplified version
    try {
      for (const permission of requestedPermissions) {
        if (!this.isPermissionAllowed(permission)) {
          throw new Error(`Permission denied: ${permission}`);
        }
      }
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private isPermissionAllowed(permission: string): boolean {
    // Whitelist of allowed permissions
    const allowedPermissions = [
      'read:data',
      'write:data',
      'http:request',
      'cache:access',
    ];
    
    return allowedPermissions.includes(permission);
  }

  private generateSandboxId(pluginId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `sandbox-${pluginId}-${timestamp}-${random}`;
  }
}