import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginCategory, PluginEntity, PluginStatus } from './metadata.entity';

export interface CreatePluginDto {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  tags?: string[];
  category?: PluginCategory;
  homepage?: string;
  repository?: string;
  dependencies?: string[];
  minHostVersion?: string;
  maxHostVersion?: string;
  filePath: string;
  fileSize: number;
  checksum: string;
  manifest?: Record<string, unknown>;
  readme?: string;
}

export interface PluginSearchQuery {
  name?: string;
  author?: string;
  category?: PluginCategory;
  tags?: string[];
  status?: PluginStatus;
  minRating?: number;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: PluginSortBy;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PluginSearchResult {
  plugins: PluginEntity[];
  total: number;
  hasMore: boolean;
}

export type PluginSortBy = 'name' | 'createdAt' | 'updatedAt' | 'downloadCount' | 'rating';

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

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    @InjectRepository(PluginEntity)
    private readonly pluginRepository: Repository<PluginEntity>,
  ) {}

  async createPlugin(createDto: CreatePluginDto): Promise<PluginEntity> {
    try {
      const plugin = this.pluginRepository.create({
        ...createDto,
        status: PluginStatus.UPLOADED,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedPlugin = await this.pluginRepository.save(plugin);

      this.logger.log(
        `Created plugin metadata: ${createDto.name}@${createDto.version}`,
      );

      return savedPlugin;
    } catch (error) {
      this.logger.error(`Failed to create plugin metadata: ${error.message}`);
      throw error;
    }
  }

  async findPluginById(id: string): Promise<PluginEntity | null> {
    try {
      const plugin = await this.pluginRepository.findOne({ where: { id } });
      return plugin;
    } catch (error) {
      this.logger.error(`Failed to find plugin by ID ${id}: ${error.message}`);
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
        `Failed to find plugin ${name}@${version}: ${error.message}`,
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
        `Failed to find plugins by name ${name}: ${error.message}`,
      );
      return [];
    }
  }

  async searchPlugins(query: PluginSearchQuery): Promise<PluginSearchResult> {
    try {
      const limit = Math.min(query.limit ?? 50, 200);
      const offset = query.offset ?? 0;

      const queryBuilder = this.pluginRepository
        .createQueryBuilder('plugin')
        .where('plugin.status = :status', {
          status: query.status ?? PluginStatus.PUBLISHED,
        });

      // Apply filters
      if (query.name) {
        queryBuilder.andWhere('plugin.name ILIKE :name', {
          name: `%${query.name}%`,
        });
      }

      if (query.author) {
        queryBuilder.andWhere('plugin.author ILIKE :author', {
          author: `%${query.author}%`,
        });
      }

      if (query.category) {
        queryBuilder.andWhere('plugin.category = :category', {
          category: query.category,
        });
      }

      if (query.tags && query.tags.length > 0) {
        queryBuilder.andWhere('plugin.tags && :tags', {
          tags: query.tags,
        });
      }

      if (query.minRating) {
        queryBuilder.andWhere('plugin.rating >= :minRating', {
          minRating: query.minRating,
        });
      }

      if (query.search) {
        queryBuilder.andWhere(
          '(plugin.name ILIKE :search OR plugin.description ILIKE :search OR plugin.tags::text ILIKE :search)',
          { search: `%${query.search}%` },
        );
      }

      // Apply sorting
      const sortBy = query.sortBy ?? 'createdAt';
      const sortOrder = query.sortOrder ?? 'DESC';
      queryBuilder.orderBy(`plugin.${sortBy}`, sortOrder);

      // Add secondary sort by name for consistent ordering
      if (sortBy !== 'name') {
        queryBuilder.addOrderBy('plugin.name', 'ASC');
      }

      // Get total count
      const totalQuery = queryBuilder.clone();
      const total = await totalQuery.getCount();

      // Apply pagination
      queryBuilder.limit(limit).offset(offset);

      // Execute query
      const plugins = await queryBuilder.getMany();

      return {
        plugins,
        total,
        hasMore: offset + plugins.length < total,
      };
    } catch (error) {
      this.logger.error(`Plugin search failed: ${error.message}`);
      return { plugins: [], total: 0, hasMore: false };
    }
  }

  async updatePluginStatus(
    id: string,
    status: PluginStatus,
    validationResults?: any,
  ): Promise<PluginEntity> {
    try {
      const plugin = await this.findPluginById(id);

      if (!plugin) {
        throw new NotFoundException(`Plugin not found: ${id}`);
      }

      plugin.status = status;
      plugin.updatedAt = new Date();

      if (validationResults) {
        plugin.validationResults = validationResults as ValidationResults;
      }

      if (status === PluginStatus.PUBLISHED && !plugin.publishedAt) {
        plugin.publishedAt = new Date();
      }

      if (status === PluginStatus.DEPRECATED && !plugin.deprecatedAt) {
        plugin.deprecatedAt = new Date();
      }

      const updatedPlugin = await this.pluginRepository.save(plugin);

      this.logger.log(
        `Updated plugin status: ${plugin.name}@${plugin.version} -> ${status}`,
      );

      return updatedPlugin;
    } catch (error) {
      this.logger.error(`Failed to update plugin status: ${error.message}`);
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
        `Failed to increment download count for ${id}: ${error.message}`,
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
      this.logger.error(`Failed to update plugin rating: ${error.message}`);
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
      this.logger.error(`Failed to delete plugin: ${error.message}`);
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
    try {
      const [
        total, 
        statusStats, 
        categoryStats, 
        downloadStats, 
        ratingStats
      ] = await Promise.all([
          this.pluginRepository.count(),
          this.pluginRepository
            .createQueryBuilder('plugin')
            .select('plugin.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('plugin.status')
            .getRawMany(),
          this.pluginRepository
            .createQueryBuilder('plugin')
            .select('plugin.category', 'category')
            .addSelect('COUNT(*)', 'count')
            .groupBy('plugin.category')
            .getRawMany(),
          this.pluginRepository
            .createQueryBuilder('plugin')
            .select('SUM(plugin.downloadCount)', 'totalDownloads')
            .getRawOne() as Promise<DatabaseDownloadResult>,
          this.pluginRepository
            .createQueryBuilder('plugin')
            .select('AVG(plugin.rating)', 'averageRating')
            .where('plugin.ratingCount > 0')
            .getRawOne() as Promise<DatabaseRatingResult>,
        ]);

      const byStatus = {} as Record<PluginStatus, number>;
      statusStats.forEach((stat: DatabaseQueryResult) => {
        byStatus[stat.status as PluginStatus] = parseInt(String(stat.count), 10);
      });

      const byCategory = {} as Record<PluginCategory, number>;
      categoryStats.forEach((stat: DatabaseCategoryResult) => {
        byCategory[stat.category as PluginCategory] = parseInt(String(stat.count), 10);
      });

      return {
        total,
        byStatus,
        byCategory,
        totalDownloads: parseInt(String(downloadStats?.totalDownloads ?? '0'), 10),
        averageRating: parseFloat(String(ratingStats?.averageRating ?? '0')),
      };
    } catch (error) {
      this.logger.error(`Failed to get plugin stats: ${error.message}`);
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
    try {
      return await this.pluginRepository.find({
        where: { status: PluginStatus.PUBLISHED },
        order: {
          downloadCount: 'DESC',
          rating: 'DESC',
        },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Failed to get popular plugins: ${error.message}`);
      return [];
    }
  }

  async getRecentPlugins(limit = 10): Promise<PluginEntity[]> {
    try {
      return await this.pluginRepository.find({
        where: { status: PluginStatus.PUBLISHED },
        order: { publishedAt: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Failed to get recent plugins: ${error.message}`);
      return [];
    }
  }
}
