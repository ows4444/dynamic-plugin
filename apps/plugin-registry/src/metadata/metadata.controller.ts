import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { getErrorMessage } from '@lib/shared/common';
import { PluginCategory, PluginStatus } from './metadata.entity';
import { MetadataService, PluginSearchQuery, PluginSortBy } from './metadata.service';

@Controller('plugins')
export class MetadataController {
  private readonly logger = new Logger(MetadataController.name);

  constructor(private readonly metadataService: MetadataService) {}

  @Get()
  async searchPlugins(
    @Query('name') name?: string,
    @Query('author') author?: string,
    @Query('category') category?: PluginCategory,
    @Query('tags') tags?: string,
    @Query('status') status?: PluginStatus,
    @Query('minRating') minRating?: number,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    try {
      const query: PluginSearchQuery = {
        name,
        author,
        category,
        tags: tags ? tags.split(',') : undefined,
        status,
        minRating,
        search,
        limit,
        offset,
        sortBy: sortBy as PluginSortBy,
        sortOrder,
      };

      const result = await this.metadataService.searchPlugins(query);

      return {
        success: true,
        data: {
          plugins: result.plugins,
          pagination: {
            total: result.total,
            limit: query.limit ?? 50,
            offset: query.offset ?? 0,
            hasMore: result.hasMore,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Search failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  @Get('stats')
  async getPluginStats() {
    try {
      const stats = await this.metadataService.getPluginStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(`Failed to get stats: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  @Get('popular')
  async getPopularPlugins(@Query('limit') limit?: number) {
    try {
      const plugins = await this.metadataService.getPopularPlugins(limit ?? 10);

      return {
        success: true,
        data: plugins,
      };
    } catch (error) {
      this.logger.error(`Failed to get popular plugins: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  @Get('recent')
  async getRecentPlugins(@Query('limit') limit?: number) {
    try {
      const plugins = await this.metadataService.getRecentPlugins(limit ?? 10);

      return {
        success: true,
        data: plugins,
      };
    } catch (error) {
      this.logger.error(`Failed to get recent plugins: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  @Get(':id')
  async getPluginById(@Param('id') id: string) {
    try {
      const plugin = await this.metadataService.findPluginById(id);

      if (!plugin) {
        throw new NotFoundException(`Plugin not found: ${id}`);
      }

      return {
        success: true,
        data: plugin,
      };
    } catch (error) {
      this.logger.error(`Failed to get plugin ${id}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  @Get('name/:name')
  async getPluginsByName(@Param('name') name: string) {
    try {
      const plugins = await this.metadataService.findPluginsByName(name);

      return {
        success: true,
        data: plugins,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get plugins by name ${name}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  @Get(':name/:version')
  async getPluginByNameVersion(
    @Param('name') name: string,
    @Param('version') version: string,
  ) {
    try {
      const plugin = await this.metadataService.findPlugin(name, version);

      if (!plugin) {
        throw new NotFoundException(`Plugin not found: ${name}@${version}`);
      }

      return {
        success: true,
        data: plugin,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get plugin ${name}@${version}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  @Put(':id/status')
  async updatePluginStatus(
    @Param('id') id: string,
    @Body() body: { status: PluginStatus; validationResults?: any },
  ) {
    try {
      const plugin = await this.metadataService.updatePluginStatus(
        id,
        body.status,
        body.validationResults,
      );

      this.logger.log(`Updated plugin status: ${id} -> ${body.status}`);

      return {
        success: true,
        data: plugin,
        message: `Plugin status updated to ${body.status}`,
      };
    } catch (error) {
      this.logger.error(`Failed to update plugin status: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  @Put(':id/rating')
  async updatePluginRating(
    @Param('id') id: string,
    @Body() body: { rating: number; incrementCount?: boolean },
  ) {
    try {
      const plugin = await this.metadataService.updatePluginRating(
        id,
        body.rating,
        body.incrementCount,
      );

      return {
        success: true,
        data: plugin,
        message: 'Plugin rating updated',
      };
    } catch (error) {
      this.logger.error(`Failed to update plugin rating: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  @Delete(':id')
  async deletePlugin(@Param('id') id: string) {
    try {
      await this.metadataService.deletePlugin(id);

      this.logger.log(`Deleted plugin: ${id}`);

      return {
        success: true,
        message: 'Plugin deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete plugin: ${getErrorMessage(error)}`);
      throw error;
    }
  }
}
