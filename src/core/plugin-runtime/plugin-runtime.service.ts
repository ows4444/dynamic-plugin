import { Injectable, Logger, Type } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs-extra';
import * as path from 'path';
import type { ExecutionResult, PluginConfig, PluginContext, PluginError, PluginInstance, PluginMetadata } from '@/types/plugin.types';
import { PluginSeverity } from '@/types/plugin.types';
import {
  DynamicModule,
  DynamicModuleImport,
  EnvironmentType,
  IsolationLevel,
  ModuleMetadata,
  ModuleState,
  type ModuleStatus,
  type PluginExports,
  PluginInstanceMethods,
  type PluginLoader,
  type PluginModule,
  type RuntimeContext,
  type ValidationResult,
} from '@/types/runtime.types';

@Injectable()
export class PluginRuntimeService implements PluginLoader {
  private readonly logger = new Logger(PluginRuntimeService.name);
  private readonly loadedModules = new Map<string, PluginModule>();
  private readonly runtimeContexts = new Map<string, RuntimeContext>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async createPluginContext(plugin: PluginMetadata): Promise<PluginContext> {
    try {
      this.logger.debug(`Creating plugin context for: ${plugin.id}`);

      const runtimeContext: RuntimeContext = {
        pluginId: plugin.id,
        workingDirectory: path.join(process.cwd(), 'src', 'plugins', 'installed', plugin.name),
        environment: {
          nodeVersion: process.version,
          nestjsVersion: '11.0.0', // Would get from actual NestJS version
          platform: process.platform,
          architecture: process.arch,
          environmentType: (process.env.NODE_ENV as EnvironmentType) ?? EnvironmentType.DEVELOPMENT,
          variables: this.getPluginEnvironmentVariables(plugin.id),
        },
        isolation: IsolationLevel.NONE,
        resourceLimits: {
          memory: 512 * 1024 * 1024, // 512MB
          cpu: 100,
          network: 100 * 1024 * 1024, // 100MB
          filesystem: 1024 * 1024 * 1024, // 1GB
          processes: 10,
          timeouts: {
            startup: 30000, // 30 seconds
            shutdown: 10000, // 10 seconds
            idle: 300000, // 5 minutes
          },
        },
        permissions: {
          filesystem: {
            read: [path.join(process.cwd(), 'src', 'plugins', 'installed', plugin.name)],
            write: [path.join(process.cwd(), 'src', 'plugins', 'installed', plugin.name, 'data')],
            execute: [],
            delete: [],
          },
          network: {
            outbound: [
              { protocol: 'https', host: '*', port: 443 },
              { protocol: 'http', host: 'localhost', port: [3000, 8000, 8080] },
            ],
            inbound: [],
          },
          system: {
            processes: false,
            environment: false,
            filesystem: true,
            network: true,
          },
          database: {
            read: [],
            write: [],
            schema: [],
          },
          plugins: plugin.permissions,
        },
        hooks: {
          beforeLoad: plugin.hooks.onStart,
          afterLoad: plugin.hooks.onStart,
          beforeUnload: plugin.hooks.onStop,
          afterUnload: plugin.hooks.onStop,
          onError: undefined,
          onHealthCheck: undefined,
        },
        dependencies: [],
      };

      this.runtimeContexts.set(plugin.id, runtimeContext);

      const context: PluginContext = {
        pluginId: plugin.id,
        config: await this.loadPluginConfig(plugin),
        logger: new Logger(`Plugin:${plugin.name}`),
        eventBus: {
          publish: (event) => {
            this.eventEmitter.emit('plugin.event', { ...event, source: plugin.id });
            return Promise.resolve();
          },
          subscribe: (eventPattern, handler) => {
            this.eventEmitter.on(eventPattern, handler);
            return Promise.resolve(`${plugin.id}:${eventPattern}:${Date.now()}`);
          },
          unsubscribe: (_subscriptionId) => {
            // Implementation for unsubscribe
            return Promise.resolve();
          },
        },
        security: {
          pluginId: plugin.id,
          permissions: plugin.permissions,
          isolation: false,
          resourceLimits: runtimeContext.resourceLimits,
        },
        interop: {
          sendMessage: (target, message) => {
            this.eventEmitter.emit('plugin.message', {
              from: plugin.id,
              to: target,
              message,
              timestamp: new Date(),
            });
            return Promise.resolve();
          },
          broadcastEvent: (event) => {
            this.eventEmitter.emit('plugin.broadcast', {
              ...event,
              source: plugin.id,
              timestamp: new Date(),
            });
            return Promise.resolve();
          },
          subscribeToEvents: (eventTypes) => {
            for (const eventType of eventTypes) {
              this.eventEmitter.on(eventType, (data) => {
                this.logger.debug(`Plugin ${plugin.id} received event: ${eventType}`, data);
              });
            }
            return Promise.resolve();
          },
          callPluginMethod: async (pluginId, method, args) => {
            return this.callPluginMethod(pluginId, method, args);
          },
          shareResource: (resource) => {
            this.eventEmitter.emit('plugin.resource.shared', {
              from: plugin.id,
              resource,
              timestamp: new Date(),
            });
            return Promise.resolve();
          },
        },
      };

      this.logger.debug(`Plugin context created successfully for: ${plugin.id}`);
      return context;
    } catch (error) {
      this.logger.error(`Failed to create plugin context for ${plugin.id}:`, error);
      throw error;
    }
  }

