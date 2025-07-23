import { getErrorMessage } from '@lib/shared/common';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { PluginCategory, PluginEntity, PluginStatus } from './metadata.entity';

interface StatusStatRow {
  status: string;
  count: number;
}

interface CategoryStatRow {
  category: string;
  count: number;
}


export interface CreatePluginDto {
  name: string;
  version: string;
  description?: string | undefined;
  author?: string | undefined;
  license?: string | undefined;
  tags?: string[] | undefined;
  category?: PluginCategory | undefined;
  homepage?: string | undefined;
  repository?: string | undefined;
  dependencies?: string[] | undefined;
  minHostVersion?: string | undefined;
  maxHostVersion?: string | undefined;
  filePath: string;
  fileSize: number;
  checksum: string;
  manifest?: Record<string, unknown> | undefined;
  readme?: string | undefined;
}

export interface PluginSearchQuery {
  name?: string | undefined;
  author?: string | undefined;
  category?: PluginCategory | undefined;
  tags?: string[] | undefined;
  status?: PluginStatus | undefined;
  minRating?: number | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  sortBy?: PluginSortBy | undefined;
  sortOrder?: 'ASC' | 'DESC' | undefined;
}

export interface PluginSearchResult {
  plugins: PluginEntity[];
  total: number;
  hasMore: boolean;
}

export type PluginSortBy = 'name' | 'createdAt' | 'updatedAt' | 'downloadCount' | 'rating' | 'publishedAt';

export interface ValidationResults {
  valid: boolean;
  errors: string[];
  warnings: string[];
  [key: string]: unknown;
}

export interface DatabaseQueryResult {
  status: string;
  count: string;
}

export interface DatabaseCategoryResult {
  category: string;
  count: string;
}

export interface DatabaseDownloadResult {
  totalDownloads?: string | null;
}

