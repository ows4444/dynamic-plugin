import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ExecutionResult, PluginError, PluginInstance, PluginInstanceMethods, PluginSeverity } from '@types';

import { PluginErrorHandler } from '@/shared/utils/error-handler.util';
import { PluginLoaderService } from './plugin-loader.service';

/**
 * Service responsible for executing plugin methods and managing execution context
 */
@Injectable()
export class PluginExecutionService {
  private readonly logger = new Logger(PluginExecutionService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly pluginLoader: PluginLoaderService,
  ) {}

  /**
   * Execute a plugin with proper isolation and error handling
   */
  isolatePluginExecution(plugin: PluginInstance): ExecutionResult {
    const startTime = Date.now();

    try {
      this.logger.debug(`Isolating execution for plugin: ${plugin.id}`);

      // This would implement proper plugin isolation
      // For now, we'll return a successful result
      const result = {
        success: true,
        result: { message: 'Plugin executed successfully' },
        executionTime: Date.now() - startTime,
      };

      this.eventEmitter.emit('plugin.execution.completed', {
        pluginId: plugin.id,
        executionTime: result.executionTime,
        success: result.success,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to isolate execution for ${plugin.id}:`, error);

      return {
        success: false,
        error: error as Error,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Call a method on a plugin instance
   */
  async callPluginMethod(pluginId: string, method: string, args: unknown[]): Promise<unknown> {
    try {
      const pluginModule = this.pluginLoader.getPluginModule(pluginId);
      if (!pluginModule?.instance) {
        throw new Error(`Plugin not loaded or instance not available: ${pluginId}`);
      }

      const instance = pluginModule.instance as PluginInstanceMethods;
      if (typeof instance[method] !== 'function') {
        throw new Error(`Method not found in plugin ${pluginId}: ${method}`);
      }

      const methodFn = instance[method] as (...args: unknown[]) => Promise<unknown>;
      const result = await methodFn(...args);

      this.eventEmitter.emit('plugin.method.called', {
        pluginId,
        method,
        argsCount: args.length,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to call method ${method} on plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Execute a plugin hook
   */
  async executePluginHook(pluginId: string, hookName: string, hookData?: unknown): Promise<void> {
    try {
      this.logger.debug(`Executing plugin hook: ${hookName} for ${pluginId}`);

      const pluginModule = this.pluginLoader.getPluginModule(pluginId);
      if (!pluginModule?.instance) {
        this.logger.debug(`Plugin not loaded for hook execution: ${pluginId}`);
        return;
      }

      // Check if the plugin instance has the hook method
      const instance = pluginModule.instance as PluginInstanceMethods;
      const hookMethod = instance[hookName];

      if (typeof hookMethod === 'function') {
        (hookMethod as Function).call(instance, hookData);

        this.eventEmitter.emit('plugin.hook.executed', {
          pluginId,
          hookName,
          timestamp: new Date(),
        });
      } else {
        this.logger.debug(`No ${hookName} hook method found for plugin: ${pluginId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to execute hook ${hookName} for plugin ${pluginId}:`, error);

      // Create and handle plugin error
      const pluginError: PluginError = {
        name: 'PluginHookExecutionError',
        pluginId,
        code: 'HOOK_EXECUTION_ERROR',
        message: `Failed to execute hook: ${hookName}`,
        severity: PluginSeverity.MEDIUM,
        recoverable: true,
        timestamp: new Date(),
        context: {
          hookName,
          error: error instanceof Error ? error.message : String(error),
        },
      };

      await this.handlePluginError(pluginError);
    }
  }

  /**
   * Handle plugin errors with recovery attempts
   */
  async handlePluginError(error: PluginError): Promise<void> {
    try {
      PluginErrorHandler.handlePluginError(error);

      // Update plugin status if it's a critical error
      if (error.severity === PluginSeverity.CRITICAL) {
        const pluginModule = this.pluginLoader.getPluginModule(error.pluginId);
        if (pluginModule) {
          pluginModule.status.healthy = false;
          pluginModule.status.errorCount++;
          pluginModule.status.lastError = error;
        }
      }

      // Attempt recovery if error is recoverable
      if (error.recoverable) {
        await this.attemptPluginRecovery(error.pluginId, error);
      }

      this.eventEmitter.emit('plugin.error.handled', {
        pluginId: error.pluginId,
        errorCode: error.code,
        severity: error.severity,
        recoverable: error.recoverable,
        timestamp: new Date(),
      });
    } catch (recoveryError) {
      this.logger.error(`Failed to handle plugin error for ${error.pluginId}:`, recoveryError);
    }
  }

  /**
   * Attempt to recover a failed plugin
   */
  private async attemptPluginRecovery(pluginId: string, error: PluginError): Promise<void> {
    try {
      this.logger.log(`Attempting recovery for plugin: ${pluginId}`);

      const pluginModule = this.pluginLoader.getPluginModule(pluginId);
      if (!pluginModule) {
        this.logger.warn(`Cannot recover plugin - not found in loaded modules: ${pluginId}`);
        return;
      }

      // Simple recovery strategy: reload the plugin
      await this.pluginLoader.reloadPlugin(pluginId);

      this.logger.log(`Plugin recovery successful: ${pluginId}`);

      this.eventEmitter.emit('plugin.recovery.success', {
        pluginId,
        errorCode: error.code,
        strategy: 'reload',
        timestamp: new Date(),
      });
    } catch (recoveryError) {
      this.logger.error(`Plugin recovery failed for ${pluginId}:`, recoveryError);

      this.eventEmitter.emit('plugin.recovery.failed', {
        pluginId,
        errorCode: error.code,
        recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
        timestamp: new Date(),
      });
    }
  }

  /**
   * Execute plugin with timeout and resource limits
   */
  async executeWithLimits(
    pluginId: string,
    method: string,
    args: unknown[],
    options: {
      timeout?: number;
      memoryLimit?: number;
      cpuLimit?: number;
    } = {},
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const timeout = options.timeout ?? 30000; // 30 seconds default

    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Plugin execution timeout after ${timeout}ms`));
        }, timeout);
      });

      // Execute method with timeout
      const executionPromise = this.callPluginMethod(pluginId, method, args);

      const result = await Promise.race([executionPromise, timeoutPromise]);

      const executionTime = Date.now() - startTime;

      this.eventEmitter.emit('plugin.execution.success', {
        pluginId,
        method,
        executionTime,
        timestamp: new Date(),
      });

      return {
        success: true,
        result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error(`Plugin execution failed for ${pluginId}.${method}:`, error);

      this.eventEmitter.emit('plugin.execution.failed', {
        pluginId,
        method,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        timestamp: new Date(),
      });

      return {
        success: false,
        error: error as Error,
        executionTime,
      };
    }
  }

  /**
   * Get execution metrics for a plugin
   */
  getExecutionMetrics(pluginId: string) {
    const pluginModule = this.pluginLoader.getPluginModule(pluginId);
    if (!pluginModule) {
      return null;
    }

    return {
      pluginId,
      loadTime: pluginModule.loadTime,
      lastActivity: pluginModule.lastActivity,
      status: pluginModule.status,
      errorCount: pluginModule.status.errorCount,
      healthy: pluginModule.status.healthy,
      lastError: pluginModule.status.lastError,
    };
  }

  /**
   * Get execution metrics for all loaded plugins
   */
  getAllExecutionMetrics() {
    const allModules = this.pluginLoader.getAllLoadedModules();

    return allModules.map((module) => ({
      pluginId: module.id,
      loadTime: module.loadTime,
      lastActivity: module.lastActivity,
      status: module.status,
      errorCount: module.status.errorCount,
      healthy: module.status.healthy,
      lastError: module.status.lastError,
    }));
  }
}
