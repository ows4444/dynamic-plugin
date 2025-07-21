import { Injectable, Logger } from '@nestjs/common';
import { DownloadService } from './download.service';
import { MetadataService } from './metadata.service';

export interface RegistryPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloadUrl: string;
  metadata: any;
}

@Injectable()
export class RegistryClientService {
  private readonly logger = new Logger(RegistryClientService.name);
  private readonly registryUrl = process.env.PLUGIN_REGISTRY_URL || 'http://localhost:3001';

  constructor(
    private readonly downloadService: DownloadService,
    private readonly metadataService: MetadataService,
  ) {}

  async searchPlugins(query?: string): Promise<RegistryPlugin[]> {
    this.logger.log(`Searching plugins in registry: ${query || 'all'}`);

    try {
      const url = query 
        ? `${this.registryUrl}/api/plugins?search=${encodeURIComponent(query)}`
        : `${this.registryUrl}/api/plugins`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Registry request failed: ${response.statusText}`);
      }

      const plugins: RegistryPlugin[] = await response.json();
      this.logger.log(`Found ${plugins.length} plugins in registry`);
      
      return plugins;
    } catch (error) {
      this.logger.error(`Failed to search plugins: ${error.message}`);
      throw error;
    }
  }

  async getPlugin(pluginId: string): Promise<RegistryPlugin> {
    this.logger.log(`Getting plugin from registry: ${pluginId}`);

    try {
      const response = await fetch(`${this.registryUrl}/api/plugins/${pluginId}`);
      if (!response.ok) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      const plugin: RegistryPlugin = await response.json();
      this.logger.log(`Retrieved plugin: ${plugin.name}@${plugin.version}`);
      
      return plugin;
    } catch (error) {
      this.logger.error(`Failed to get plugin ${pluginId}: ${error.message}`);
      throw error;
    }
  }

  async downloadPlugin(pluginId: string, version?: string): Promise<string> {
    this.logger.log(`Downloading plugin: ${pluginId}@${version || 'latest'}`);

    try {
      // Get plugin metadata
      const plugin = await this.getPlugin(pluginId);
      
      // Use specific version if provided
      const targetVersion = version || plugin.version;
      const downloadUrl = `${this.registryUrl}/api/plugins/${pluginId}/download?version=${targetVersion}`;
      
      // Download the plugin package
      const localPath = await this.downloadService.downloadPackage(downloadUrl, pluginId, targetVersion);
      
      this.logger.log(`Plugin downloaded to: ${localPath}`);
      return localPath;
    } catch (error) {
      this.logger.error(`Failed to download plugin ${pluginId}: ${error.message}`);
      throw error;
    }
  }

  async getPluginVersions(pluginId: string): Promise<string[]> {
    this.logger.log(`Getting versions for plugin: ${pluginId}`);

    try {
      const response = await fetch(`${this.registryUrl}/api/plugins/${pluginId}/versions`);
      if (!response.ok) {
        throw new Error(`Failed to get versions for plugin: ${pluginId}`);
      }

      const versions: string[] = await response.json();
      this.logger.log(`Found ${versions.length} versions for plugin: ${pluginId}`);
      
      return versions;
    } catch (error) {
      this.logger.error(`Failed to get versions for plugin ${pluginId}: ${error.message}`);
      throw error;
    }
  }

  async publishPlugin(packagePath: string): Promise<void> {
    this.logger.log(`Publishing plugin package: ${packagePath}`);

    try {
      // Extract metadata from package
      const metadata = await this.metadataService.extractFromPackage(packagePath);
      
      // Create form data for upload
      const formData = new FormData();
      formData.append('package', new Blob([]), packagePath);
      formData.append('metadata', JSON.stringify(metadata));

      const response = await fetch(`${this.registryUrl}/api/plugins/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to publish plugin: ${response.statusText}`);
      }

      this.logger.log(`Plugin published successfully: ${metadata.name}@${metadata.version}`);
    } catch (error) {
      this.logger.error(`Failed to publish plugin: ${error.message}`);
      throw error;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.registryUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}