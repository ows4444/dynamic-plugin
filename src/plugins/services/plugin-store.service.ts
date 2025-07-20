import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs-extra';
import * as path from 'path';
import { PluginMetadata, PluginStatus, PluginStoreEntry, PluginStoreQuery, PluginStoreResult } from '@types';

/**
 * Plugin Store Service - Manages plugin marketplace and remote repositories
 */
@Injectable()
export class PluginStoreService {
  private readonly logger = new Logger(PluginStoreService.name);
  private readonly storeCache = new Map<string, PluginStoreEntry[]>();
  private readonly defaultStores = [
    {
      id: 'official',
      name: 'Official Plugin Store',
      url: 'https://plugins.nestjs.com/api/v1',
      priority: 1,
      trusted: true,
    },
    {
      id: 'community',
      name: 'Community Plugin Store',
      url: 'https://community-plugins.nestjs.com/api/v1',
      priority: 2,
      trusted: false,
    },
  ];

  constructor(private readonly eventEmitter: EventEmitter2) {
    void this.initialize();
  }

  /**
   * Initialize the plugin store service
   */
  private async initialize(): Promise<void> {
    try {
      await this.loadStoreConfigurations();
      this.refreshStoreCache();
      this.logger.log('Plugin store service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize plugin store service', error);
    }
  }

