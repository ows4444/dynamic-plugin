import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { InstallationResult, LoadResult, PluginInstance, PluginSource, ReloadResult, UnloadResult, UpdateResult } from '@/types/plugin.types';
import { PluginStatus } from '@/types/plugin.types';
import { PluginRegistryService } from '@/core/plugin-registry/plugin-registry.service';
import { PluginInstallerService } from './services/plugin-installer.service';
import { PluginLifecycleService } from './services/plugin-lifecycle.service';

/**
 * Enhanced Plugin Manager Service
 *
 * Orchestrates plugin operations by delegating to specialized services.
 * Provides a unified interface for plugin management operations.
 */
@Injectable()
export class PluginManagerService {
  private readonly logger = new Logger(PluginManagerService.name);

  constructor(
    private readonly registryService: PluginRegistryService,
    private readonly eventEmitter: EventEmitter2,
    private readonly installerService: PluginInstallerService,
    private readonly lifecycleService: PluginLifecycleService,
  ) {
    this.initialize();
  }

  /**
   * Initialize the plugin manager
   */
  private initialize(): void {
    try {
      this.logger.log('Plugin manager initialized successfully');

      // Emit initialization event
      this.eventEmitter.emit('plugin.manager.initialized', {
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to initialize plugin manager', error);
      throw error;
    }
  }

  /**
   * Install a plugin from a source
   */
  async installPlugin(source: PluginSource): Promise<InstallationResult> {
    try {
      return await this.installerService.installPlugin(source);
    } catch (error) {
      this.logger.error('Plugin installation failed', error);
      throw error;
    }
  }

  /**
   * Load a plugin
   */
  async loadPlugin(pluginId: string): Promise<LoadResult> {
    try {
      return await this.lifecycleService.loadPlugin(pluginId);
    } catch (error) {
      this.logger.error('Plugin loading failed', error);
      throw error;
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<UnloadResult> {
    try {
      return await this.lifecycleService.unloadPlugin(pluginId);
    } catch (error) {
      this.logger.error('Plugin unloading failed', error);
      throw error;
    }
  }

  /**
   * Reload a plugin
   */
  async reloadPlugin(pluginId: string): Promise<ReloadResult> {
    try {
      return await this.lifecycleService.reloadPlugin(pluginId);
    } catch (error) {
      this.logger.error('Plugin reloading failed', error);
      throw error;
    }
  }

  /**
   * Update a plugin to a new version
   */
  updatePlugin(pluginId: string, version: string): UpdateResult {
    try {
      this.logger.log(`Updating plugin: ${pluginId} to version ${version}`);

      // This would implement plugin update logic
      // For now, we'll just return a placeholder
      throw new Error('Plugin updates not yet implemented');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Plugin update failed: ${errorMessage}`, error);

      return {
        success: false,
        pluginId,
        fromVersion: '',
        toVersion: version,
        message: errorMessage,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Get plugin status
   */
  getPluginStatus(pluginId: string): PluginStatus {
    return this.lifecycleService.getPluginStatus(pluginId);
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): PluginInstance[] {
    return this.lifecycleService.getLoadedPlugins();
  }

  /**
   * Get plugin instance
   */
  getPluginInstance(pluginId: string): PluginInstance | null {
    return this.lifecycleService.getPluginInstance(pluginId);
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<boolean> {
    try {
      // Unload if loaded
      if (this.lifecycleService.isPluginLoaded(pluginId)) {
        const unloadResult = await this.unloadPlugin(pluginId);
        if (!unloadResult.success) {
          this.logger.warn(`Failed to unload plugin during uninstall: ${unloadResult.message}`);
        }
      }

      return await this.installerService.uninstallPlugin(pluginId);
    } catch (error) {
      this.logger.error('Plugin uninstallation failed', error);
      return false;
    }
  }
}
