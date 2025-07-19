import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as semver from 'semver';
import type { CompatibilityResult, PluginDependency, PluginManifest, PluginMetadata, ValidationResult } from '@/types/plugin.types';
import { PluginStatus } from '@/types/plugin.types';
import { type PluginRegistry, type PluginRegistryEntry, PluginRegistrySortBy, type PluginSearchQuery, type PluginSearchResult, type PluginStats, SortOrder } from '@/types/registry.types';

@Injectable()
export class PluginRegistryService {
  private readonly logger = new Logger(PluginRegistryService.name);
  private readonly registry: PluginRegistry;
  private readonly registryPath: string;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.registryPath = path.join(process.cwd(), 'src', 'plugins', 'registry');
    this.registry = {
      plugins: new Map(),
      categories: new Map(),
      dependencies: new Map(),
    };
    void this.initializeRegistry();
  }

  private async initializeRegistry(): Promise<void> {
    try {
      await fs.ensureDir(this.registryPath);
      await this.loadRegistryFromDisk();
      this.logger.log('Plugin registry initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize plugin registry', error);
      throw error;
    }
  }

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

  private manifestToMetadata(manifest: PluginManifest, _pluginPath: string): PluginMetadata {
    return {
      id: `${manifest.name}@${manifest.version}`,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      license: manifest.license,
      status: PluginStatus.INSTALLED,
      capabilities: manifest.capabilities ?? [],
      permissions: manifest.permissions ?? {},
      dependencies: Object.entries(manifest.dependencies ?? {}).map(([name, version]) => ({
        name,
        version,
        required: true,
      })),
      pluginDependencies: manifest.pluginDependencies ?? {},
      loadTime: 0,
      memory: 0,
      cpu: 0,
      main: manifest.main,
      types: manifest.types,
      engines: manifest.engines,
      hooks: manifest.hooks ?? {},
      configuration: manifest.configuration ?? {},
      metadata: manifest.metadata ?? {
        category: 'general',
        tags: [],
      },
    };
  }

  async registerPlugin(plugin: PluginMetadata): Promise<void> {
    try {
      const entry: PluginRegistryEntry = {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        license: plugin.license,
        category: plugin.metadata.category,
        tags: plugin.metadata.tags,
        capabilities: plugin.capabilities,
        permissions: plugin.permissions,
        dependencies: plugin.dependencies,
        pluginDependencies: plugin.pluginDependencies,
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
        repository: plugin.metadata.repository,
        documentation: plugin.metadata.documentation,
        size: 0,
        checksum: '',
        verified: false,
      };

      this.registry.plugins.set(plugin.id, entry);

      // Update category mapping
      const category = plugin.metadata.category;
      if (!this.registry.categories.has(category)) {
        this.registry.categories.set(category, []);
      }
      this.registry.categories.get(category)?.push(plugin.id);

      // Update dependency mapping
      const deps = plugin.dependencies.map((dep) => dep.name);
      this.registry.dependencies.set(plugin.id, deps);

      await this.saveRegistryToDisk();

      this.eventEmitter.emit('plugin.registered', { pluginId: plugin.id, plugin });
      this.logger.log(`Plugin registered: ${plugin.name}@${plugin.version}`);
    } catch (error) {
      this.logger.error(`Failed to register plugin: ${plugin.name}`, error);
      throw error;
    }
  }

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

      this.eventEmitter.emit('plugin.unregistered', { pluginId });
      this.logger.log(`Plugin unregistered: ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to unregister plugin: ${pluginId}`, error);
      throw error;
    }
  }

  validatePlugin(manifest: PluginManifest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!manifest.name) errors.push('Plugin name is required');
    if (!manifest.version) errors.push('Plugin version is required');
    if (!manifest.description) errors.push('Plugin description is required');
    if (!manifest.author) errors.push('Plugin author is required');
    if (!manifest.license) errors.push('Plugin license is required');
    if (!manifest.main) errors.push('Plugin main entry point is required');

    // Version validation
    if (manifest.version && !semver.valid(manifest.version)) {
      errors.push('Plugin version must be a valid semantic version');
    }

    // Engine validation
    if (manifest.engines) {
      if (manifest.engines.node && !semver.validRange(manifest.engines.node)) {
        errors.push('Node.js engine version must be a valid range');
      }
      if (manifest.engines.nestjs && !semver.validRange(manifest.engines.nestjs)) {
        errors.push('NestJS engine version must be a valid range');
      }
    }

    // Dependency validation
    if (manifest.dependencies) {
      for (const [name, version] of Object.entries(manifest.dependencies)) {
        if (!semver.validRange(version)) {
          errors.push(`Invalid dependency version range for ${name}: ${version}`);
        }
      }
    }

    // Plugin dependency validation
    if (manifest.pluginDependencies) {
      for (const [name, version] of Object.entries(manifest.pluginDependencies)) {
        if (!semver.validRange(version)) {
          errors.push(`Invalid plugin dependency version range for ${name}: ${version}`);
        }
      }
    }

    // Permissions validation
    if (manifest.permissions) {
      const validPermissionTypes = ['database', 'network', 'filesystem'];
      for (const [type, permissions] of Object.entries(manifest.permissions)) {
        if (!validPermissionTypes.includes(type)) {
          warnings.push(`Unknown permission type: ${type}`);
        }
        if (!Array.isArray(permissions)) {
          errors.push(`Permissions for ${type} must be an array`);
        }
      }
    }

    // Capabilities validation
    if (manifest.capabilities) {
      const validCapabilities = ['database', 'rest-api', 'graphql', 'events', 'websocket', 'grpc'];
      for (const capability of manifest.capabilities) {
        if (!validCapabilities.includes(capability)) {
          warnings.push(`Unknown capability: ${capability}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getPluginDependencies(pluginId: string): PluginDependency[] {
    const entry = this.registry.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    return entry.dependencies;
  }

  checkCompatibility(pluginId: string): CompatibilityResult {
    const entry = this.registry.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const reasons: string[] = [];
    const suggestions: string[] = [];

    // Check Node.js compatibility
    if (entry.engines.node) {
      const nodeVersion = process.version;
      if (!semver.satisfies(nodeVersion, entry.engines.node)) {
        reasons.push(`Node.js version ${nodeVersion} does not satisfy requirement ${entry.engines.node}`);
        suggestions.push(`Upgrade Node.js to a version that satisfies ${entry.engines.node}`);
      }
    }

    // Check NestJS compatibility (would need to get current NestJS version)
    if (entry.engines.nestjs) {
      // This would typically check against the current NestJS version in the host application
      // For now, we'll assume compatibility
    }

    // Check plugin dependencies
    for (const _dep of entry.dependencies) {
      // Check if dependency is installed and compatible
      // This would integrate with package.json or npm registry
    }

    // Check plugin dependencies
    for (const [depName, depVersion] of Object.entries(entry.pluginDependencies)) {
      const depPlugin = Array.from(this.registry.plugins.values()).find((p) => p.name === depName);

      if (!depPlugin) {
        reasons.push(`Required plugin dependency not found: ${depName}`);
        suggestions.push(`Install plugin dependency: ${depName}@${depVersion}`);
      } else if (!semver.satisfies(depPlugin.version, depVersion)) {
        reasons.push(`Plugin dependency version mismatch: ${depName}@${depPlugin.version} does not satisfy ${depVersion}`);
        suggestions.push(`Update plugin dependency: ${depName} to version ${depVersion}`);
      }
    }

    return {
      compatible: reasons.length === 0,
      reasons,
      suggestions,
    };
  }

  searchPlugins(query: PluginSearchQuery): PluginSearchResult {
    let plugins = Array.from(this.registry.plugins.values());

    // Apply filters
    if (query.query) {
      const searchTerm = query.query.toLowerCase();
      plugins = plugins.filter((p) => p.name.toLowerCase().includes(searchTerm) || p.description.toLowerCase().includes(searchTerm) || p.tags.some((tag) => tag.toLowerCase().includes(searchTerm)));
    }

    if (query.category) {
      plugins = plugins.filter((p) => p.category === query.category);
    }

    if (query.tags && query.tags.length > 0) {
      plugins = plugins.filter((p) => query.tags!.some((tag) => p.tags.includes(tag)));
    }

    if (query.capabilities && query.capabilities.length > 0) {
      plugins = plugins.filter((p) => query.capabilities!.some((cap) => p.capabilities.includes(cap)));
    }

    if (query.author) {
      plugins = plugins.filter((p) => p.author === query.author);
    }

    if (query.verified !== undefined) {
      plugins = plugins.filter((p) => p.verified === query.verified);
    }

    // Apply sorting
    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';

    plugins.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case PluginRegistrySortBy.DOWNLOADS:
          aValue = a.downloadCount;
          bValue = b.downloadCount;
          break;
        case PluginRegistrySortBy.RATING:
          aValue = a.rating;
          bValue = b.rating;
          break;
        case PluginRegistrySortBy.UPDATED:
          aValue = a.lastUpdated.getTime();
          bValue = b.lastUpdated.getTime();
          break;
        case PluginRegistrySortBy.CREATED:
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case PluginRegistrySortBy.POPULARITY:
          aValue = a.downloadCount + a.rating * 10; // Example popularity metric
          bValue = b.downloadCount + b.rating * 10;
          break;
        case PluginRegistrySortBy.NAME:
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === SortOrder.DESC) {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    // Apply pagination
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const total = plugins.length;
    const page = Math.floor(offset / limit) + 1;

    plugins = plugins.slice(offset, offset + limit);

    return {
      plugins,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    };
  }

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

  getPlugin(pluginId: string): PluginRegistryEntry | null {
    return this.registry.plugins.get(pluginId) ?? null;
  }

  getAllPlugins(): PluginRegistryEntry[] {
    return Array.from(this.registry.plugins.values());
  }

  getPluginsByCategory(category: string): PluginRegistryEntry[] {
    const pluginIds = this.registry.categories.get(category) ?? [];
    return pluginIds.map((id) => this.registry.plugins.get(id)).filter((plugin): plugin is PluginRegistryEntry => Boolean(plugin));
  }

  async updatePluginStatus(pluginId: string, status: Partial<PluginRegistryEntry['status']>): Promise<void> {
    const entry = this.registry.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    entry.status = { ...entry.status, ...status };
    await this.saveRegistryToDisk();

    this.eventEmitter.emit('plugin.status.updated', { pluginId, status });
  }
}
