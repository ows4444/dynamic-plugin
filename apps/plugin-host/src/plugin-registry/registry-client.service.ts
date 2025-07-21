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
  metadata: Record<string, unknown>;
}

@Injectable()
export class RegistryClientService {
  private readonly logger = new Logger(RegistryClientService.name);
  private readonly registryUrl =
    process.env.PLUGIN_REGISTRY_URL ?? 'http://localhost:3001';

  constructor(
    private readonly downloadService: DownloadService,
    private readonly metadataService: MetadataService,
  ) {}

  async searchPlugins(query?: string): Promise<RegistryPlugin[]> {
    this.logger.log(`Searching plugins in registry: ${query ?? 'all'}`);

    try {
      // For now, return mock data since we don't have HTTP client setup
      const mockPlugins: RegistryPlugin[] = [
        {
          id: 'payment-plugin',
          name: 'Payment Plugin',
          version: '1.0.0',
          description: 'Payment processing plugin',
          author: 'Plugin Author',
          downloadUrl: `${this.registryUrl}/api/plugins/payment-plugin/download`,
          metadata: {},
        },
      ];

      this.logger.log(`Found ${mockPlugins.length} plugins in registry`);
      return Promise.resolve(mockPlugins);
    } catch (error) {
      this.logger.error(`Failed to search plugins: ${error.message}`);
      throw error;
    }
  }

  async getPlugin(pluginId: string): Promise<RegistryPlugin> {
    this.logger.log(`Getting plugin from registry: ${pluginId}`);

    try {
      // Return mock plugin data
      const plugin: RegistryPlugin = {
        id: pluginId,
        name: `${pluginId} Plugin`,
        version: '1.0.0',
        description: `Mock plugin: ${pluginId}`,
        author: 'Plugin Author',
        downloadUrl: `${this.registryUrl}/api/plugins/${pluginId}/download`,
        metadata: {},
      };

      this.logger.log(`Retrieved plugin: ${plugin.name}@${plugin.version}`);
      return Promise.resolve(plugin);
    } catch (error) {
      this.logger.error(`Failed to get plugin ${pluginId}: ${error.message}`);
      throw error;
    }
  }

  async downloadPlugin(pluginId: string, version?: string): Promise<string> {
    this.logger.log(`Downloading plugin: ${pluginId}@${version ?? 'latest'}`);

    try {
      // Get plugin metadata
      const plugin = await this.getPlugin(pluginId);

      // Use specific version if provided
      const targetVersion = version ?? plugin.version;
      const downloadUrl = `${this.registryUrl}/api/plugins/${pluginId}/download?version=${targetVersion}`;

      // Download the plugin package
      const localPath = await this.downloadService.downloadPackage(
        downloadUrl,
        pluginId,
        targetVersion,
      );

      this.logger.log(`Plugin downloaded to: ${localPath}`);
      return localPath;
    } catch (error) {
      this.logger.error(
        `Failed to download plugin ${pluginId}: ${error.message}`,
      );
      throw error;
    }
  }

  async getPluginVersions(pluginId: string): Promise<string[]> {
    this.logger.log(`Getting versions for plugin: ${pluginId}`);

    try {
      const response = await fetch(
        `${this.registryUrl}/api/plugins/${pluginId}/versions`,
      );
      if (!response.ok) {
        throw new Error(`Failed to get versions for plugin: ${pluginId}`);
      }

      const versions = await response.json() as string[];
      this.logger.log(
        `Found ${versions.length} versions for plugin: ${pluginId}`,
      );

      return versions;
    } catch (error) {
      this.logger.error(
        `Failed to get versions for plugin ${pluginId}: ${error.message}`,
      );
      throw error;
    }
  }

  async publishPlugin(packagePath: string): Promise<void> {
    this.logger.log(`Publishing plugin package: ${packagePath}`);

    try {
      // Extract metadata from package
      const metadata =
        await this.metadataService.extractFromPackage(packagePath);

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

      this.logger.log(
        `Plugin published successfully: ${metadata.name}@${metadata.version}`,
      );
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
