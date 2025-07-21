import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';

interface PluginModule {
  default?: any;
  PluginModule?: any;
  cleanup?: () => Promise<void> | void;
  [key: string]: any;
}

@Injectable()
export class ModuleResolverService {
  private readonly logger = new Logger(ModuleResolverService.name);
  private moduleCache: Map<string, PluginModule> = new Map();

  async resolveModule(pluginPath: string): Promise<PluginModule> {
    this.logger.log(`Resolving module at: ${pluginPath}`);

    try {
      // Look for the main module file
      const possibleEntryPoints = [
        'index.js',
        'main.js',
        'plugin.js',
        'dist/main.js',
        'dist/index.js',
      ];

      let modulePath: string | null = null;

      for (const entryPoint of possibleEntryPoints) {
        const fullPath = path.join(pluginPath, entryPoint);
        try {
          // Check if file exists by trying to require.resolve
          require.resolve(fullPath);
          modulePath = fullPath;
          break;
        } catch {
          // Continue to next entry point
        }
      }

      if (!modulePath) {
        throw new Error(`Could not find module entry point in ${pluginPath}`);
      }

      // Clear require cache to ensure fresh load
      this.clearModuleFromCache(modulePath);

      // Dynamically import the module
      const module = await import(modulePath) as PluginModule;

      // Cache the module
      this.moduleCache.set(pluginPath, module);

      this.logger.log(`Module resolved successfully: ${modulePath}`);
      return module;
    } catch (error) {
      this.logger.error(
        `Failed to resolve module at ${pluginPath}: ${error.message}`,
      );
      throw error;
    }
  }

  async cleanupModule(module: any): Promise<void> {
    this.logger.log('Cleaning up module');

    try {
      // Call cleanup method if it exists
      if (module && typeof module.cleanup === 'function') {
        await (module.cleanup as () => Promise<void> | void)();
      }

      // Additional cleanup logic can go here
      this.logger.log('Module cleanup completed');
    } catch (error) {
      this.logger.error(`Module cleanup failed: ${error.message}`);
    }
  }

  private clearModuleFromCache(modulePath: string): void {
    // Clear from Node.js require cache
    const resolvedPath = require.resolve(modulePath);
    delete require.cache[resolvedPath];

    // Clear from our internal cache
    for (const [key, _value] of this.moduleCache.entries()) {
      if (key.includes(modulePath)) {
        this.moduleCache.delete(key);
      }
    }
  }

  getModuleInfo(pluginPath: string): any {
    return this.moduleCache.get(pluginPath);
  }

  clearAllCache(): void {
    this.logger.log('Clearing all module cache');
    this.moduleCache.clear();

    // Clear Node.js require cache for plugin modules
    for (const key of Object.keys(require.cache)) {
      if (key.includes('/plugins/')) {
        delete require.cache[key];
      }
    }
  }
}
