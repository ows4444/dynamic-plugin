import { getErrorMessage } from '@lib/shared/common';
import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { ModuleResolverService } from './module-resolver.service';
import { PluginRoute, RouteManagerService } from './route-manager.service';
interface PluginModuleClass {
  new (...args: unknown[]): unknown;
  [key: string]: unknown;
}
interface PluginModule {
  default?: PluginModuleClass | Record<string, unknown>;
  pluginModule?: PluginModuleClass;
  [key: string]: unknown;
}
interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  [key: string]: unknown;
}
export interface LoadedPlugin {
  id: string;
  module: PluginModule;
  routes: PluginRoute[];
  metadata: PluginMetadata;
}
@Injectable()
export class PluginLoaderService {
  private readonly logger = new Logger(PluginLoaderService.name);
  private readonly loadedPlugins: Map<string, LoadedPlugin> = new Map();
  constructor(
    private readonly moduleResolver: ModuleResolverService,
    private readonly routeManager: RouteManagerService,
  ) {}

  async loadPlugin(pluginId: string): Promise<LoadedPlugin> {
    this.logger.log(`Loading plugin: ${pluginId}`);

    try {
      const pluginPath = this.getPluginPath(pluginId);
      const module = await this.moduleResolver.resolveModule(pluginPath);
      const metadata = await this.extractMetadata(pluginPath);
      const routes = await this.routeManager.registerRoutes(pluginId, module);

      const loadedPlugin: LoadedPlugin = {
        id: pluginId,
        module,
        routes,
        metadata,
      };

      this.loadedPlugins.set(pluginId, loadedPlugin);

      this.logger.log(`Plugin loaded successfully: ${pluginId}`);
      return loadedPlugin;
    } catch (error) {
      this.logger.error(`Failed to load plugin ${pluginId}: ${getErrorMessage(error)}`);
      throw error;
    }
  }
 
  async unloadPlugin(pluginId: string): Promise<void> {
    this.logger.log(`Unloading plugin: ${pluginId}`);

    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not loaded: ${pluginId}`);
    }

    try {
      await this.routeManager.unregisterRoutes(pluginId);
      await this.moduleResolver.cleanupModule(plugin.module);
      this.loadedPlugins.delete(pluginId);

      this.logger.log(`Plugin unloaded successfully: ${pluginId}`);
    } catch (error) {
      this.logger.error(
        `Failed to unload plugin ${pluginId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

 
  async reloadPlugin(pluginId: string): Promise<LoadedPlugin> {
    this.logger.log(`Reloading plugin: ${pluginId}`);
    if (this.loadedPlugins.has(pluginId)) {
      await this.unloadPlugin(pluginId);
    }
    return this.loadPlugin(pluginId);
  }
  getLoadedPlugins(): LoadedPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }
  getLoadedPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }
  isPluginLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }
  private getPluginPath(pluginId: string): string {
    return path.join(process.cwd(), 'plugins', pluginId);
  }
  private async extractMetadata(pluginPath: string): Promise<PluginMetadata> {
    try {
      const manifestPath = path.join(pluginPath, 'manifest.json');
      const manifest = await import(manifestPath) as PluginMetadata;
      return manifest;
    } catch (_error) {
      this.logger.warn(`Could not load manifest for plugin at ${pluginPath}`);
      return {
        name: 'unknown',
        version: '0.0.0',
        description: 'Plugin with missing manifest'
      };
    }
  }
}