export interface DatabaseRatingResult {
  averageRating?: string | null;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
interface _DatabaseStatsResult {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  general_stats: {
    total: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    total_downloads: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    avg_rating: string;
  } | null;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  status_stats: StatusStatRow[] | null;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  category_stats: CategoryStatRow[] | null;
}

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    @InjectRepository(PluginEntity)
    private readonly pluginRepository: Repository<PluginEntity>,
    @Inject('CACHE_MANAGER')
    private readonly cacheManager: Cache,
  ) {}

  async createPlugin(createDto: CreatePluginDto): Promise<PluginEntity> {
    try {
      const pluginData: Record<string, unknown> = {
        ...createDto,
        status: PluginStatus.UPLOADED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      // Remove undefined values to satisfy exactOptionalPropertyTypes
      Object.keys(pluginData).forEach(key => {
        if (pluginData[key] === undefined) {
          delete pluginData[key];
        }
      });
      const plugin = this.pluginRepository.create(pluginData);

      const savedPlugin = await this.pluginRepository.save(plugin);

      // Invalidate caches after creating new plugin
      await this.invalidateAllCaches();

      this.logger.log(
        `Created plugin metadata: ${createDto.name}@${createDto.version}`,
      );

      return savedPlugin as unknown as PluginEntity;
    } catch (error) {
      this.logger.error(`Failed to create plugin metadata: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async findPluginById(id: string): Promise<PluginEntity | null> {
    try {
      const plugin = await this.pluginRepository.findOne({ where: { id } });
      return plugin;
    } catch (error) {
      this.logger.error(`Failed to find plugin by ID ${id}: ${getErrorMessage(error)}`);
      return null;
    }
  }

  async findPlugin(
    name: string,
    version: string,
  ): Promise<PluginEntity | null> {
    try {
      const plugin = await this.pluginRepository.findOne({
        where: { name, version },
      });
      return plugin;
    } catch (error) {
      this.logger.error(
        `Failed to find plugin ${name}@${version}: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }

  async findPluginsByName(name: string): Promise<PluginEntity[]> {
    try {
      return await this.pluginRepository.find({
        where: { name },
        order: { version: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to find plugins by name ${name}: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  async searchPlugins(query: PluginSearchQuery): Promise<PluginSearchResult> {
    try {
      const limit = Math.min(query.limit ?? 50, 200);
      const offset = query.offset ?? 0;

      // Build optimized query with proper indexing
      const queryBuilder = this.pluginRepository
        .createQueryBuilder('plugin')
        .select([
          'plugin.id',
          'plugin.name',
          'plugin.version',
          'plugin.description',
          'plugin.author',
          'plugin.license',
          'plugin.tags',
          'plugin.category',
          'plugin.status',
          'plugin.homepage',
          'plugin.repository',
          'plugin.downloadCount',
          'plugin.rating',
          'plugin.ratingCount',
          'plugin.createdAt',
          'plugin.updatedAt',
          'plugin.publishedAt',
        ])
        .where('plugin.status = :status', {
          status: query.status ?? PluginStatus.PUBLISHED,
        });

      // Apply filters with optimized indexing
      if (query.category != null) {
        queryBuilder.andWhere('plugin.category = :category', {
          category: query.category,
        });
      }

      if (query.minRating != null) {
        queryBuilder.andWhere('plugin.rating >= :minRating', {
          minRating: query.minRating,
        });
      }

      if (query.name != null) {
        queryBuilder.andWhere('plugin.name ILIKE :name', {
          name: `%${query.name}%`,
        });
      }

      if (query.author != null) {
        queryBuilder.andWhere('plugin.author ILIKE :author', {
          author: `%${query.author}%`,
        });
      }

      if (query.tags && query.tags.length > 0) {
        queryBuilder.andWhere('plugin.tags && :tags', {
          tags: query.tags,
        });
      }

      // Optimized full-text search using PostgreSQL features
      if (query.search != null) {
        queryBuilder.andWhere(
          `(
            to_tsvector('english', plugin.name || ' ' || COALESCE(plugin.description, '')) 
            @@ plainto_tsquery('english', :search)
            OR plugin.tags::text ILIKE :searchLike
          )`,
          { 
            search: query.search,
            searchLike: `%${query.search}%`
          },
        );
      }

      // Apply sorting with proper index usage
      const sortBy = query.sortBy ?? 'createdAt';
      const sortOrder = query.sortOrder ?? 'DESC';
      
      // Use composite indexes for better performance
      if (sortBy === 'rating') {
        queryBuilder.orderBy('plugin.status', 'ASC');
        queryBuilder.addOrderBy('plugin.rating', sortOrder);
        queryBuilder.addOrderBy('plugin.downloadCount', 'DESC');
      } else if (sortBy === 'downloadCount') {
        queryBuilder.orderBy('plugin.status', 'ASC');
        queryBuilder.addOrderBy('plugin.downloadCount', sortOrder);
        queryBuilder.addOrderBy('plugin.rating', 'DESC');
      } else if (sortBy === 'publishedAt') {
        queryBuilder.orderBy('plugin.status', 'ASC');
        queryBuilder.addOrderBy('plugin.publishedAt', sortOrder);
      } else {
        queryBuilder.orderBy(`plugin.${sortBy}`, sortOrder);
      }

      // Add secondary sort by name for consistent ordering
      if (sortBy !== 'name') {
        queryBuilder.addOrderBy('plugin.name', 'ASC');
      }

      // Use a single query for both count and data when possible
      if (offset === 0 && limit <= 50) {
        // For small result sets, get both count and data efficiently
        const [plugins, total] = await queryBuilder
          .limit(limit)
          .getManyAndCount();

        return {
          plugins,
          total,
          hasMore: total > limit,
        };
      } else {
        // For larger result sets or pagination, use separate optimized queries
        const countQuery = queryBuilder
          .clone()
          .select('COUNT(*)', 'count');

        const [plugins, countResult] = await Promise.all([
          queryBuilder.limit(limit).offset(offset).getMany(),
          countQuery.getRawOne(),
        ]);

        const total = parseInt(countResult?.count ?? '0', 10);

        return {
          plugins,
          total,
          hasMore: offset + plugins.length < total,
        };
      }
    } catch (error) {
      this.logger.error(`Plugin search failed: ${getErrorMessage(error)}`);
      return { plugins: [], total: 0, hasMore: false };
    }
  }

  async updatePluginStatus(
    id: string,
    status: PluginStatus,
    validationResults?: ValidationResults,
  ): Promise<PluginEntity> {
    try {
      const plugin = await this.findPluginById(id);

      if (!plugin) {
        throw new NotFoundException(`Plugin not found: ${id}`);
      }

      plugin.status = status;
      plugin.updatedAt = new Date();

      if (validationResults) {
        plugin.validationResults = {
          isValid: validationResults.valid,
          errors: validationResults.errors.map(err => ({ message: err, severity: 'error' as const, code: 'VALIDATION_ERROR' })),
          warnings: validationResults.warnings.map(warn => ({ message: warn, severity: 'warning' as const, code: 'VALIDATION_WARNING' })),
          securityScore: 75, // Default score
          compatibility: {
            hostVersions: ['*'],
            nodeVersions: ['>=16.0.0'],
          },
          dependencies: {
            resolved: {},
            missing: [],
            conflicts: [],
          },
          performance: {
            bundleSize: 0,
            estimatedMemory: 0,
          },
          timestamp: new Date().toISOString(),
        };
      }

      if (status === PluginStatus.PUBLISHED && !plugin.publishedAt) {
        plugin.publishedAt = new Date();
      }

      if (status === PluginStatus.DEPRECATED && !plugin.deprecatedAt) {
        plugin.deprecatedAt = new Date();
      }

      const updatedPlugin = await this.pluginRepository.save(plugin);

      // Invalidate caches after status update
      if (status === PluginStatus.PUBLISHED || status === PluginStatus.DEPRECATED) {
        await this.invalidateAllCaches();
      } else {
        await this.invalidateStatsCache();
      }

      this.logger.log(
        `Updated plugin status: ${plugin.name}@${plugin.version} -> ${status}`,
      );

      return updatedPlugin;
    } catch (error) {
      this.logger.error(`Failed to update plugin status: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async incrementDownloadCount(id: string): Promise<void> {
    try {
      await this.pluginRepository
        .createQueryBuilder()
        .update(PluginEntity)
        .set({
          downloadCount: () => 'downloadCount + 1',
          updatedAt: new Date(),
        })
        .where('id = :id', { id })
        .execute();

      this.logger.debug(`Incremented download count for plugin: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to increment download count for ${id}: ${getErrorMessage(error)}`,
      );
    }
  }

  async updatePluginRating(
    id: string,
    rating: number,
    incrementCount = true,
  ): Promise<PluginEntity> {
    try {
      const plugin = await this.findPluginById(id);

      if (!plugin) {
        throw new NotFoundException(`Plugin not found: ${id}`);
      }

      if (incrementCount) {
        const totalRating = plugin.rating * plugin.ratingCount + rating;
        plugin.ratingCount += 1;
        plugin.rating = totalRating / plugin.ratingCount;
      } else {
        plugin.rating = rating;
      }

      plugin.updatedAt = new Date();

      const updatedPlugin = await this.pluginRepository.save(plugin);

      this.logger.log(
        `Updated plugin rating: ${plugin.name}@${plugin.version} -> ${plugin.rating}`,
      );

      return updatedPlugin;
    } catch (error) {
      this.logger.error(`Failed to update plugin rating: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async deletePlugin(id: string): Promise<void> {
    try {
      const result = await this.pluginRepository.delete(id);

      if (result.affected === 0) {
        throw new NotFoundException(`Plugin not found: ${id}`);
      }

      this.logger.log(`Deleted plugin metadata: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete plugin: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async getPluginStats(): Promise<{
    total: number;
    byStatus: Record<PluginStatus, number>;
    byCategory: Record<PluginCategory, number>;
    totalDownloads: number;
    averageRating: number;
  }> {
    const cacheKey = 'plugin-stats';
    
    try {
      // Check cache first
      const cached = await this.cacheManager.get(cacheKey);
      if (cached !== undefined && cached !== null) {
        this.logger.debug('Returning cached plugin stats');
        return cached as {
          total: number;
          byStatus: Record<PluginStatus, number>;
          byCategory: Record<PluginCategory, number>;
          totalDownloads: number;
          averageRating: number;
        };
      }

      // Optimized single query to get all stats at once
      const statsQuery = `
        WITH stats AS (
          SELECT 
            COUNT(*) as total,
            SUM(download_count) as total_downloads,
            AVG(CASE WHEN rating_count > 0 THEN rating ELSE NULL END) as avg_rating
          FROM plugins
        ),
        status_stats AS (
          SELECT 
            status,
            COUNT(*) as count
          FROM plugins
          GROUP BY status
        ),
        category_stats AS (
          SELECT 
            category,
            COUNT(*) as count
          FROM plugins
          GROUP BY category
        )
        SELECT 
          (SELECT row_to_json(stats) FROM stats) as general_stats,
          (SELECT json_agg(row_to_json(status_stats)) FROM status_stats) as status_stats,
          (SELECT json_agg(row_to_json(category_stats)) FROM category_stats) as category_stats
      `;

      const [result] = await this.pluginRepository.query(statsQuery);
      
      const generalStats = result.general_stats ?? { 
        total: '0', 
        // eslint-disable-next-line @typescript-eslint/naming-convention
        total_downloads: '0', 
        // eslint-disable-next-line @typescript-eslint/naming-convention
        avg_rating: '0' 
      };
      const statusStats = result.status_stats ?? [];
      const categoryStats = result.category_stats ?? [];

      const byStatus = {} as Record<PluginStatus, number>;
      statusStats.forEach((stat: StatusStatRow) => {
        byStatus[stat.status as PluginStatus] = parseInt(String(stat.count), 10);
      });

      const byCategory = {} as Record<PluginCategory, number>;
      categoryStats.forEach((stat: CategoryStatRow) => {
        byCategory[stat.category as PluginCategory] = parseInt(String(stat.count), 10);
      });

      const stats = {
        total: parseInt(generalStats.total, 10),
        byStatus,
        byCategory,
        totalDownloads: parseInt(generalStats.total_downloads, 10),
        averageRating: parseFloat(generalStats.avg_rating),
      };

      // Cache for 5 minutes
      await this.cacheManager.set(cacheKey, stats, 300);
      
      return stats;
    } catch (error) {
      this.logger.error(`Failed to get plugin stats: ${getErrorMessage(error)}`);
      return {
        total: 0,
        byStatus: {} as Record<PluginStatus, number>,
        byCategory: {} as Record<PluginCategory, number>,
        totalDownloads: 0,
        averageRating: 0,
      };
    }
  }

  async getPopularPlugins(limit = 10): Promise<PluginEntity[]> {
    const cacheKey = `popular-plugins-${limit}`;
    
    try {
      // Check cache first
      const cached = await this.cacheManager.get(cacheKey);
      if (cached !== undefined && cached !== null) {
        this.logger.debug(`Returning cached popular plugins (limit: ${limit})`);
        return cached as PluginEntity[];
      }

      const plugins = await this.pluginRepository.find({
        select: [
          'id', 'name', 'version', 'description', 'author', 'license',
          'tags', 'category', 'status', 'homepage', 'repository',
          'downloadCount', 'rating', 'ratingCount', 'createdAt', 'publishedAt'
        ],
        where: { status: PluginStatus.PUBLISHED },
        order: {
          downloadCount: 'DESC',
          rating: 'DESC',
        },
        take: limit,
      });

      // Cache for 10 minutes
      await this.cacheManager.set(cacheKey, plugins, 600);
      
      return plugins;
    } catch (error) {
      this.logger.error(`Failed to get popular plugins: ${getErrorMessage(error)}`);
      return [];
    }
  }

  async getRecentPlugins(limit = 10): Promise<PluginEntity[]> {
    const cacheKey = `recent-plugins-${limit}`;
    
    try {
      // Check cache first
      const cached = await this.cacheManager.get(cacheKey);
      if (cached !== undefined && cached !== null) {
        this.logger.debug(`Returning cached recent plugins (limit: ${limit})`);
        return cached as PluginEntity[];
      }

      const plugins = await this.pluginRepository.find({
        select: [
          'id', 'name', 'version', 'description', 'author', 'license',
          'tags', 'category', 'status', 'homepage', 'repository',
          'downloadCount', 'rating', 'ratingCount', 'createdAt', 'publishedAt'
        ],
        where: { status: PluginStatus.PUBLISHED },
        order: { publishedAt: 'DESC' },
        take: limit,
      });

      // Cache for 10 minutes
      await this.cacheManager.set(cacheKey, plugins, 600);
      
      return plugins;
    } catch (error) {
      this.logger.error(`Failed to get recent plugins: ${getErrorMessage(error)}`);
      return [];
    }
  }

  // Cache invalidation methods
  async invalidateStatsCache(): Promise<void> {
    await this.cacheManager.del('plugin-stats');
  }

  async invalidatePopularPluginsCache(): Promise<void> {
    const keys = ['popular-plugins-5', 'popular-plugins-10', 'popular-plugins-20'];
    await Promise.all(keys.map(key => this.cacheManager.del(key)));
  }

  async invalidateRecentPluginsCache(): Promise<void> {
    const keys = ['recent-plugins-5', 'recent-plugins-10', 'recent-plugins-20'];
    await Promise.all(keys.map(key => this.cacheManager.del(key)));
  }

  async invalidateAllCaches(): Promise<void> {
    await Promise.all([
      this.invalidateStatsCache(),
      this.invalidatePopularPluginsCache(),
      this.invalidateRecentPluginsCache(),
    ]);
  }
}