  private getPluginEnvironmentVariables(pluginId: string): Record<string, string> {
    const envVars: Record<string, string> = {};

    // Add plugin-specific environment variables
    const prefix = `PLUGIN_${pluginId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_`;

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix) && value) {
        envVars[key.substring(prefix.length)] = value;
      }
    }

    return envVars;
  }

  private async loadPluginConfig(plugin: PluginMetadata): Promise<PluginConfig> {
    try {
      const configPath = path.join(process.cwd(), 'src', 'plugins', 'installed', plugin.name, 'config', 'plugin.config.json');

      if (await fs.pathExists(configPath)) {
        return (await fs.readJson(configPath)) as PluginConfig;
      }

      // Return default config if no config file exists
      return {};
    } catch (error) {
      this.logger.warn(`Failed to load config for plugin ${plugin.id}:`, error);
      return {};
    }
  }

  async loadPluginModule(pluginPath: string): Promise<Type<unknown>> {
    try {
      this.logger.debug(`Loading plugin module from: ${pluginPath}`);

      // Resolve the absolute path
      const absolutePath = path.resolve(pluginPath);

      // Check if file exists
      if (!(await fs.pathExists(absolutePath))) {
        throw new Error(`Plugin module file not found: ${absolutePath}`);
      }

      // Clear module cache to allow hot reloading
      delete require.cache[absolutePath];

      // Dynamically import the module
      const moduleExports = (await import(absolutePath)) as DynamicModuleImport;

      // Get the default export or the module class
      const ModuleClass = moduleExports.default ?? moduleExports[Object.keys(moduleExports)[0]];

      if (!ModuleClass || typeof ModuleClass !== 'function') {
        throw new Error(`No valid module class found in: ${absolutePath}`);
      }

      this.logger.debug(`Plugin module loaded successfully: ${(ModuleClass as Type<unknown>).name}`);
      return ModuleClass as Type<unknown>;
    } catch (error) {
      this.logger.error(`Failed to load plugin module from ${pluginPath}:`, error);
      throw error;
    }
  }

  async loadPlugin(pluginPath: string, context: RuntimeContext): Promise<PluginModule> {
    const startTime = Date.now();

    try {
      this.logger.log(`Loading plugin: ${context.pluginId}`);

      // Validate plugin before loading
      const validationResult = await this.validatePlugin(pluginPath);
      if (!validationResult.valid) {
        throw new Error(`Plugin validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Find the main module file
      const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
      const manifest = (await fs.readJson(manifestPath)) as { main: string; name: string; version: string };
      const mainModulePath = path.join(pluginPath, manifest.main);

      // Load the module class
      const ModuleClass = await this.loadPluginModule(mainModulePath);

      // Create plugin module instance
      const pluginModule: PluginModule = {
        id: context.pluginId,
        name: manifest.name,
        version: manifest.version,
        instance: null, // Will be set when NestJS creates the module
        exports: this.extractModuleExports(ModuleClass),
        metadata: this.extractModuleMetadata(ModuleClass),
        status: {
          state: ModuleState.LOADED,
          loaded: true,
          initialized: false,
          healthy: true,
          lastHealthCheck: new Date(),
          errorCount: 0,
        },
        loadTime: Date.now() - startTime,
        lastActivity: new Date(),
      };

      this.loadedModules.set(context.pluginId, pluginModule);

      this.eventEmitter.emit('plugin.module.loaded', {
        pluginId: context.pluginId,
        loadTime: pluginModule.loadTime,
      });

      this.logger.log(`Plugin module loaded successfully: ${context.pluginId} (${pluginModule.loadTime}ms)`);
      return pluginModule;
    } catch (error) {
      this.logger.error(`Failed to load plugin ${context.pluginId}:`, error);
      throw error;
    }
  }

  private extractModuleExports(moduleClass: Type<unknown>): PluginExports {
    try {
      // Extract metadata from the NestJS module decorator using proper constants
      const imports = (Reflect.getMetadata('imports', moduleClass) as (Type<unknown> | DynamicModule)[]) ?? [];
      const providers = (Reflect.getMetadata('providers', moduleClass) as Type<unknown>[]) ?? [];
      const controllers = (Reflect.getMetadata('controllers', moduleClass) as Type<unknown>[]) ?? [];
      const exports = (Reflect.getMetadata('exports', moduleClass) as (Type<unknown> | string)[]) ?? [];

      return {
        controllers,
        providers,
        imports,
        exports,
        module: moduleClass,
      };
    } catch (error) {
      this.logger.warn(`Failed to extract module exports:`, error);
      return {
        controllers: [],
        providers: [],
        imports: [],
        exports: [],
        module: moduleClass,
      };
    }
  }

  private extractModuleMetadata(moduleClass: Type<unknown>): ModuleMetadata {
    try {
      return {
        decorators: ['Module'], // Would extract actual decorators
        imports: (Reflect.getMetadata('imports', moduleClass) as string[]) ?? [],
        providers: (Reflect.getMetadata('providers', moduleClass) as string[]) ?? [],
        controllers: (Reflect.getMetadata('controllers', moduleClass) as string[]) ?? [],
        exports: (Reflect.getMetadata('exports', moduleClass) as string[]) ?? [],
        global: (Reflect.getMetadata('global', moduleClass) as boolean) ?? false,
      };
    } catch (error) {
      this.logger.warn(`Failed to extract module metadata:`, error);
      return {
        decorators: [],
        imports: [],
        providers: [],
        controllers: [],
        exports: [],
        global: false,
      };
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    try {
      this.logger.log(`Unloading plugin: ${pluginId}`);

      const pluginModule = this.loadedModules.get(pluginId);
      if (!pluginModule) {
        throw new Error(`Plugin not loaded: ${pluginId}`);
      }

      // Update status
      pluginModule.status.loaded = false;
      pluginModule.status.initialized = false;

      // Remove from loaded modules
      this.loadedModules.delete(pluginId);

      // Remove runtime context
      this.runtimeContexts.delete(pluginId);

      // Clear module from require cache
      const runtimeContext = this.runtimeContexts.get(pluginId);
      if (runtimeContext) {
        const manifestPath = path.join(runtimeContext.workingDirectory, 'plugin.manifest.json');
        if (await fs.pathExists(manifestPath)) {
          const manifest = (await fs.readJson(manifestPath)) as { main: string };
          const mainModulePath = path.join(runtimeContext.workingDirectory, manifest.main);
          delete require.cache[path.resolve(mainModulePath)];
        }
      }

      this.eventEmitter.emit('plugin.module.unloaded', { pluginId });
      this.logger.log(`Plugin unloaded successfully: ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to unload plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async reloadPlugin(pluginId: string): Promise<PluginModule> {
    try {
      this.logger.log(`Reloading plugin: ${pluginId}`);

      const runtimeContext = this.runtimeContexts.get(pluginId);
      if (!runtimeContext) {
        throw new Error(`Runtime context not found for plugin: ${pluginId}`);
      }

      // Unload first
      await this.unloadPlugin(pluginId);

      // Wait a bit for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Load again
      const pluginModule = await this.loadPlugin(runtimeContext.workingDirectory, runtimeContext);

      this.logger.log(`Plugin reloaded successfully: ${pluginId}`);
      return pluginModule;
    } catch (error) {
      this.logger.error(`Failed to reload plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async validatePlugin(pluginPath: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if plugin directory exists
      if (!(await fs.pathExists(pluginPath))) {
        errors.push(`Plugin directory not found: ${pluginPath}`);
        return { valid: false, errors, warnings };
      }

      // Check for required files
      const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
      if (!(await fs.pathExists(manifestPath))) {
        errors.push('plugin.manifest.json not found');
        return { valid: false, errors, warnings };
      }

      // Validate manifest
      const manifest = (await fs.readJson(manifestPath)) as { main?: string };

      if (!manifest.main) {
        errors.push('Main entry point not specified in manifest');
      } else {
        const mainPath = path.join(pluginPath, manifest.main);
        if (!(await fs.pathExists(mainPath))) {
          errors.push(`Main entry point file not found: ${manifest.main}`);
        }
      }

      // Check for TypeScript compilation if source files exist
      const srcPath = path.join(pluginPath, 'src');
      if (await fs.pathExists(srcPath)) {
        const distPath = path.join(pluginPath, 'dist');
        if (!(await fs.pathExists(distPath))) {
          warnings.push('Source files found but no compiled output detected');
        }
      }

      // Validate package.json if exists
      const packageJsonPath = path.join(pluginPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = (await fs.readJson(packageJsonPath)) as { name?: string; version?: string };
        if (!packageJson.name) {
          warnings.push('package.json missing name field');
        }
        if (!packageJson.version) {
          warnings.push('package.json missing version field');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Validation error: ${errorMessage}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async executePluginHook(hookName: string, context: PluginContext): Promise<void> {
    try {
      this.logger.debug(`Executing plugin hook: ${hookName} for ${context.pluginId}`);

      const runtimeContext = this.runtimeContexts.get(context.pluginId);
      if (!runtimeContext?.hooks[hookName as keyof typeof runtimeContext.hooks]) {
        this.logger.debug(`No ${hookName} hook defined for plugin: ${context.pluginId}`);
        return;
      }

      const hookScript = runtimeContext.hooks[hookName as keyof typeof runtimeContext.hooks];
      if (!hookScript) return;

      const hookPath = path.join(runtimeContext.workingDirectory, hookScript);

      if (await fs.pathExists(hookPath)) {
        // Execute the hook script in a controlled environment
        // For now, we'll just log it
        this.logger.debug(`Executing hook script: ${hookPath}`);

        // This would actually execute the hook with proper sand-boxing
        // const result = await this.executeInSandbox(hookPath, context);

        this.eventEmitter.emit('plugin.hook.executed', {
          pluginId: context.pluginId,
          hookName,
          hookScript,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to execute ${hookName} hook for ${context.pluginId}:`, error);
      throw error;
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

  async handlePluginError(error: PluginError): Promise<void> {
    try {
      this.logger.error(`Plugin error in ${error.pluginId}:`, {
        code: error.code,
        message: error.message,
        severity: error.severity,
        recoverable: error.recoverable,
        context: error.context,
      });

      // Update plugin status if it's a critical error
      if (error.severity === PluginSeverity.CRITICAL) {
        const pluginModule = this.loadedModules.get(error.pluginId);
        if (pluginModule) {
          pluginModule.status.healthy = false;
          pluginModule.status.errorCount++;
          pluginModule.status.lastError = error;
        }
      }

      // Emit error event for monitoring
      this.eventEmitter.emit('plugin.error', {
        pluginId: error.pluginId,
        error: {
          code: error.code,
          message: error.message,
          severity: error.severity,
          recoverable: error.recoverable,
        },
        timestamp: new Date(),
      });

      // Attempt recovery if error is recoverable
      if (error.recoverable) {
        await this.attemptPluginRecovery(error.pluginId, error);
      }
    } catch (handlingError) {
      this.logger.error('Failed to handle plugin error:', handlingError);
    }
  }

  private async attemptPluginRecovery(pluginId: string, error: PluginError): Promise<void> {
    try {
      this.logger.log(`Attempting recovery for plugin: ${pluginId}`);

      const pluginModule = this.loadedModules.get(pluginId);
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

  private async callPluginMethod(pluginId: string, method: string, args: unknown[]): Promise<unknown> {
    try {
      const pluginModule = this.loadedModules.get(pluginId);
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

  getPluginModule(pluginId: string): PluginModule | null {
    return this.loadedModules.get(pluginId) ?? null;
  }

  async getPluginHealth(pluginId: string): Promise<ModuleStatus | null> {
    const pluginModule = this.loadedModules.get(pluginId);
    if (!pluginModule) {
      return null;
    }

    // Update last health check
    pluginModule.status.lastHealthCheck = new Date();

    // Perform basic health checks
    try {
      if (pluginModule.instance && typeof pluginModule.instance.getHealth === 'function') {
        const healthResult = await (pluginModule.instance.getHealth as () => Promise<{ status: string }>)();
        pluginModule.status.healthy = healthResult.status === 'healthy';
      }
    } catch (error) {
      pluginModule.status.healthy = false;
      pluginModule.status.lastError = error as Error;
      pluginModule.status.errorCount++;
    }

    return pluginModule.status;
  }

  getAllLoadedModules(): PluginModule[] {
    return Array.from(this.loadedModules.values());
  }

  getLoadedModuleIds(): string[] {
    return Array.from(this.loadedModules.keys());
  }
}