  /**
   * Search for plugins in available stores
   */
  searchPlugins(query: PluginStoreQuery): PluginStoreResult {
    try {
      const results: PluginStoreEntry[] = [];

      for (const store of this.defaultStores) {
        try {
          const storeResults = this.searchInStore(store.id, query);
          results.push(...storeResults);
        } catch (error) {
          this.logger.warn(`Failed to search in store ${store.name}:`, error);
        }
      }

      // Sort by relevance and store priority
      const sortedResults = results.sort((a, b) => {
        const scoreDiff = (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return a.store.priority - b.store.priority;
      });

      const paginatedResults = this.paginateResults(sortedResults, query.page, query.limit);

      this.eventEmitter.emit('plugin.store.searched', {
        query,
        totalResults: results.length,
        stores: this.defaultStores.map((s) => s.id),
        timestamp: new Date(),
      });

      return {
        plugins: paginatedResults,
        total: results.length,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        hasMore: (query.page ?? 1) * (query.limit ?? 20) < results.length,
        stores: this.defaultStores.map((s) => ({
          id: s.id,
          name: s.name,
          status: 'connected',
        })),
      };
    } catch (error) {
      this.logger.error('Plugin store search failed:', error);
      throw error;
    }
  }

  /**
   * Get plugin details from store
   */
  getPluginDetails(pluginId: string, version?: string): PluginStoreEntry | null {
    try {
      for (const store of this.defaultStores) {
        try {
          const plugin = this.getPluginFromStore(store.id, pluginId, version);
          if (plugin) {
            this.eventEmitter.emit('plugin.store.details.fetched', {
              pluginId,
              version,
              storeId: store.id,
              timestamp: new Date(),
            });
            return plugin;
          }
        } catch (error) {
          this.logger.warn(`Failed to get plugin from store ${store.name}:`, error);
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get plugin details for ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Get featured plugins
   */
  getFeaturedPlugins(limit = 10): PluginStoreEntry[] {
    try {
      const featured: PluginStoreEntry[] = [];

      for (const store of this.defaultStores) {
        try {
          const storeEntries = this.storeCache.get(store.id) ?? [];
          const storeFeatured = storeEntries
            .filter((entry) => entry.featured)
            .sort((a, b) => (b.downloadCount ?? 0) - (a.downloadCount ?? 0))
            .slice(0, Math.ceil(limit / this.defaultStores.length));

          featured.push(...storeFeatured);
        } catch (error) {
          this.logger.warn(`Failed to get featured plugins from ${store.name}:`, error);
        }
      }

      return featured.slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get featured plugins:', error);
      return [];
    }
  }

  /**
   * Get plugin categories
   */
  getCategories(): Array<{ name: string; count: number; description?: string }> {
    try {
      const categoryMap = new Map<string, { count: number; description?: string }>();

      for (const store of this.defaultStores) {
        const storeEntries = this.storeCache.get(store.id) ?? [];

        for (const entry of storeEntries) {
          for (const category of entry.categories ?? []) {
            const existing = categoryMap.get(category);
            categoryMap.set(category, {
              count: (existing?.count ?? 0) + 1,
              description: existing?.description ?? this.getCategoryDescription(category),
            });
          }
        }
      }

      return Array.from(categoryMap.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        description: data.description,
      }));
    } catch (error) {
      this.logger.error('Failed to get categories:', error);
      return [];
    }
  }

  /**
   * Download plugin from store
   */
  downloadPlugin(
    pluginId: string,
    version?: string,
  ): {
    downloadUrl: string;
    checksums: Record<string, string>;
    metadata: PluginMetadata;
  } {
    try {
      const plugin = this.getPluginDetails(pluginId, version);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found in any store`);
      }

      // Get download information
      const downloadInfo = this.getDownloadInfo(plugin.store.id, pluginId, version);

      this.eventEmitter.emit('plugin.store.download.initiated', {
        pluginId,
        version,
        storeId: plugin.store.id,
        downloadUrl: downloadInfo.downloadUrl,
        timestamp: new Date(),
      });

      return downloadInfo;
    } catch (error) {
      this.logger.error(`Failed to download plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Refresh store cache
   */
  refreshStoreCache(): void {
    try {
      this.logger.debug('Refreshing plugin store cache...');

      for (const store of this.defaultStores) {
        try {
          const plugins = this.fetchStorePlugins(store.id);
          this.storeCache.set(store.id, plugins);
          this.logger.debug(`Cached ${plugins.length} plugins from ${store.name}`);
        } catch (error) {
          this.logger.warn(`Failed to refresh cache for store ${store.name}:`, error);
        }
      }

      this.eventEmitter.emit('plugin.store.cache.refreshed', {
        stores: this.defaultStores.length,
        totalPlugins: Array.from(this.storeCache.values()).reduce((sum, plugins) => sum + plugins.length, 0),
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to refresh store cache:', error);
      throw error;
    }
  }

  /**
   * Add custom store
   */
  async addStore(store: { id: string; name: string; url: string; priority?: number; trusted?: boolean; apiKey?: string }): Promise<void> {
    try {
      // Validate store connectivity
      this.validateStore(store);

      this.defaultStores.push({
        ...store,
        priority: store.priority ?? 10,
        trusted: store.trusted ?? false,
      });

      await this.saveStoreConfigurations();
      this.refreshStoreCache();

      this.logger.log(`Added new plugin store: ${store.name}`);
    } catch (error) {
      this.logger.error(`Failed to add store ${store.name}:`, error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private searchInStore(storeId: string, query: PluginStoreQuery): PluginStoreEntry[] {
    // Simulate store search - in real implementation, this would make API calls
    const cached = this.storeCache.get(storeId) ?? [];

    let filtered = cached;

    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      filtered = filtered.filter((plugin) => {
        const nameMatch = plugin.name.toLowerCase().includes(keyword);
        const descriptionMatch = plugin.description?.toLowerCase().includes(keyword) ?? false;
        const keywordMatch = plugin.keywords?.some((k) => k.toLowerCase().includes(keyword)) ?? false;

        return nameMatch || descriptionMatch || keywordMatch;
      });
    }

    if (query.category) {
      filtered = filtered.filter((plugin) => plugin.categories?.includes(query.category!));
    }

    if (query.author) {
      filtered = filtered.filter((plugin) => plugin.author?.toLowerCase().includes(query.author!.toLowerCase()));
    }

    // Add relevance scoring
    return filtered.map((plugin) => ({
      ...plugin,
      relevanceScore: this.calculateRelevanceScore(plugin, query),
    }));
  }

  private getPluginFromStore(storeId: string, pluginId: string, version?: string): PluginStoreEntry | null {
    try {
      const cachedPlugins = this.storeCache.get(storeId) ?? [];

      const isMatch = (p: PluginStoreEntry) => p.id === pluginId && (!version || p.version === version);

      // Attempt to find an exact match (with version if specified)
      let plugin = cachedPlugins.find(isMatch);

      // If no version specified and no exact match, fallback to latest version
      if (!plugin && !version) {
        const pluginVersions = cachedPlugins.filter((p) => p.id === pluginId);
        if (pluginVersions.length) {
          plugin = this.getLatestVersion(pluginVersions);
        }
      }

      if (plugin) {
        this.logger.debug(`Found plugin ${pluginId}@${plugin.version} in store ${storeId}`);
      }

      return plugin ?? null;
    } catch (error) {
      this.logger.error(`Error retrieving plugin ${pluginId} from store ${storeId}:`, error);
      return null;
    }
  }

  private getLatestVersion(plugins: PluginStoreEntry[]): PluginStoreEntry {
    return plugins.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
  }

  private getDownloadInfo(storeId: string, pluginId: string, version?: string): { downloadUrl: string; checksums: Record<string, string>; metadata: PluginMetadata } {
    // Simulate download info retrieval
    const plugin = this.getPluginFromStore(storeId, pluginId, version);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    return {
      downloadUrl: `https://store.example.com/download/${pluginId}/${version ?? 'latest'}`,
      checksums: {
        sha256: 'dummy-checksum',
        md5: 'dummy-md5',
      },
      metadata: {
        id: plugin.id,
        pluginId: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description ?? '',
        author: plugin.author ?? '',
        license: plugin.license ?? 'MIT',
        category: plugin.categories?.[0] ?? 'utility',
        dependencies: plugin.dependencies,
        pluginDependencies: plugin.pluginDependencies,
        engines: plugin.engines || {},
        capabilities: plugin.capabilities,
        permissions: Object.values(plugin.permissions || {}).flat(),
        hooks: {},
        configuration: {},
        runtimeMetadata: {
          category: plugin.categories?.[0] ?? 'utility',
          tags: plugin.keywords ?? [],
          documentation: plugin.homepage,
          repository: plugin.repository,
        },
        status: PluginStatus.AVAILABLE,
        loadTime: 0,
        memory: 0,
        cpu: 0,
        main: '',
      },
    };
  }

  private fetchStorePlugins(storeId: string): PluginStoreEntry[] {
    // Simulate fetching plugins from remote store
    // In real implementation, this would make HTTP requests to store APIs
    return [
      {
        id: 'auth-plugin',
        name: 'Authentication Plugin',
        version: '1.0.0',
        description: 'Advanced authentication and authorization plugin',
        author: 'NestJS Team',
        license: 'MIT',
        keywords: ['auth', 'security', 'jwt'],
        categories: ['security', 'authentication'],
        downloadCount: 15000,
        capabilities: ['auth', 'jwt', 'oauth2'],
        permissions: {},
        pluginDependencies: [],
        rating: 4.8,
        dependencies: { nestjsCore: '^8.0.0' },
        engines: { node: '>=14.0.0', nestjs: '>=8.0.0' },
        featured: true,
        store: { id: storeId, name: this.getStoreName(storeId), priority: 1 },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      },
      {
        id: 'email-plugin',
        name: 'Email Service Plugin',
        version: '2.1.0',
        description: 'Comprehensive email service with templates and queues',
        author: 'Community',
        license: 'MIT',
        keywords: ['email', 'notification', 'templates'],
        categories: ['communication', 'utility'],
        downloadCount: 8500,
        capabilities: ['auth', 'jwt', 'oauth2'],
        permissions: {},
        pluginDependencies: [],
        rating: 4.8,
        dependencies: { nestjsCore: '^8.0.0' },
        engines: { node: '>=14.0.0', nestjs: '>=8.0.0' },
        featured: true,
        store: { id: storeId, name: this.getStoreName(storeId), priority: 1 },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      },
    ];
  }

  private calculateRelevanceScore(plugin: PluginStoreEntry, query: PluginStoreQuery): number {
    let score = 0;

    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();

      // Name match gets highest score
      if (plugin.name.toLowerCase().includes(keyword)) score += 100;

      // Description match
      if (plugin.description?.toLowerCase().includes(keyword)) score += 50;

      // Keywords match
      const keywordMatches = plugin.keywords?.filter((k) => k.toLowerCase().includes(keyword)).length ?? 0;
      score += keywordMatches * 25;
    }

    // Boost score for featured plugins
    if (plugin.featured) score += 20;

    // Boost score for highly rated plugins
    score += (plugin.rating ?? 0) * 5;

    // Boost score for popular plugins
    score += Math.log10((plugin.downloadCount ?? 0) + 1) * 2;

    return score;
  }

  private paginateResults<T>(results: T[], page = 1, limit = 20): T[] {
    const start = (page - 1) * limit;
    const end = start + limit;
    return results.slice(start, end);
  }

  private getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
      security: 'Security and authentication related plugins',
      authentication: 'User authentication and authorization',
      communication: 'Email, SMS, and messaging services',
      utility: 'General utility and helper plugins',
      database: 'Database integration and ORM plugins',
      monitoring: 'Application monitoring and logging',
      testing: 'Testing tools and frameworks',
      documentation: 'API documentation and generation',
    };

    return descriptions[category] || 'General purpose plugins';
  }

  private getStoreName(storeId: string): string {
    return this.defaultStores.find((s) => s.id === storeId)?.name ?? 'Unknown Store';
  }

  private validateStore(store: { url: string; apiKey?: string }): void {
    // Simulate store validation
    // In real implementation, this would test API connectivity
    if (!store.url.startsWith('http')) {
      throw new Error('Store URL must be a valid HTTP/HTTPS URL');
    }
  }

  private async loadStoreConfigurations(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'src', 'plugins', 'config', 'stores.json');

      if (await fs.pathExists(configPath)) {
        const config = (await fs.readJson(configPath)) as { stores?: any[]; lastUpdated?: string };
        // Load custom stores from configuration
        if (config.stores) {
          this.defaultStores.push(...config.stores);
        }
      }
    } catch (_error) {
      this.logger.debug('No custom store configuration found, using defaults');
    }
  }

  private async saveStoreConfigurations(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'src', 'plugins', 'config', 'stores.json');
      await fs.ensureDir(path.dirname(configPath));

      const config = {
        stores: this.defaultStores.filter((s) => !['official', 'community'].includes(s.id)),
        lastUpdated: new Date().toISOString(),
      };

      await fs.writeJson(configPath, config, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save store configurations:', error);
    }
  }

  /**
   * Get store configuration
   */
  getStoreConfig(): any {
    return {
      stores: this.defaultStores,
      cacheEnabled: true,
      refreshInterval: 3600000, // 1 hour
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Update store configuration
   */
  updateStoreConfig(config: any): void {
    this.logger.log('Store configuration updated:', config);
    // Implementation would update store configuration
  }

  /**
   * Refresh all stores
   */
  refreshStores(): number {
    this.storeCache.clear();
    this.logger.log('All store caches refreshed');
    return this.defaultStores.length;
  }

  /**
   * Get plugin download information
   */
  getPluginDownloadInfo(id: string): any {
    return {
      downloadUrl: `https://store.example.com/download/${id}`,
      size: '1.2MB',
      checksum: 'sha256:abc123...',
      prerequisites: [],
    };
  }

  /**
   * Get store metrics
   */
  getStoreMetrics(): any {
    return {
      totalPlugins: 150,
      totalDownloads: 5000,
      averageRating: 4.2,
      stores: this.defaultStores.length,
      cacheHitRate: 0.85,
    };
  }
}
