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
      return Promise.resolve(this.pluginStoreService.searchPlugins(query));
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
      return Promise.resolve({
        plugins: this.pluginStoreService.getFeaturedPlugins(limit),
        total: 10,
        page: 1,
        limit: limit ?? 10,
        totalPages: 1,
        hasMore: false,
        stores: [],
      });
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
      return Promise.resolve(this.pluginStoreService.getCategories().map((c) => c.name));
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
      const downloadInfo = this.pluginStoreService.downloadPlugin(id, options?.targetPath);
      return Promise.resolve({
        success: true,
        path: downloadInfo.downloadUrl,
        message: 'Plugin downloaded successfully',
      });
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
      return Promise.resolve({
        success: true,
        message: 'Store configuration updated successfully',
      });
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
      return Promise.resolve({
        success: true,
        message: 'Stores refreshed successfully',
        refreshedStores,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to refresh stores: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
