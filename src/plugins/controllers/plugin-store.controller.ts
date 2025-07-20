import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { PluginStoreService } from '../services/plugin-store.service';
import { PluginDownloadInfo, PluginStoreConfig, PluginStoreMetrics, PluginStoreQuery, PluginStoreResult } from '@types';

/**
 * Plugin Store Controller - REST API for plugin marketplace functionality
 */
@Controller('plugins/store')
export class PluginStoreController {
  constructor(private readonly pluginStoreService: PluginStoreService) {}

  /**
   * Search plugins across all configured stores
   */
  @Get('search')
  searchPlugins(@Query() query: PluginStoreQuery): Promise<PluginStoreResult> {
    try {
      return this.pluginStoreService.searchPlugins(query);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to search plugins: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get featured plugins from all stores
   */
  @Get('featured')
  getFeaturedPlugins(@Query('limit') limit?: number): Promise<PluginStoreResult> {
    try {
      return this.pluginStoreService.getFeaturedPlugins(limit);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get featured plugins: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get plugin categories from all stores
   */
  @Get('categories')
  getCategories(): Promise<string[]> {
    try {
      return this.pluginStoreService.getCategories();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get categories: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get plugin details by ID
   */
  @Get('plugin/:id')
  getPluginDetails(@Param('id') id: string): Promise<PluginDownloadInfo> {
    try {
      return this.pluginStoreService.getPluginDownloadInfo(id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get plugin details: ${errorMessage}`, HttpStatus.NOT_FOUND);
    }
  }

  /**
   * Download a plugin from store
   */
  @Post('download/:id')
  downloadPlugin(@Param('id') id: string, @Body() options?: { targetPath?: string }): Promise<{ success: boolean; path: string; message?: string }> {
    try {
      const path = this.pluginStoreService.downloadPlugin(id, options?.targetPath);
      return {
        success: true,
        path,
        message: 'Plugin downloaded successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to download plugin: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get store metrics and statistics
   */
  @Get('metrics')
  getStoreMetrics(): Promise<PluginStoreMetrics> {
    try {
      return this.pluginStoreService.getStoreMetrics();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get store metrics: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get store configuration
   */
  @Get('config')
  getStoreConfig(): Promise<PluginStoreConfig> {
    try {
      return this.pluginStoreService.getStoreConfig();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get store configuration: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Update store configuration
   */
  @Post('config')
  updateStoreConfig(@Body() config: Partial<PluginStoreConfig>): Promise<{ success: boolean; message: string }> {
    try {
      this.pluginStoreService.updateStoreConfig(config);
      return {
        success: true,
        message: 'Store configuration updated successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to update store configuration: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Refresh plugin data from all stores
   */
  @Post('refresh')
  refreshStores(): Promise<{ success: boolean; message: string; refreshedStores: number }> {
    try {
      const refreshedStores = this.pluginStoreService.refreshStores();
      return {
        success: true,
        message: 'Stores refreshed successfully',
        refreshedStores,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to refresh stores: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
