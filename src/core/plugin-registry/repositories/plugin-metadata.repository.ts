import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { PluginDependency, PluginMetadata, PluginRegistry, PluginRegistryEntry, PluginStats, PluginStatus } from '@types';

/**
 * Repository for managing plugin metadata persistence and retrieval
 */
@Injectable()
export class PluginMetadataRepository {
  private readonly logger = new Logger(PluginMetadataRepository.name);
  private readonly registry: PluginRegistry;
  private readonly registryPath: string;

  constructor() {
    this.registryPath = path.join(process.cwd(), 'src', 'plugins', 'registry');
    this.registry = {
      plugins: new Map(),
      categories: new Map(),
      dependencies: new Map(),
    };
  }

  /**
   * Initialize the repository and load existing data
   */
  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.registryPath);
      await this.loadRegistryFromDisk();
      this.logger.log('Plugin metadata repository initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize plugin metadata repository', error);
      throw error;
    }
  }

  /**
   * Load registry data from disk
   */
  private async loadRegistryFromDisk(): Promise<void> {
    const registryFile = path.join(this.registryPath, 'plugins.json');

    if (await fs.pathExists(registryFile)) {
      try {
        const data = (await fs.readJson(registryFile)) as PluginRegistry;

        if (data.plugins) {
          for (const [id, entry] of Object.entries(data.plugins)) {
            this.registry.plugins.set(id, entry as PluginRegistryEntry);
          }
        }

        if (data.categories) {
          for (const [category, plugins] of Object.entries(data.categories)) {
            this.registry.categories.set(category, plugins as string[]);
          }
        }

        if (data.dependencies) {
          for (const [plugin, deps] of Object.entries(data.dependencies)) {
            this.registry.dependencies.set(plugin, deps as string[]);
          }
        }

        this.logger.log(`Loaded ${this.registry.plugins.size} plugins from registry`);
      } catch (error) {
        this.logger.error('Failed to load registry from disk', error);
      }
    }
  }

  /**
   * Save registry data to disk
   */
  private async saveRegistryToDisk(): Promise<void> {
    const registryFile = path.join(this.registryPath, 'plugins.json');

    const data = {
      plugins: Object.fromEntries(this.registry.plugins),
      categories: Object.fromEntries(this.registry.categories),
      dependencies: Object.fromEntries(this.registry.dependencies),
      lastUpdated: new Date().toISOString(),
    };

    try {
      await fs.writeJson(registryFile, data, { spaces: 2 });
      this.logger.debug('Registry saved to disk');
    } catch (error) {
      this.logger.error('Failed to save registry to disk', error);
      throw error;
    }
  }

  /**
   * Register a plugin in the repository
   */
  async registerPlugin(plugin: PluginMetadata): Promise<void> {
    // Input validation
    if (!plugin?.id || !plugin?.name || !plugin?.version) {
      throw new Error('Plugin metadata is incomplete - id, name, and version are required');
    }

    // Check for duplicate registration
    if (this.registry.plugins.has(plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`);
    }

    try {
      const entry: PluginRegistryEntry = {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description || '',
        author: plugin.author || '',
        license: plugin.license,
        category: (plugin.metadata as any)?.category || 'general',
        tags: (plugin.metadata as any)?.tags || [],
        capabilities: plugin.capabilities,
        permissions: typeof plugin.permissions === 'object' && !Array.isArray(plugin.permissions) 
          ? plugin.permissions 
          : { general: Array.isArray(plugin.permissions) ? plugin.permissions : [] },
        dependencies: plugin.dependencies || {},
        pluginDependencies: Array.isArray(plugin.pluginDependencies) 
          ? plugin.pluginDependencies 
          : Object.entries(plugin.pluginDependencies || {}).map(([name, version]) => ({
              name,
              version: typeof version === 'object' ? (version as any).version : version,
              required: typeof version === 'object' ? (version as any).required !== false : true,
            })),
        engines: plugin.engines,
        status: {
          installed: true,
          enabled: plugin.status === PluginStatus.RUNNING,
          version: plugin.version,
          installDate: new Date(),
          lastUsed: new Date(),
        },
        downloadCount: 0,
        rating: 0,
        reviews: 0,
        lastUpdated: new Date(),
        createdAt: new Date(),
        repository: (plugin.metadata as any)?.repository || '',
        documentation: (plugin.metadata as any)?.documentation || '',
        size: 0,
        checksum: '',
        verified: false,
      };

      this.registry.plugins.set(plugin.id, entry);

      // Update category mapping
      const category = (plugin.metadata as any)?.category || 'general';
      if (!this.registry.categories.has(category)) {
        this.registry.categories.set(category, []);
      }
      this.registry.categories.get(category)?.push(plugin.id);

      // Update dependency mapping
      const deps = plugin.dependencies ? Object.keys(plugin.dependencies) : [];
      this.registry.dependencies.set(plugin.id, deps);

      await this.saveRegistryToDisk();
    } catch (error) {
      this.logger.error(`Failed to register plugin: ${plugin.name}`, error);
      throw error;
    }
  }

  /**
   * Unregister a plugin from the repository
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    try {
      const entry = this.registry.plugins.get(pluginId);
      if (!entry) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      this.registry.plugins.delete(pluginId);

      // Remove from category mapping
      const categoryPlugins = this.registry.categories.get(entry.category);
      if (categoryPlugins) {
        const index = categoryPlugins.indexOf(pluginId);
        if (index > -1) {
          categoryPlugins.splice(index, 1);
        }
      }

      // Remove from dependency mapping
      this.registry.dependencies.delete(pluginId);

      await this.saveRegistryToDisk();
    } catch (error) {
      this.logger.error(`Failed to unregister plugin: ${pluginId}`, error);
      throw error;
    }
  }

  /**
   * Get a plugin by ID
   */
  getPlugin(pluginId: string): PluginRegistryEntry | null {
    return this.registry.plugins.get(pluginId) ?? null;
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): PluginRegistryEntry[] {
    return Array.from(this.registry.plugins.values());
  }

  /**
   * Get plugins by category
   */
  getPluginsByCategory(category: string): PluginRegistryEntry[] {
    const pluginIds = this.registry.categories.get(category) ?? [];
    return pluginIds.map((id) => this.registry.plugins.get(id)).filter((plugin): plugin is PluginRegistryEntry => Boolean(plugin));
  }

  /**
   * Get plugin dependencies
   */
  getPluginDependencies(pluginId: string): PluginDependency[] {
    const entry = this.registry.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    return entry.pluginDependencies;
  }

  /**
   * Update plugin status
   */
  async updatePluginStatus(pluginId: string, status: Partial<PluginRegistryEntry['status']>): Promise<void> {
    const entry = this.registry.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    entry.status = { ...entry.status, ...status };
    await this.saveRegistryToDisk();
  }

  /**
   * Get plugin statistics
   */
  getPluginStats(): PluginStats {
    const plugins = Array.from(this.registry.plugins.values());

    const totalPlugins = plugins.length;
    const installedPlugins = plugins.filter((p) => p.status.installed).length;
    const enabledPlugins = plugins.filter((p) => p.status.enabled).length;
    const categoriesCount = this.registry.categories.size;

    const averageRating = totalPlugins > 0 ? plugins.reduce((sum, p) => sum + p.rating, 0) / totalPlugins : 0;
    const totalDownloads = plugins.reduce((sum, p) => sum + p.downloadCount, 0);

    // Top categories by plugin count
    const categoryStats = new Map<string, number>();
    plugins.forEach((p) => {
      categoryStats.set(p.category, (categoryStats.get(p.category) ?? 0) + 1);
    });
    const topCategories = Array.from(categoryStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    // Top authors by plugin count
    const authorStats = new Map<string, number>();
    plugins.forEach((p) => {
      authorStats.set(p.author, (authorStats.get(p.author) ?? 0) + 1);
    });
    const topAuthors = Array.from(authorStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([author, count]) => ({ author, count }));

    // Recently updated (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentlyUpdated = plugins
      .filter((p) => p.lastUpdated > thirtyDaysAgo)
      .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
      .slice(0, 10);

    // Most popular by downloads
    const mostPopular = plugins.sort((a, b) => b.downloadCount - a.downloadCount).slice(0, 10);

    return {
      totalPlugins,
      installedPlugins,
      enabledPlugins,
      categoriesCount,
      averageRating,
      totalDownloads,
      topCategories,
      topAuthors,
      recentlyUpdated,
      mostPopular,
    };
  }

  /**
   * Get all plugin IDs by category
   */
  getPluginIdsByCategory(category: string): string[] {
    return this.registry.categories.get(category) ?? [];
  }

  /**
   * Get all categories
   */
  getAllCategories(): string[] {
    return Array.from(this.registry.categories.keys());
  }

  /**
   * Get registry metadata for debugging
   */
  getRegistryMetadata() {
    return {
      pluginCount: this.registry.plugins.size,
      categoryCount: this.registry.categories.size,
      dependencyCount: this.registry.dependencies.size,
    };
  }
}
