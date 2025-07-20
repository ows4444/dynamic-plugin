import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { PluginManifest, PluginMetadata, PluginStatus } from '@types';

/**
 * Service for discovering plugins in the system
 */
@Injectable()
export class PluginDiscoveryService {
  private readonly logger = new Logger(PluginDiscoveryService.name);

  /**
   * Discover all plugins in the installed directory
   */
  async discoverPlugins(): Promise<PluginMetadata[]> {
    const installedPath = path.join(process.cwd(), 'src', 'plugins', 'installed');
    const discovered: PluginMetadata[] = [];

    try {
      await fs.ensureDir(installedPath);
      const pluginDirs = await fs.readdir(installedPath);

      const pluginPromises = pluginDirs.map(async (pluginDir) => {
        const pluginPath = path.join(installedPath, pluginDir);
        const manifestPath = path.join(pluginPath, 'plugin.manifest.json');

        if (await fs.pathExists(manifestPath)) {
          try {
            const manifest = (await fs.readJson(manifestPath)) as PluginManifest;
            const metadata = this.manifestToMetadata(manifest, pluginPath);

            this.logger.debug(`Discovered plugin: ${manifest.name}@${manifest.version}`);
            return metadata;
          } catch (error) {
            this.logger.warn(`Failed to load plugin manifest: ${pluginDir}`, error);
            return null;
          }
        }
        return null;
      });

      const results = await Promise.all(pluginPromises);
      discovered.push(...results.filter((metadata): metadata is PluginMetadata => metadata !== null));

      this.logger.log(`Discovered ${discovered.length} plugins`);
      return discovered;
    } catch (error) {
      this.logger.error('Failed to discover plugins', error);
      throw error;
    }
  }

  /**
   * Discover plugins in a specific directory
   */
  async discoverPluginsInDirectory(directoryPath: string): Promise<PluginMetadata[]> {
    const discovered: PluginMetadata[] = [];

    try {
      if (!(await fs.pathExists(directoryPath))) {
        this.logger.warn(`Directory does not exist: ${directoryPath}`);
        return discovered;
      }

      const items = await fs.readdir(directoryPath);

      const pluginPromises = items.map(async (item) => {
        const itemPath = path.join(directoryPath, item);
        const stats = await fs.stat(itemPath);

        if (!stats.isDirectory()) {
          return null;
        }

        const manifestPath = path.join(itemPath, 'plugin.manifest.json');

        if (!(await fs.pathExists(manifestPath))) {
          return null;
        }

        try {
          const manifest = (await fs.readJson(manifestPath)) as PluginManifest;
          const metadata = this.manifestToMetadata(manifest, itemPath);

          this.logger.debug(`Discovered plugin: ${manifest.name}@${manifest.version} in ${directoryPath}`);
          return metadata;
        } catch (error) {
          this.logger.warn(`Failed to load plugin manifest: ${item}`, error);
          return null;
        }
      });

      const results = await Promise.all(pluginPromises);
      discovered.push(...results.filter((metadata): metadata is PluginMetadata => metadata !== null));

      this.logger.log(`Discovered ${discovered.length} plugins in ${directoryPath}`);
      return discovered;
    } catch (error) {
      this.logger.error(`Failed to discover plugins in directory: ${directoryPath}`, error);
      throw error;
    }
  }

  /**
   * Check if a directory contains a valid plugin
   */
  async isValidPluginDirectory(directoryPath: string): Promise<boolean> {
    try {
      const manifestPath = path.join(directoryPath, 'plugin.manifest.json');

      if (!(await fs.pathExists(manifestPath))) {
        return false;
      }

      const manifest = (await fs.readJson(manifestPath)) as PluginManifest;

      // Basic validation
      return Boolean(manifest.name && manifest.version && manifest.main && typeof manifest.name === 'string' && typeof manifest.version === 'string' && typeof manifest.main === 'string');
    } catch (error) {
      this.logger.debug(`Invalid plugin directory: ${directoryPath}`, error);
      return false;
    }
  }

  /**
   * Get plugin manifest from a directory
   */
  async getPluginManifest(pluginPath: string): Promise<PluginManifest | null> {
    try {
      const manifestPath = path.join(pluginPath, 'plugin.manifest.json');

      if (!(await fs.pathExists(manifestPath))) {
        return null;
      }

      return (await fs.readJson(manifestPath)) as PluginManifest;
    } catch (error) {
      this.logger.error(`Failed to read plugin manifest from ${pluginPath}`, error);
      return null;
    }
  }

  /**
   * Convert manifest to metadata format
   */
  private manifestToMetadata(manifest: PluginManifest, _pluginPath: string): PluginMetadata {
    return {
      id: `${manifest.name}@${manifest.version}`,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      license: manifest.license,
      status: PluginStatus.INSTALLED,
      capabilities: manifest.capabilities,
      permissions: manifest.permissions,
      dependencies: manifest.dependencies,
      pluginDependencies: manifest.pluginDependencies,
      loadTime: 0,
      memory: 0,
      cpu: 0,
      main: manifest.main,
      types: manifest.types,
      engines: manifest.engines,
      hooks: manifest.hooks,
      configuration: manifest.configuration,
      metadata: manifest.metadata,
    };
  }

  /**
   * Scan for new plugins and return only those not already discovered
   */
  async scanForNewPlugins(existingPluginIds: string[]): Promise<PluginMetadata[]> {
    try {
      const allDiscovered = await this.discoverPlugins();

      const newPlugins = allDiscovered.filter((plugin) => !existingPluginIds.includes(plugin.id));

      this.logger.log(`Found ${newPlugins.length} new plugins out of ${allDiscovered.length} total`);
      return newPlugins;
    } catch (error) {
      this.logger.error('Failed to scan for new plugins', error);
      throw error;
    }
  }

  /**
   * Get plugin metadata by scanning a specific plugin directory
   */
  async getPluginMetadata(pluginPath: string): Promise<PluginMetadata | null> {
    try {
      const manifest = await this.getPluginManifest(pluginPath);

      if (!manifest) {
        return null;
      }

      return this.manifestToMetadata(manifest, pluginPath);
    } catch (error) {
      this.logger.error(`Failed to get plugin metadata from ${pluginPath}`, error);
      return null;
    }
  }
}
