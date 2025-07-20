import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PluginRegistryService } from '@/core/plugin-registry/plugin-registry.service';
import { PluginRuntimeService } from '@/core/plugin-runtime/plugin-runtime.service';
import { LoadResult, PluginInstance, PluginStatus, ReloadResult, UnloadResult } from '@types';

/**
 * Service responsible for plugin lifecycle management (load, unload, reload)
 */
@Injectable()
export class PluginLifecycleService {
  private readonly logger = new Logger(PluginLifecycleService.name);
  private readonly pluginInstances = new Map<string, PluginInstance>();

  constructor(
    private readonly registryService: PluginRegistryService,
    private readonly runtimeService: PluginRuntimeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Load a plugin
   */
  async loadPlugin(pluginId: string): Promise<LoadResult> {
    if (!pluginId?.trim()) {
      return this.createLoadFailureResult('', 0, 'Plugin ID is required');
    }

    const startTime = Date.now();

    try {
      this.logger.log(`Loading plugin: ${pluginId}`);

      // Check if plugin exists in registry
      const registryEntry = this.registryService.getPlugin(pluginId);
      if (!registryEntry) {
        throw new Error(`Plugin not found in registry: ${pluginId}`);
      }

      if (!registryEntry.status.installed) {
        throw new Error(`Plugin not installed: ${pluginId}`);
      }

      if (this.pluginInstances.has(pluginId)) {
        throw new Error(`Plugin already loaded: ${pluginId}`);
      }

      // Create plugin instance (this would be handled by runtime service)
      const instance = this.createPluginInstance(registryEntry, startTime);

      this.pluginInstances.set(pluginId, instance);

      // Update registry status
      await this.registryService.updatePluginStatus(pluginId, {
        enabled: true,
        lastUsed: new Date(),
      });

      const loadTime = Date.now() - startTime;
      instance.metadata.loadTime = loadTime;

      this.eventEmitter.emit('plugin.loaded', {
        pluginId,
        instance,
        loadTime,
        timestamp: new Date(),
      });

      this.logger.log(`Plugin loaded successfully: ${pluginId} (${loadTime}ms)`);

      return {
        success: true,
        pluginId,
        loadTime,
        message: `Plugin ${registryEntry.name} loaded successfully`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Plugin loading failed: ${errorMessage}`, error);

      // Cleanup if partially loaded
      this.pluginInstances.delete(pluginId);

      return this.createLoadFailureResult(pluginId, Date.now() - startTime, errorMessage);
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<UnloadResult> {
    try {
      this.logger.log(`Unloading plugin: ${pluginId}`);

      const instance = this.pluginInstances.get(pluginId);
      if (!instance) {
        throw new Error(`Plugin not loaded: ${pluginId}`);
      }

      // Update status
      instance.status = PluginStatus.STOPPED;

      // Remove from instances
      this.pluginInstances.delete(pluginId);

      // Update registry status
      await this.registryService.updatePluginStatus(pluginId, {
        enabled: false,
      });

      // Notify runtime service to clean up
      await this.runtimeService.unloadPlugin(pluginId);

      this.eventEmitter.emit('plugin.unloaded', {
        pluginId,
        timestamp: new Date(),
      });

      this.logger.log(`Plugin unloaded successfully: ${pluginId}`);

      return {
        success: true,
        pluginId,
        message: 'Plugin unloaded successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Plugin unloading failed: ${errorMessage}`, error);

      return {
        success: false,
        pluginId,
        message: errorMessage,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Reload a plugin
   */
  async reloadPlugin(pluginId: string): Promise<ReloadResult> {
    try {
      this.logger.log(`Reloading plugin: ${pluginId}`);

      // Unload first
      const unloadResult = await this.unloadPlugin(pluginId);
      if (!unloadResult.success) {
        throw new Error(`Failed to unload plugin: ${unloadResult.message}`);
      }

      // Wait a bit for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Load again
      const loadResult = await this.loadPlugin(pluginId);
      if (!loadResult.success) {
        throw new Error(`Failed to load plugin: ${loadResult.message}`);
      }

      this.logger.log(`Plugin reloaded successfully: ${pluginId}`);

      return {
        success: true,
        pluginId,
        loadTime: loadResult.loadTime,
        message: 'Plugin reloaded successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Plugin reloading failed: ${errorMessage}`, error);

      return {
        success: false,
        pluginId,
        loadTime: 0,
        message: errorMessage,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Get plugin status
   */
  getPluginStatus(pluginId: string): PluginStatus {
    const instance = this.pluginInstances.get(pluginId);
    if (instance) {
      return instance.status;
    }

    const registryEntry = this.registryService.getPlugin(pluginId);
    if (registryEntry?.status.installed) {
      return PluginStatus.INSTALLED;
    }

    return PluginStatus.UNINSTALLED;
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): PluginInstance[] {
    return Array.from(this.pluginInstances.values());
  }

  /**
   * Get plugin instance
   */
  getPluginInstance(pluginId: string): PluginInstance | null {
    return this.pluginInstances.get(pluginId) ?? null;
  }

  /**
   * Check if plugin is loaded
   */
  isPluginLoaded(pluginId: string): boolean {
    return this.pluginInstances.has(pluginId);
  }

  /**
   * Get loaded plugin count
   */
  getLoadedPluginCount(): number {
    return this.pluginInstances.size;
  }

  /**
   * Create plugin instance (simplified version)
   */
  private createPluginInstance(registryEntry: any, startTime: number): PluginInstance {
    // This is a simplified version - in a real implementation, this would
    // coordinate with the runtime service to create the actual plugin instance

    const instance: PluginInstance = {
      id: registryEntry.id,
      metadata: {
        // Required properties from PluginMetadata interface
        id: registryEntry.id,
        name: registryEntry.name,
        status: PluginStatus.LOADING,
        loadTime: 0,
        memory: 0,
        cpu: 0,
        main: '', // Would be populated from manifest
        types: undefined,
        engines: registryEntry.engines || {},
        hooks: {},
        configuration: {},
        runtimeMetadata: {
          category: registryEntry.category || 'general',
          tags: registryEntry.tags || [],
          documentation: registryEntry.documentation,
          repository: registryEntry.repository,
        },
        // Properties from BasePluginMetadata
        pluginId: registryEntry.id,
        version: registryEntry.version,
        category: registryEntry.category || 'general',
        keywords: registryEntry.keywords || [],
        homepage: registryEntry.homepage,
        repository: registryEntry.repository,
        bugs: registryEntry.bugs,
        license: registryEntry.license,
        capabilities: registryEntry.capabilities || [],
        permissions: Array.isArray(registryEntry.permissions) ? registryEntry.permissions : [],
        dependencies: registryEntry.dependencies || {},
        peerDependencies: registryEntry.peerDependencies || {},
        devDependencies: registryEntry.devDependencies || {},
        size: registryEntry.size,
        downloadCount: registryEntry.downloadCount,
        rating: registryEntry.rating,
        verified: registryEntry.verified || false,
        featured: registryEntry.featured || false,
        deprecated: registryEntry.deprecated || false,
        createdBy: registryEntry.createdBy,
        updatedBy: registryEntry.updatedBy,
        author: registryEntry.author,
        maintainers: registryEntry.maintainers || [],
        previousVersion: registryEntry.previousVersion,
        versionChanges: registryEntry.versionChanges || [],
        security: registryEntry.security || {
          signed: false,
          verified: false,
        },
      },
      module: null, // Would be populated by runtime service
      context: {} as any, // Would be created by runtime service
      status: PluginStatus.LOADING,
      startTime: new Date(startTime),
      lastActivity: new Date(),
    };

    return instance;
  }

  /**
   * Create load failure result
   */
  private createLoadFailureResult(pluginId: string, loadTime: number, message: string): LoadResult {
    return {
      success: false,
      pluginId,
      loadTime,
      message,
      errors: [message],
    };
  }

  /**
   * Start all auto-start plugins
   */
  async startAutoStartPlugins(): Promise<void> {
    try {
      const allPlugins = this.registryService.getAllPlugins();
      const autoStartPlugins = allPlugins.filter((plugin) => plugin.status.installed && plugin.status.enabled);

      this.logger.log(`Starting ${autoStartPlugins.length} auto-start plugins`);

      const loadPromises = autoStartPlugins.map((plugin) =>
        this.loadPlugin(plugin.id).catch((error) => {
          this.logger.error(`Failed to auto-start plugin ${plugin.id}:`, error);
          return null;
        }),
      );

      await Promise.all(loadPromises);
    } catch (error) {
      this.logger.error('Failed to start auto-start plugins', error);
    }
  }

  /**
   * Stop all loaded plugins
   */
  async stopAllPlugins(): Promise<void> {
    try {
      const loadedPlugins = Array.from(this.pluginInstances.keys());

      this.logger.log(`Stopping ${loadedPlugins.length} loaded plugins`);

      const unloadPromises = loadedPlugins.map((pluginId) =>
        this.unloadPlugin(pluginId).catch((error) => {
          this.logger.error(`Failed to stop plugin ${pluginId}:`, error);
          return null;
        }),
      );

      await Promise.all(unloadPromises);
    } catch (error) {
      this.logger.error('Failed to stop all plugins', error);
    }
  }
}
