import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PluginManagerService } from '@/core/plugin-manager/plugin-manager.service';
import { PluginRegistryService } from '@/core/plugin-registry/plugin-registry.service';
import * as path from 'path';
import * as fs from 'fs-extra';
import { PluginStatus } from '@types';

@Injectable()
export class PluginBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginBootstrapService.name);

  constructor(
    private readonly pluginManager: PluginManagerService,
    private readonly registryService: PluginRegistryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Starting plugin system bootstrap...');

    try {
      // Discover existing plugins
      await this.discoverAndRegisterPlugins();

      // Auto-install and load sample plugin if not already installed
      await this.bootstrapSamplePlugin();

      this.logger.log('Plugin system bootstrap completed successfully');
    } catch (error) {
      this.logger.error('Plugin system bootstrap failed', error);
    }
  }

  private async discoverAndRegisterPlugins(): Promise<void> {
    try {
      const discovered = await this.registryService.discoverPlugins();
      this.logger.log(`Discovered ${discovered.length} existing plugins`);

      if (discovered.length === 0) return;

      // Filter out already registered plugins and register new ones
      const newPlugins = discovered.filter((plugin) => !this.registryService.getPlugin(plugin.id));

      if (newPlugins.length === 0) {
        this.logger.log('All discovered plugins are already registered');
        return;
      }

      const registrationPromises = newPlugins.map(async (plugin) => {
        try {
          await this.registryService.registerPlugin(plugin);
          this.logger.log(`Registered discovered plugin: ${plugin.name}@${plugin.version}`);
          return { success: true, plugin };
        } catch (error) {
          this.logger.warn(`Failed to register plugin ${plugin.name}`, error);
          return { success: false, plugin, error };
        }
      });

      const results = await Promise.allSettled(registrationPromises);
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;

      this.logger.log(`Successfully registered ${successful}/${newPlugins.length} new plugins`);
    } catch (error) {
      this.logger.error('Failed to discover and register plugins', error);
    }
  }

  private async bootstrapSamplePlugin(): Promise<void> {
    const samplePluginPath = path.join(process.cwd(), 'src', 'plugins', 'templates', 'sample-plugin');
    const samplePluginId = 'sample-plugin@1.0.0';

    try {
      // Check if sample plugin exists
      if (!(await fs.pathExists(samplePluginPath))) {
        this.logger.warn('Sample plugin template not found, skipping bootstrap');
        return;
      }

      // Check if already installed
      const existingPlugin = this.registryService.getPlugin(samplePluginId);
      if (existingPlugin?.status.installed) {
        this.logger.log('Sample plugin already installed, attempting to load...');

        // Try to load if not already loaded
        const pluginStatus = this.pluginManager.getPluginStatus(samplePluginId);
        if (pluginStatus !== PluginStatus.LOADED && pluginStatus !== PluginStatus.RUNNING) {
          const loadResult = await this.pluginManager.loadPlugin(samplePluginId);
          if (loadResult.success) {
            this.logger.log(`Sample plugin loaded successfully: ${loadResult.loadTime}ms`);
          } else {
            this.logger.warn(`Failed to load sample plugin: ${loadResult.message}`);
          }
        } else {
          this.logger.log('Sample plugin is already loaded');
        }
        return;
      }

      this.logger.log('Installing sample plugin for demonstration...');

      // Install sample plugin
      const installResult = await this.pluginManager.installPlugin({
        type: 'file',
        location: samplePluginPath,
      });

      if (!installResult.success) {
        this.logger.error(`Failed to install sample plugin: ${installResult.message}`);
        return;
      }

      this.logger.log(`Sample plugin installed: ${installResult.pluginId}`);

      // Load sample plugin
      const loadResult = await this.pluginManager.loadPlugin(installResult.pluginId);
      if (loadResult.success) {
        this.logger.log(`Sample plugin loaded successfully: ${loadResult.loadTime}ms`);
        this.logger.log(`Sample plugin API available at: /api/v1/sample`);
      } else {
        this.logger.warn(`Failed to load sample plugin: ${loadResult.message}`);
      }
    } catch (error) {
      this.logger.error('Failed to bootstrap sample plugin', error);
    }
  }

  getBootstrapStatus(): {
    pluginSystemReady: boolean;
    samplePluginInstalled: boolean;
    samplePluginLoaded: boolean;
    totalPlugins: number;
    loadedPlugins: number;
  } {
    const samplePluginId = 'sample-plugin@1.0.0';
    const samplePlugin = this.registryService.getPlugin(samplePluginId);
    const samplePluginStatus = this.pluginManager.getPluginStatus(samplePluginId);

    const allPlugins = this.registryService.getAllPlugins();
    const loadedPlugins = this.pluginManager.getLoadedPlugins();

    return {
      pluginSystemReady: true,
      samplePluginInstalled: samplePlugin?.status.installed ?? false,
      samplePluginLoaded: samplePluginStatus === PluginStatus.LOADED || samplePluginStatus === PluginStatus.RUNNING,
      totalPlugins: allPlugins.length,
      loadedPlugins: loadedPlugins.length,
    };
  }
}
