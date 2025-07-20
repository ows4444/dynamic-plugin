import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ModuleRef } from '@nestjs/core';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  DynamicModuleImport,
  ModuleMetadata,
  ModuleState,
  ModuleStatus,
  PluginExports,
  PluginLoader,
  PluginManifest,
  PluginModule,
  PluginModuleInstanceWithMethods,
  RuntimeContext,
  ValidationResult,
} from '@types';

import { PluginValidationUtil } from '@/shared/utils/validation.util';
import { PluginErrorCodes, PluginErrorHandler } from '@/shared/utils/error-handler.util';
import type { Type } from '@nestjs/common';

/**
 * Enhanced plugin loader service with improved type safety and error handling
 */
@Injectable()
export class PluginLoaderService implements PluginLoader {
  private readonly logger = new Logger(PluginLoaderService.name);
  private readonly loadedModules = new Map<string, PluginModule>();
  private readonly runtimeContexts = new Map<string, RuntimeContext>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly moduleRef: ModuleRef,
  ) {}

  async loadPlugin(pluginPath: string, context: RuntimeContext): Promise<PluginModule> {
    const startTime = Date.now();

    try {
      this.logger.log(`Loading plugin: ${context.pluginId} from ${pluginPath}`);

      // Validate input parameters
      PluginErrorHandler.validatePluginId(context.pluginId, 'plugin loading');
      this.validatePluginPath(pluginPath);

      // Validate plugin before loading
      const validationResult = await this.validatePlugin(pluginPath);
      if (!validationResult.valid) {
        throw PluginErrorHandler.createPluginError(context.pluginId, PluginErrorCodes.LOAD_FAILED, `Plugin validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Load and parse manifest
      const manifest = await this.loadManifest(pluginPath);
      const mainModulePath = this.resolveMainModulePath(pluginPath, manifest.main);

      // Load the module class
      const ModuleClass = await this.loadModuleClass(mainModulePath, context.pluginId);

      // Create plugin module instance
      const pluginModule = await this.createPluginModule(context.pluginId, manifest, ModuleClass, mainModulePath, startTime);

      // Store contexts and modules
      this.runtimeContexts.set(context.pluginId, context);
      this.loadedModules.set(context.pluginId, pluginModule);

      // Emit events
      this.eventEmitter.emit('plugin.module.loaded', {
        pluginId: context.pluginId,
        loadTime: pluginModule.loadTime,
      });

      this.logger.log(`Plugin loaded successfully: ${context.pluginId} (${pluginModule.loadTime}ms)`);
      return pluginModule;
    } catch (error) {
      return PluginErrorHandler.withErrorHandling(
        () => {
          throw error;
        },
        context.pluginId,
        'load plugin',
      );
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    try {
      PluginErrorHandler.validatePluginId(pluginId, 'plugin unloading');

      this.logger.log(`Unloading plugin: ${pluginId}`);

      const pluginModule = this.loadedModules.get(pluginId);
      if (!pluginModule) {
        throw PluginErrorHandler.createPluginError(pluginId, PluginErrorCodes.PLUGIN_NOT_FOUND, `Plugin not loaded: ${pluginId}`);
      }

      // Call cleanup hooks if available
      if (pluginModule.instance?.onModuleDestroy) {
        await pluginModule.instance.onModuleDestroy();
      }

      if (pluginModule.instance?.onApplicationShutdown) {
        await pluginModule.instance.onApplicationShutdown();
      }

      // Update status
      pluginModule.status = {
        ...pluginModule.status,
        state: ModuleState.UNLOADING,
        loaded: false,
        initialized: false,
      };

      // Clear module from require cache
      this.clearModuleCache(pluginId);

      // Remove from loaded modules and contexts
      this.loadedModules.delete(pluginId);
      this.runtimeContexts.delete(pluginId);

      this.eventEmitter.emit('plugin.module.unloaded', { pluginId });
      this.logger.log(`Plugin unloaded successfully: ${pluginId}`);
    } catch (error) {
      return PluginErrorHandler.withErrorHandling(
        () => {
          throw error;
        },
        pluginId,
        'unload plugin',
      );
    }
  }

  async reloadPlugin(pluginId: string): Promise<PluginModule> {
    try {
      PluginErrorHandler.validatePluginId(pluginId, 'plugin reloading');

      this.logger.log(`Reloading plugin: ${pluginId}`);

      const context = this.runtimeContexts.get(pluginId);
      if (!context) {
        throw PluginErrorHandler.createPluginError(pluginId, PluginErrorCodes.PLUGIN_NOT_FOUND, `Runtime context not found for plugin: ${pluginId}`);
      }

      // Unload first
      await this.unloadPlugin(pluginId);

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Load again
      const pluginModule = await this.loadPlugin(context.workingDirectory, context);

      this.logger.log(`Plugin reloaded successfully: ${pluginId}`);
      return pluginModule;
    } catch (error) {
      return PluginErrorHandler.withErrorHandling(
        () => {
          throw error;
        },
        pluginId,
        'reload plugin',
      );
    }
  }

  async validatePlugin(pluginPath: string): Promise<ValidationResult> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check if plugin directory exists
      if (!(await fs.pathExists(pluginPath))) {
        return {
          valid: false,
          errors: [`Plugin directory not found: ${pluginPath}`],
          warnings: [],
        };
      }

      // Check for required files
      const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
      if (!(await fs.pathExists(manifestPath))) {
        return {
          valid: false,
          errors: ['plugin.manifest.json not found'],
          warnings: [],
        };
      }

      // Validate manifest
      const manifest = await this.loadManifest(pluginPath);
      const manifestValidation = PluginValidationUtil.validateManifest(manifest);

      errors.push(...manifestValidation.errors);
      warnings.push(...manifestValidation.warnings);

      // Additional runtime-specific validation
      if (manifest.main) {
        const mainPath = this.resolveMainModulePath(pluginPath, manifest.main);
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

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
      };
    }
  }

  getPluginModule(pluginId: string): PluginModule | null {
    return this.loadedModules.get(pluginId) ?? null;
  }

  /**
   * Get all loaded plugin modules
   */
  getAllLoadedModules(): PluginModule[] {
    return Array.from(this.loadedModules.values());
  }

  /**
   * Get plugin runtime context
   */
  getRuntimeContext(pluginId: string): RuntimeContext | null {
    return this.runtimeContexts.get(pluginId) ?? null;
  }

  /**
   * Check plugin health
   */
  async checkPluginHealth(pluginId: string): Promise<ModuleStatus | null> {
    const pluginModule = this.loadedModules.get(pluginId);
    if (!pluginModule) {
      return null;
    }

    try {
      // Update last health check
      pluginModule.status.lastHealthCheck = new Date();

      // Perform basic health checks
      if (pluginModule.instance && typeof pluginModule.instance.getHealth === 'function') {
        const healthResult = await (pluginModule.instance.getHealth as () => Promise<{ status: string }>)();
        pluginModule.status.healthy = healthResult.status === 'healthy';
      }

      return pluginModule.status;
    } catch (error) {
      pluginModule.status.healthy = false;
      pluginModule.status.lastError = error as Error;
      pluginModule.status.errorCount++;
      return pluginModule.status;
    }
  }

  private validatePluginPath(pluginPath: string): void {
    if (!pluginPath || typeof pluginPath !== 'string' || !pluginPath.trim()) {
      throw PluginErrorHandler.createPluginError('unknown', PluginErrorCodes.INVALID_CONFIGURATION, 'Plugin path is required and must be a valid string');
    }

    if (!path.isAbsolute(pluginPath)) {
      throw PluginErrorHandler.createPluginError('unknown', PluginErrorCodes.INVALID_CONFIGURATION, 'Plugin path must be absolute');
    }
  }

  private async loadManifest(pluginPath: string): Promise<PluginManifest> {
    try {
      const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
      const manifestData = (await fs.readJson(manifestPath)) as PluginManifest;
      return manifestData;
    } catch (error) {
      throw PluginErrorHandler.createPluginError('unknown', PluginErrorCodes.INVALID_MANIFEST, `Failed to load plugin manifest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private resolveMainModulePath(pluginPath: string, mainPath: string): string {
    if (path.isAbsolute(mainPath)) {
      return mainPath;
    }
    return path.resolve(pluginPath, mainPath);
  }

  private async loadModuleClass(mainModulePath: string, pluginId: string): Promise<Type<unknown>> {
    try {
      // Clear module cache for hot reloading
      delete require.cache[path.resolve(mainModulePath)];

      // Dynamically import the module
      const moduleExports = (await import(mainModulePath)) as DynamicModuleImport;

      // Get the default export or first available export
      const ModuleClass = moduleExports.default ?? moduleExports[Object.keys(moduleExports)[0]];

      if (!ModuleClass || typeof ModuleClass !== 'function') {
        throw PluginErrorHandler.createPluginError(pluginId, PluginErrorCodes.MODULE_NOT_FOUND, `No valid module class found in: ${mainModulePath}`);
      }

      return ModuleClass as Type<unknown>;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw PluginError
      }

      throw PluginErrorHandler.createPluginError(pluginId, PluginErrorCodes.LOAD_FAILED, `Failed to load module class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createPluginModule(pluginId: string, manifest: PluginManifest, moduleClass: Type<unknown>, mainModulePath: string, startTime: number): Promise<PluginModule> {
    try {
      // Extract module exports and metadata
      const exports = this.extractModuleExports(moduleClass, mainModulePath);
      const metadata = this.extractModuleMetadata(moduleClass);

      // Create module instance (simplified for now)
      let instance: PluginModuleInstanceWithMethods | null = null;
      try {
        const tempInstance = new (moduleClass as new () => unknown)();
        if (tempInstance && typeof tempInstance === 'object') {
          instance = tempInstance as PluginModuleInstanceWithMethods;

          // Initialize if available
          if (instance.onModuleInit) {
            await instance.onModuleInit();
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to create module instance for ${pluginId}:`, error);
        // Continue without instance
      }

      const pluginModule: PluginModule = {
        id: pluginId,
        name: manifest.name,
        version: manifest.version,
        instance,
        exports,
        metadata,
        status: {
          state: ModuleState.LOADED,
          loaded: true,
          initialized: instance !== null,
          healthy: true,
          lastHealthCheck: new Date(),
          errorCount: 0,
        },
        loadTime: Date.now() - startTime,
        lastActivity: new Date(),
      };

      return pluginModule;
    } catch (error) {
      throw PluginErrorHandler.createPluginError(pluginId, PluginErrorCodes.LOAD_FAILED, `Failed to create plugin module: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractModuleExports(moduleClass: Type<unknown>, _pluginPath: string): PluginExports {
    try {
      // Extract metadata from the NestJS module decorator
      const imports = (Reflect.getMetadata('imports', moduleClass) as Array<Type<unknown>>) ?? [];
      const providers = (Reflect.getMetadata('providers', moduleClass) as Array<Type<unknown>>) ?? [];
      const controllers = (Reflect.getMetadata('controllers', moduleClass) as Array<Type<unknown>>) ?? [];
      const exports = (Reflect.getMetadata('exports', moduleClass) as Array<Type<unknown> | string>) ?? [];

      this.logger.debug(`Extracted metadata for ${moduleClass.name}:`, {
        controllersCount: controllers.length,
        providersCount: providers.length,
        importsCount: imports.length,
        exportsCount: exports.length,
      });

      // Filter out null/undefined values and ensure proper typing
      const validControllers = controllers.filter((c): c is Type<unknown> => c !== null && c !== undefined);
      const validProviders = providers.filter((p): p is Type<unknown> => p !== null && p !== undefined);

      return {
        controllers: validControllers,
        providers: validProviders,
        imports,
        exports: exports.filter((e) => e !== null && e !== undefined),
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
        decorators: ['Module'],
        imports: this.getMetadataNames('imports', moduleClass),
        providers: this.getMetadataNames('providers', moduleClass),
        controllers: this.getMetadataNames('controllers', moduleClass),
        exports: this.getMetadataNames('exports', moduleClass),
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

  private getMetadataNames(key: string, moduleClass: Type<unknown>): string[] {
    try {
      const metadata = Reflect.getMetadata(key, moduleClass) as unknown[];
      if (!Array.isArray(metadata)) {
        return [];
      }

      return metadata
        .filter((item) => item !== null && item !== undefined)
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }
          if (typeof item === 'function' && item.name) {
            return item.name;
          }
          if (typeof item === 'object' && 'name' in item && typeof item.name === 'string') {
            return item.name;
          }
          return 'unknown';
        });
    } catch (_error) {
      this.logger.warn(`Failed to get metadata names for key "${key}" in module ${moduleClass.name}`);
      return [];
    }
  }

  private clearModuleCache(pluginId: string): void {
    try {
      const context = this.runtimeContexts.get(pluginId);
      if (!context) {
        return;
      }

      const manifestPath = path.join(context.workingDirectory, 'plugin.manifest.json');
      if (fs.pathExistsSync(manifestPath)) {
        const manifest = fs.readJsonSync(manifestPath) as PluginManifest;
        const mainModulePath = this.resolveMainModulePath(context.workingDirectory, manifest.main);
        delete require.cache[path.resolve(mainModulePath)];
      }
    } catch (error) {
      this.logger.warn(`Failed to clear module cache for ${pluginId}:`, error);
    }
  }
}
