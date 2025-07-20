import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PluginValidationUtil } from '@/shared/utils/validation.util';
import { PluginMetadataRepository } from './repositories/plugin-metadata.repository';
import { PluginDiscoveryService } from './services/plugin-discovery.service';
import { PluginCompatibilityService } from './services/plugin-compatibility.service';
import { PluginSearchService } from './services/plugin-search.service';
import { CompatibilityResult, PluginDependency, PluginManifest, PluginMetadata, PluginRegistryEntry, PluginSearchQuery, PluginSearchResult, PluginStats, ValidationResult } from '@types';

/**
 * Enhanced Plugin Registry Service
 *
 * Provides centralized management for plugin metadata, discovery, and lifecycle operations.
 * Implements clean architecture with separated concerns for better maintainability.
 */
@Injectable()
export class PluginRegistryService {
  private readonly logger = new Logger(PluginRegistryService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly metadataRepository: PluginMetadataRepository,
    private readonly discoveryService: PluginDiscoveryService,
    private readonly compatibilityService: PluginCompatibilityService,
    private readonly searchService: PluginSearchService,
  ) {
    void this.initialize();
  }

  /**
   * Initialize the registry service and all its dependencies
   */
  private async initialize(): Promise<void> {
    try {
      await this.metadataRepository.initialize();
      this.logger.log('Plugin registry initialized successfully');

      // Emit initialization event
      this.eventEmitter.emit('plugin.registry.initialized', {
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to initialize plugin registry', error);
      throw error;
    }
  }

  /**
   * Discover available plugins in the system
   */
  async discoverPlugins(): Promise<PluginMetadata[]> {
    try {
      const discovered = await this.discoveryService.discoverPlugins();

      this.eventEmitter.emit('plugins.discovered', {
        count: discovered.length,
        plugins: discovered.map((p) => ({ id: p.id, name: p.name, version: p.version })),
        timestamp: new Date(),
      });

      return discovered;
    } catch (error) {
      this.logger.error('Failed to discover plugins', error);
      throw error;
    }
  }

  /**
   * Register a plugin in the registry
   */
  async registerPlugin(plugin: PluginMetadata): Promise<void> {
    try {
      await this.metadataRepository.registerPlugin(plugin);

      this.eventEmitter.emit('plugin.registered', {
        pluginId: plugin.id,
        plugin,
        timestamp: new Date(),
      });

      this.logger.log(`Plugin registered: ${plugin.name}@${plugin.version}`);
    } catch (error) {
      this.logger.error(`Failed to register plugin: ${plugin.name}`, error);
      throw error;
    }
  }

  /**
   * Unregister a plugin from the registry
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    try {
      await this.metadataRepository.unregisterPlugin(pluginId);

      this.eventEmitter.emit('plugin.unregistered', {
        pluginId,
        timestamp: new Date(),
      });

      this.logger.log(`Plugin unregistered: ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to unregister plugin: ${pluginId}`, error);
      throw error;
    }
  }

  /**
   * Validate a plugin manifest
   */
  validatePlugin(manifest: PluginManifest): ValidationResult {
    try {
      const result = PluginValidationUtil.validateManifest(manifest);

      this.eventEmitter.emit('plugin.validated', {
        pluginName: manifest.name,
        version: manifest.version,
        valid: result.valid,
        errors: result.errors,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logger.error('Plugin validation failed', error);
      return {
        valid: false,
        errors: ['Validation process failed'],
        warnings: [],
      };
    }
  }

  /**
   * Get plugin dependencies
   */
  getPluginDependencies(pluginId: string): PluginDependency[] {
    return this.metadataRepository.getPluginDependencies(pluginId);
  }

  /**
   * Check plugin compatibility
   */
  checkCompatibility(pluginId: string): CompatibilityResult {
    try {
      const result = this.compatibilityService.checkCompatibility(pluginId);

      this.eventEmitter.emit('plugin.compatibility.checked', {
        pluginId,
        compatible: result.compatible,
        reasons: result.reasons,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logger.error(`Compatibility check failed for ${pluginId}`, error);
      return {
        compatible: false,
        reasons: ['Compatibility check failed'],
        suggestions: ['Please check plugin configuration'],
      };
    }
  }

  /**
   * Search plugins based on criteria
   */
  searchPlugins(query: PluginSearchQuery): PluginSearchResult {
    try {
      const result = this.searchService.searchPlugins(query);

      this.eventEmitter.emit('plugins.searched', {
        query,
        resultCount: result.total,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logger.error('Plugin search failed', error);
      return {
        plugins: [],
        total: 0,
        page: 1,
        limit: query.limit ?? 20,
        hasMore: false,
      };
    }
  }

  /**
   * Get plugin statistics
   */
  getPluginStats(): PluginStats {
    try {
      return this.metadataRepository.getPluginStats();
    } catch (error) {
      this.logger.error('Failed to get plugin stats', error);
      return {
        totalPlugins: 0,
        installedPlugins: 0,
        enabledPlugins: 0,
        categoriesCount: 0,
        averageRating: 0,
        totalDownloads: 0,
        topCategories: [],
        topAuthors: [],
        recentlyUpdated: [],
        mostPopular: [],
      };
    }
  }

  /**
   * Get a specific plugin entry
   */
  getPlugin(pluginId: string): PluginRegistryEntry | null {
    return this.metadataRepository.getPlugin(pluginId);
  }

  /**
   * Get all plugin entries
   */
  getAllPlugins(): PluginRegistryEntry[] {
    return this.metadataRepository.getAllPlugins();
  }

  /**
   * Get plugins by category
   */
  getPluginsByCategory(category: string): PluginRegistryEntry[] {
    return this.metadataRepository.getPluginsByCategory(category);
  }

  /**
   * Update plugin status
   */
  async updatePluginStatus(pluginId: string, status: Partial<PluginRegistryEntry['status']>): Promise<void> {
    try {
      await this.metadataRepository.updatePluginStatus(pluginId, status);

      this.eventEmitter.emit('plugin.status.updated', {
        pluginId,
        status,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to update plugin status for ${pluginId}`, error);
      throw error;
    }
  }
}
