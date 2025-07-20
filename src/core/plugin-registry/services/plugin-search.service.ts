import { Injectable, Logger } from '@nestjs/common';
import { PluginRegistrySortBy, PluginSearchQuery, PluginSearchResult, SortOrder } from '@types';
import { PluginMetadataRepository } from '../repositories/plugin-metadata.repository';

/**
 * Service for searching and filtering plugins
 */
@Injectable()
export class PluginSearchService {
  private readonly logger = new Logger(PluginSearchService.name);

  constructor(private readonly metadataRepository: PluginMetadataRepository) {}

  /**
   * Search plugins based on query criteria
   */
  searchPlugins(query: PluginSearchQuery): PluginSearchResult {
    try {
      let plugins = this.metadataRepository.getAllPlugins();

      // Apply filters
      plugins = this.applyFilters(plugins, query);

      // Apply sorting
      plugins = this.applySorting(plugins, query);

      // Apply pagination
      const { paginatedPlugins, paginationInfo } = this.applyPagination(plugins, query);

      const result: PluginSearchResult = {
        plugins: paginatedPlugins,
        total: plugins.length,
        page: paginationInfo.page,
        limit: paginationInfo.limit,
        hasMore: paginationInfo.hasMore,
      };

      this.logger.debug(`Search completed: found ${result.total} plugins, returning ${paginatedPlugins.length}`, {
        query: query.query,
        filters: {
          category: query.category,
          tagsCount: query.tags?.length ?? 0,
          capabilitiesCount: query.capabilities?.length ?? 0,
          author: query.author,
          verified: query.verified,
        },
        sorting: {
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        },
        pagination: paginationInfo,
      });

      return result;
    } catch (error) {
      this.logger.error('Search operation failed', error);
      throw error;
    }
  }

  /**
   * Apply search filters
   */
  private applyFilters(plugins: ReturnType<typeof this.metadataRepository.getAllPlugins>, query: PluginSearchQuery) {
    let filtered = plugins;

    // Text search filter
    if (query.query?.trim()) {
      const searchTerm = query.query.toLowerCase().trim();
      filtered = filtered.filter(
        (plugin) =>
          plugin.name.toLowerCase().includes(searchTerm) ||
          plugin.description.toLowerCase().includes(searchTerm) ||
          plugin.tags.some((tag) => tag.toLowerCase().includes(searchTerm)) ||
          plugin.author.toLowerCase().includes(searchTerm),
      );
    }

    // Category filter
    if (query.category?.trim()) {
      filtered = filtered.filter((plugin) => plugin.category === query.category);
    }

    // Tags filter
    if (query.tags && query.tags.length > 0) {
      filtered = filtered.filter((plugin) => query.tags!.some((tag) => plugin.tags.includes(tag)));
    }

    // Capabilities filter
    if (query.capabilities && query.capabilities.length > 0) {
      filtered = filtered.filter((plugin) => query.capabilities!.some((cap) => plugin.capabilities.includes(cap)));
    }

    // Author filter
    if (query.author?.trim()) {
      filtered = filtered.filter((plugin) => plugin.author === query.author);
    }

    // Verified filter
    if (query.verified !== undefined) {
      filtered = filtered.filter((plugin) => plugin.verified === query.verified);
    }

    return filtered;
  }

