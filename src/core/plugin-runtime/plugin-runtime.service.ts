import { Injectable, Logger, Type } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ModuleRef } from '@nestjs/core';
import type { ExecutionResult, PluginContext, PluginError, PluginInstance, PluginMetadata } from '@/types/plugin.types';
import { PluginSeverity } from '@/types/plugin.types';
import { type ModuleStatus, PluginInstanceMethods, type PluginLoader, type PluginModule, type RuntimeContext, type ValidationResult } from '@/types/runtime.types';
import { PluginLoaderService } from './services/plugin-loader.service';
import { PluginContextService } from './services/plugin-context.service';
import { PluginExecutionService } from './services/plugin-execution.service';
import { PluginIsolationService } from './services/plugin-isolation.service';
import { PluginErrorHandler } from '@/shared/utils/error-handler.util';
import type { SecurityContext } from '@/types/plugin.types';
import type { IsolationOptions, IsolationResult, ResourceUsage } from '@/types/runtime.types';

/**
 * Enhanced plugin runtime service with improved architecture and error handling
 */
@Injectable()
export class PluginRuntimeService implements PluginLoader {
  private readonly logger = new Logger(PluginRuntimeService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly moduleRef: ModuleRef,
    private readonly pluginLoader: PluginLoaderService,
    private readonly contextService: PluginContextService,
    private readonly executionService: PluginExecutionService,
    private readonly isolationService: PluginIsolationService,
  ) {}

  /**
   * Creates a plugin context using the context service
   */
  async createPluginContext(plugin: PluginMetadata): Promise<PluginContext> {
    return this.contextService.createPluginContext(plugin);
  }

  /**
   * Gets the runtime context for a plugin
   */
  getRuntimeContext(pluginId: string): RuntimeContext | null {
    return this.contextService.getRuntimeContext(pluginId);
  }

  /**
   * Loads a plugin module using the plugin loader service
   */
  loadPluginModule(_pluginPath: string): Promise<Type<unknown>> {
    // This method is kept for backward compatibility
    // The actual loading is now handled by PluginLoaderService
    throw new Error('Use loadPlugin method instead of loadPluginModule');
  }

  /**
   * Loads a plugin using the plugin loader service
   */
  async loadPlugin(pluginPath: string, context: RuntimeContext): Promise<PluginModule> {
    return this.pluginLoader.loadPlugin(pluginPath, context);
  }

  /**
   * Unloads a plugin using the plugin loader service
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    // Also clean up context
    await Promise.all([this.pluginLoader.unloadPlugin(pluginId), this.contextService.destroyPluginContext(pluginId)]);
  }

  /**
   * Reloads a plugin using the plugin loader service
   */
  async reloadPlugin(pluginId: string): Promise<PluginModule> {
    return this.pluginLoader.reloadPlugin(pluginId);
  }

  /**
   * Validates a plugin using the plugin loader service
   */
  async validatePlugin(pluginPath: string): Promise<ValidationResult> {
    return this.pluginLoader.validatePlugin(pluginPath);
  }

  /**
   * Executes a plugin hook
   */
  executePluginHook(hookName: string, context: PluginContext): void {
    try {
      this.logger.debug(`Executing plugin hook: ${hookName} for ${context.pluginId}`);

      const runtimeContext = this.contextService.getRuntimeContext(context.pluginId);
      if (!runtimeContext?.hooks[hookName as keyof typeof runtimeContext.hooks]) {
        this.logger.debug(`No ${hookName} hook defined for plugin: ${context.pluginId}`);
        return;
      }

      const hookScript = runtimeContext.hooks[hookName as keyof typeof runtimeContext.hooks];
      if (!hookScript) return;

      // For now, we'll just log the hook execution
      this.logger.debug(`Would execute hook script: ${hookScript}`);

      this.eventEmitter.emit('plugin.hook.executed', {
        pluginId: context.pluginId,
        hookName,
        hookScript,
      });
    } catch (error) {
      PluginErrorHandler.handlePluginError(error as Error, context.pluginId);
    }
  }

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
   * Handles plugin errors
   */
  async handlePluginError(error: PluginError): Promise<void> {
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
  }

  /**
   * Attempts to recover a failed plugin
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
      await this.reloadPlugin(pluginId);

      this.logger.log(`Plugin recovery successful: ${pluginId}`);

      this.eventEmitter.emit('plugin.recovery.success', {
        pluginId,
        error: error.code,
        strategy: 'reload',
      });
    } catch (recoveryError) {
      this.logger.error(`Plugin recovery failed for ${pluginId}:`, recoveryError);

      this.eventEmitter.emit('plugin.recovery.failed', {
        pluginId,
        error: error.code,
        recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
      });
    }
  }

  /**
   * Calls a method on a plugin instance
   */
  private async callPluginMethod(pluginId: string, method: string, args: unknown[]): Promise<unknown> {
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
   * Gets a plugin module using the plugin loader service
   */
  getPluginModule(pluginId: string): PluginModule | null {
    return this.pluginLoader.getPluginModule(pluginId);
  }

  /**
   * Gets plugin health using the plugin loader service
   */
  async getPluginHealth(pluginId: string): Promise<ModuleStatus | null> {
    return this.pluginLoader.checkPluginHealth(pluginId);
  }

  /**
   * Gets all loaded modules using the plugin loader service
   */
  getAllLoadedModules(): PluginModule[] {
    return this.pluginLoader.getAllLoadedModules();
  }

  /**
   * Gets all loaded module IDs
   */
  getLoadedModuleIds(): string[] {
    return this.pluginLoader.getAllLoadedModules().map((m) => m.id);
  }

  /**
   * Create isolated environment for a plugin
   */
  createIsolatedEnvironment(plugin: PluginInstance, securityContext: SecurityContext, options: IsolationOptions = {}): IsolationResult {
    return this.isolationService.createIsolatedEnvironment(plugin, securityContext, options);
  }

  /**
   * Destroy isolated environment for a plugin
   */
  destroyIsolatedEnvironment(pluginId: string): void {
    return this.isolationService.destroyIsolatedEnvironment(pluginId);
  }

  /**
   * Execute plugin method with resource limits
   */
  async executeWithLimits(pluginId: string, method: string, args: unknown[], options?: { timeout?: number; memoryLimit?: number; cpuLimit?: number }): Promise<ExecutionResult> {
    return this.executionService.executeWithLimits(pluginId, method, args, options);
  }

  /**
   * Get execution metrics for a plugin
   */
  getExecutionMetrics(pluginId: string) {
    return this.executionService.getExecutionMetrics(pluginId);
  }

  /**
   * Get execution metrics for all plugins
   */
  getAllExecutionMetrics() {
    return this.executionService.getAllExecutionMetrics();
  }

  /**
   * Get resource usage for a plugin
   */
  getResourceUsage(pluginId: string): ResourceUsage | null {
    return this.isolationService.getResourceUsage(pluginId);
  }

  /**
   * Check if operation is allowed for a plugin
   */
  isOperationAllowed(pluginId: string, operation: string, resource?: string): boolean {
    return this.isolationService.isOperationAllowed(pluginId, operation, resource);
  }
}
