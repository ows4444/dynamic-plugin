import { Injectable } from '@nestjs/common';
import { PluginRepositoryPort } from '../ports/plugin.repository.port';
import { PluginDomain, PluginId, PluginManifest, PluginVersion } from '../domain/plugin.domain';
import { PluginStatus } from '../common/interfaces/plugin.interface';
import * as fs from 'fs-extra';
import * as path from 'path';

interface PluginMetadata {
  id: string;
  manifest: {
    name: string;
    version: string;
    description: string;
    author: string;
    main: string;
    dependencies: string[];
    permissions: string[];
  };
  status: PluginStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class PluginRepositoryAdapter implements PluginRepositoryPort {
  private readonly pluginsDirectory = './plugins';
  private readonly metadataFile = './plugin-metadata.json';

  async save(plugin: PluginDomain): Promise<void> {
    const metadata = await this.loadMetadata();
    
    metadata[plugin.getId().value] = {
      id: plugin.getId().value,
      manifest: {
        name: plugin.getManifest().name,
        version: plugin.getManifest().version.value,
        description: plugin.getManifest().description,
        author: plugin.getManifest().author,
        main: plugin.getManifest().main,
        dependencies: plugin.getManifest().dependencies,
        permissions: plugin.getManifest().permissions
      },
      status: plugin.getStatus(),
      createdAt: plugin.getCreatedAt().toISOString(),
      updatedAt: plugin.getUpdatedAt().toISOString()
    };

    await this.saveMetadata(metadata);
  }

  async findById(id: PluginId): Promise<PluginDomain | null> {
    const metadata = await this.loadMetadata();
    const pluginData = metadata[id.value];
    
    if (!pluginData) {
      return null;
    }

    const manifest = new PluginManifest(
      pluginData.manifest.name,
      new PluginVersion(pluginData.manifest.version),
      pluginData.manifest.description,
      pluginData.manifest.author,
      pluginData.manifest.main,
      pluginData.manifest.dependencies,
      pluginData.manifest.permissions
    );

    return PluginDomain.restore(
      id,
      manifest,
      pluginData.status,
      new Date(pluginData.createdAt),
      new Date(pluginData.updatedAt)
    );
  }

  async findAll(): Promise<PluginDomain[]> {
    const metadata = await this.loadMetadata();
    const plugins = [];

    for (const [idValue, pluginData] of Object.entries(metadata)) {
      const typedPluginData = pluginData;
      const id = new PluginId(idValue);
      const manifest = new PluginManifest(
        typedPluginData.manifest.name,
        new PluginVersion(typedPluginData.manifest.version),
        typedPluginData.manifest.description,
        typedPluginData.manifest.author,
        typedPluginData.manifest.main,
        typedPluginData.manifest.dependencies,
        typedPluginData.manifest.permissions
      );

      const plugin = PluginDomain.restore(
        id,
        manifest,
        typedPluginData.status,
        new Date(typedPluginData.createdAt),
        new Date(typedPluginData.updatedAt)
      );

      plugins.push(plugin);
    }

    return plugins;
  }

  async findByStatus(status: string): Promise<PluginDomain[]> {
    const allPlugins = await this.findAll();
    return allPlugins.filter(plugin => plugin.getStatus() === status);
  }

  async delete(id: PluginId): Promise<void> {
    const metadata = await this.loadMetadata();
    delete metadata[id.value];
    await this.saveMetadata(metadata);

    // Also remove plugin directory if it exists
    const pluginPath = path.join(this.pluginsDirectory, id.value);
    if (await fs.pathExists(pluginPath)) {
      await fs.remove(pluginPath);
    }
  }

  async exists(id: PluginId): Promise<boolean> {
    const metadata = await this.loadMetadata();
    return id.value in metadata;
  }

  private async loadMetadata(): Promise<Record<string, PluginMetadata>> {
    try {
      if (await fs.pathExists(this.metadataFile)) {
        return await fs.readJson(this.metadataFile);
      }
      return {};
    } catch (error) {
      return {};
    }
  }

  private async saveMetadata(metadata: Record<string, PluginMetadata>): Promise<void> {
    await fs.writeJson(this.metadataFile, metadata, { spaces: 2 });
  }
}