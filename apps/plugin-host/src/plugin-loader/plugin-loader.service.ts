import { Injectable, Logger } from '@nestjs/common';
import { ModuleResolverService } from './module-resolver.service';
import { RouteManagerService } from './route-manager.service';
import * as path from 'path';

export interface LoadedPlugin {
  id: string;
  module: any;
  routes: any[];
  metadata: any;
}

@Injectable()
export class PluginLoaderService {
  private readonly logger = new Logger(PluginLoaderService.name);
  private loadedPlugins: Map<string, LoadedPlugin> = new Map();

  constructor(
    private readonly moduleResolver: ModuleResolverService,
    private readonly routeManager: RouteManagerService,
  ) {}

  async loadPlugin(pluginId: string): Promise<LoadedPlugin> {
    this.logger.log(`Loading plugin: ${pluginId}`);

    try {
      // Resolve plugin module path
      const pluginPath = this.getPluginPath(pluginId);

      // Dynamically import the plugin module
      const module = await this.moduleResolver.resolveModule(pluginPath);

      // Extract plugin metadata
      const metadata = await this.extractMetadata(pluginPath);

      // Register plugin routes
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
      this.logger.error(`Failed to load plugin ${pluginId}: ${error.message}`);
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
      // Unregister routes
      await this.routeManager.unregisterRoutes(pluginId);

      // Clean up module references
      await this.moduleResolver.cleanupModule(plugin.module);

      // Remove from loaded plugins
      this.loadedPlugins.delete(pluginId);

      this.logger.log(`Plugin unloaded successfully: ${pluginId}`);
    } catch (error) {
      this.logger.error(
        `Failed to unload plugin ${pluginId}: ${error.message}`,
      );
      throw error;
    }
  }

  async reloadPlugin(pluginId: string): Promise<LoadedPlugin> {
    this.logger.log(`Reloading plugin: ${pluginId}`);

    // Unload if already loaded
    if (this.loadedPlugins.has(pluginId)) {
      await this.unloadPlugin(pluginId);
    }

    // Load again
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

  private async extractMetadata(pluginPath: string): Promise<any> {
    try {
      const manifestPath = path.join(pluginPath, 'manifest.json');
      const manifest = await import(manifestPath);
      return manifest;
    } catch (error) {
      this.logger.warn(`Could not load manifest for plugin at ${pluginPath}`);
      return {};
    }
  }
}