  /**
   * Apply sorting to results
   */
  private applySorting(plugins: ReturnType<typeof this.metadataRepository.getAllPlugins>, query: PluginSearchQuery) {
    const sortBy = query.sortBy ?? PluginRegistrySortBy.NAME;
    const sortOrder = query.sortOrder ?? SortOrder.ASC;

    const sorted = [...plugins].sort((a, b) => {
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
          // Combine downloads and rating for popularity score
          aValue = a.downloadCount + a.rating * 10;
          bValue = b.downloadCount + b.rating * 10;
          break;
        case PluginRegistrySortBy.NAME:
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
      }

      if (sortOrder === SortOrder.DESC) {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    return sorted;
  }

  /**
   * Apply pagination to results
   */
  private applyPagination(plugins: ReturnType<typeof this.metadataRepository.getAllPlugins>, query: PluginSearchQuery) {
    const limit = Math.max(1, Math.min(query.limit ?? 20, 100)); // Clamp between 1 and 100
    const offset = Math.max(0, query.offset ?? 0);
    const total = plugins.length;
    const page = Math.floor(offset / limit) + 1;

    const paginatedPlugins = plugins.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      paginatedPlugins,
      paginationInfo: {
        page,
        limit,
        offset,
        total,
        hasMore,
      },
    };
  }

  /**
   * Get search suggestions based on partial query
   */
  getSearchSuggestions(partialQuery: string, limit = 10): string[] {
    try {
      if (!partialQuery?.trim() || partialQuery.length < 2) {
        return [];
      }

      const searchTerm = partialQuery.toLowerCase().trim();
      const plugins = this.metadataRepository.getAllPlugins();
      const suggestions = new Set<string>();

      // Add plugin names that match
      plugins.forEach((plugin) => {
        if (plugin.name.toLowerCase().includes(searchTerm)) {
          suggestions.add(plugin.name);
        }
      });

      // Add tags that match
      plugins.forEach((plugin) => {
        plugin.tags.forEach((tag) => {
          if (tag.toLowerCase().includes(searchTerm)) {
            suggestions.add(tag);
          }
        });
      });

      // Add author names that match
      plugins.forEach((plugin) => {
        if (plugin.author.toLowerCase().includes(searchTerm)) {
          suggestions.add(plugin.author);
        }
      });

      return Array.from(suggestions).slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get search suggestions', error);
      return [];
    }
  }

  /**
   * Get popular search terms
   */
  getPopularSearchTerms(limit = 10): string[] {
    try {
      const plugins = this.metadataRepository.getAllPlugins();
      const termCounts = new Map<string, number>();

      // Count tag occurrences
      plugins.forEach((plugin) => {
        plugin.tags.forEach((tag) => {
          termCounts.set(tag.toLowerCase(), (termCounts.get(tag.toLowerCase()) ?? 0) + 1);
        });
      });

      // Count category occurrences
      plugins.forEach((plugin) => {
        const category = plugin.category.toLowerCase();
        termCounts.set(category, (termCounts.get(category) ?? 0) + 1);
      });

      // Sort by popularity and return top terms
      return Array.from(termCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([term]) => term);
    } catch (error) {
      this.logger.error('Failed to get popular search terms', error);
      return [];
    }
  }

  /**
   * Get search filters summary
   */
  getSearchFiltersSummary() {
    try {
      const plugins = this.metadataRepository.getAllPlugins();

      // Categories
      const categories = new Set<string>();
      plugins.forEach((plugin) => categories.add(plugin.category));

      // Authors
      const authors = new Set<string>();
      plugins.forEach((plugin) => authors.add(plugin.author));

      // Tags
      const tags = new Set<string>();
      plugins.forEach((plugin) => plugin.tags.forEach((tag) => tags.add(tag)));

      // Capabilities
      const capabilities = new Set<string>();
      plugins.forEach((plugin) => plugin.capabilities.forEach((cap) => capabilities.add(cap)));

      return {
        categories: Array.from(categories).sort(),
        authors: Array.from(authors).sort(),
        tags: Array.from(tags).sort(),
        capabilities: Array.from(capabilities).sort(),
        stats: {
          totalPlugins: plugins.length,
          verified: plugins.filter((p) => p.verified).length,
          installed: plugins.filter((p) => p.status.installed).length,
          enabled: plugins.filter((p) => p.status.enabled).length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get search filters summary', error);
      return {
        categories: [],
        authors: [],
        tags: [],
        capabilities: [],
        stats: {
          totalPlugins: 0,
          verified: 0,
          installed: 0,
          enabled: 0,
        },
      };
    }
  }
}
