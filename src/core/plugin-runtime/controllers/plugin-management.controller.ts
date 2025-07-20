import { Body, Controller, Delete, Get, Logger, Param, Post, Put, Query, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PluginLoaderService } from '../services/plugin-loader.service';
import { PluginContextService } from '../services/plugin-context.service';
import { PluginRouterService } from '../services/plugin-router.service';
import { PluginErrorCodes, PluginErrorHandler } from '@/shared/utils/error-handler.util';
import { PluginValidationUtil } from '@/shared/utils/validation.util';
import { PluginMetadata, PluginModule, PluginStatus, ValidationResult } from '@types';

/**
 * DTOs for Plugin Management API
 */
export class LoadPluginDto {
  pluginPath!: string;
  pluginId!: string;
}

export class CreateContextDto {
  pluginId!: string;
  configuration?: Record<string, unknown>;
}

export class ValidatePluginDto {
  pluginPath!: string;
}

/**
 * Enhanced controller for plugin runtime management operations
 */
@ApiTags('Plugin Runtime Management')
@Controller('runtime')
export class PluginManagementController {
  private readonly logger = new Logger(PluginManagementController.name);

  constructor(
    private readonly pluginLoader: PluginLoaderService,
    private readonly contextService: PluginContextService,
    private readonly routerService: PluginRouterService,
  ) {}

  /**
   * Load a plugin into the runtime
   */
  @Post('load')
  @ApiOperation({ summary: 'Load a plugin into the runtime' })
  @ApiResponse({ status: 201, description: 'Plugin loaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid plugin data' })
  @ApiResponse({ status: 500, description: 'Failed to load plugin' })
  async loadPlugin(@Body(ValidationPipe) loadPluginDto: LoadPluginDto): Promise<{
    success: boolean;
    pluginModule?: PluginModule;
    message: string;
    loadTime?: number;
  }> {
    try {
      this.logger.log(`Loading plugin: ${loadPluginDto.pluginId}`);

      // Validate inputs
      PluginErrorHandler.validatePluginId(loadPluginDto.pluginId, 'plugin loading');

      if (!PluginValidationUtil.validateFilePath(loadPluginDto.pluginPath)) {
        throw PluginErrorHandler.createPluginError(loadPluginDto.pluginId, PluginErrorCodes.INVALID_CONFIGURATION, 'Invalid plugin path provided');
      }

      // Create runtime context first
      const pluginId = loadPluginDto.pluginId;
      const pluginMetadata: PluginMetadata = {
        // Required properties from PluginMetadata interface
        id: pluginId,
        name: pluginId.split('@')[0] || 'unknown',
        status: PluginStatus.LOADING,
        loadTime: 0,
        memory: 0,
        cpu: 0,
        main: 'plugin.module.js',
        engines: { node: process.version, nestjs: '11.0.0' },
        hooks: {},
        configuration: {},
        runtimeMetadata: {
          category: 'runtime',
          tags: ['runtime-loaded'],
        },
        // Properties from BasePluginMetadata
        pluginId,
        version: pluginId.split('@')[1] || '1.0.0',
        category: 'runtime',
        keywords: ['runtime'],
        license: 'unknown',
        capabilities: [],
        permissions: [],
        dependencies: {},
        peerDependencies: {},
        devDependencies: {},
        verified: false,
        featured: false,
        deprecated: false,
        author: 'system',
        maintainers: [],
        versionChanges: [],
        security: {
          signed: false,
          verified: false,
        },
      };

      const runtimeContext = this.contextService.createRuntimeContext(pluginMetadata);

      // Load the plugin
      const startTime = Date.now();
      const pluginModule = await this.pluginLoader.loadPlugin(loadPluginDto.pluginPath, runtimeContext);
      const loadTime = Date.now() - startTime;

      this.logger.log(`Plugin loaded successfully: ${loadPluginDto.pluginId} (${loadTime}ms)`);

      return {
        success: true,
        pluginModule,
        message: `Plugin ${loadPluginDto.pluginId} loaded successfully`,
        loadTime,
      };
    } catch (error) {
      this.logger.error(`Failed to load plugin ${loadPluginDto.pluginId}:`, error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Unload a plugin from the runtime
   */
  @Delete('unload/:pluginId')
  @ApiOperation({ summary: 'Unload a plugin from the runtime' })
  @ApiParam({ name: 'pluginId', description: 'ID of the plugin to unload' })
  @ApiResponse({ status: 200, description: 'Plugin unloaded successfully' })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  async unloadPlugin(@Param('pluginId') pluginId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      PluginErrorHandler.validatePluginId(pluginId, 'plugin unloading');

      this.logger.log(`Unloading plugin: ${pluginId}`);

      await this.pluginLoader.unloadPlugin(pluginId);
      this.contextService.destroyPluginContext(pluginId);

      return {
        success: true,
        message: `Plugin ${pluginId} unloaded successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to unload plugin ${pluginId}:`, error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Reload a plugin in the runtime
   */
  @Put('reload/:pluginId')
  @ApiOperation({ summary: 'Reload a plugin in the runtime' })
  @ApiParam({ name: 'pluginId', description: 'ID of the plugin to reload' })
  @ApiResponse({ status: 200, description: 'Plugin reloaded successfully' })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  async reloadPlugin(@Param('pluginId') pluginId: string): Promise<{
    success: boolean;
    pluginModule?: PluginModule;
    message: string;
    loadTime?: number;
  }> {
    try {
      PluginErrorHandler.validatePluginId(pluginId, 'plugin reloading');

      this.logger.log(`Reloading plugin: ${pluginId}`);

      const startTime = Date.now();
      const pluginModule = await this.pluginLoader.reloadPlugin(pluginId);
      const loadTime = Date.now() - startTime;

      return {
        success: true,
        pluginModule,
        message: `Plugin ${pluginId} reloaded successfully`,
        loadTime,
      };
    } catch (error) {
      this.logger.error(`Failed to reload plugin ${pluginId}:`, error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Validate a plugin before loading
   */
  @Post('validate')
  @ApiOperation({ summary: 'Validate a plugin before loading' })
  @ApiResponse({ status: 200, description: 'Validation completed' })
  async validatePlugin(@Body(ValidationPipe) validatePluginDto: ValidatePluginDto): Promise<ValidationResult> {
    try {
      this.logger.log(`Validating plugin at: ${validatePluginDto.pluginPath}`);

      if (!PluginValidationUtil.validateFilePath(validatePluginDto.pluginPath)) {
        return {
          valid: false,
          errors: ['Invalid plugin path provided'],
          warnings: [],
        };
      }

      const result = await this.pluginLoader.validatePlugin(validatePluginDto.pluginPath);

      this.logger.log(`Plugin validation completed: ${result.valid ? 'VALID' : 'INVALID'}`);

      return result;
    } catch (error) {
      this.logger.error(`Plugin validation failed:`, error);

      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
        warnings: [],
      };
    }
  }

  /**
   * Get health status of a plugin
   */
  @Get('health/:pluginId')
  @ApiOperation({ summary: 'Get health status of a plugin' })
  @ApiParam({ name: 'pluginId', description: 'ID of the plugin' })
  @ApiResponse({ status: 200, description: 'Health status retrieved' })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  async getPluginHealth(@Param('pluginId') pluginId: string) {
    try {
      PluginErrorHandler.validatePluginId(pluginId, 'health check');

      const health = await this.pluginLoader.checkPluginHealth(pluginId);

      if (!health) {
        return {
          pluginId,
          status: 'not_found',
          message: 'Plugin not loaded',
        };
      }

      return {
        pluginId,
        status: health.healthy ? 'healthy' : 'unhealthy',
        details: health,
      };
    } catch (error) {
      this.logger.error(`Failed to check plugin health for ${pluginId}:`, error);

      return {
        pluginId,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all loaded plugins
   */
  @Get('plugins')
  @ApiOperation({ summary: 'Get all loaded plugins' })
  @ApiQuery({ name: 'includeDetails', required: false, description: 'Include detailed information' })
  @ApiResponse({ status: 200, description: 'Loaded plugins retrieved' })
  getLoadedPlugins(@Query('includeDetails') includeDetails?: string) {
    try {
      const plugins = this.pluginLoader.getAllLoadedModules();

      if (includeDetails === 'true') {
        return {
          count: plugins.length,
          plugins: plugins.map((plugin) => ({
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
            status: plugin.status,
            loadTime: plugin.loadTime,
            lastActivity: plugin.lastActivity,
            controllersCount: plugin.exports?.controllers?.length ?? 0,
            providersCount: plugin.exports?.providers?.length ?? 0,
          })),
        };
      }

      return {
        count: plugins.length,
        plugins: plugins.map((plugin) => ({
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          status: plugin.status.state,
          healthy: plugin.status.healthy,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get loaded plugins:', error);

      return {
        count: 0,
        plugins: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get plugin routes
   */
  @Get('routes/:pluginId')
  @ApiOperation({ summary: 'Get routes for a specific plugin' })
  @ApiParam({ name: 'pluginId', description: 'ID of the plugin' })
  @ApiResponse({ status: 200, description: 'Plugin routes retrieved' })
  getPluginRoutes(@Param('pluginId') pluginId: string) {
    try {
      PluginErrorHandler.validatePluginId(pluginId, 'route retrieval');

      const routes = this.routerService.getPluginRoutes(pluginId);

      return {
        pluginId,
        routeCount: routes.length,
        routes: routes.map((route) => ({
          method: route.method,
          path: route.path,
          controllerName: route.controllerName,
          methodName: route.methodName,
          permissions: route.permissions,
          middlewares: route.middlewares,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get routes for plugin ${pluginId}:`, error);

      return {
        pluginId,
        routeCount: 0,
        routes: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get runtime statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get runtime statistics' })
  @ApiResponse({ status: 200, description: 'Runtime statistics retrieved' })
  getRuntimeStats() {
    try {
      const plugins = this.pluginLoader.getAllLoadedModules();
      const routeStats = this.routerService.getRouteStatistics();

      const healthyPlugins = plugins.filter((p) => p.status.healthy).length;
      const totalLoadTime = plugins.reduce((sum, p) => sum + p.loadTime, 0);
      const averageLoadTime = plugins.length > 0 ? totalLoadTime / plugins.length : 0;

      return {
        plugins: {
          total: plugins.length,
          healthy: healthyPlugins,
          unhealthy: plugins.length - healthyPlugins,
          averageLoadTime: Math.round(averageLoadTime),
          totalLoadTime,
        },
        routes: routeStats,
        memory: {
          usage: process.memoryUsage(),
          uptime: process.uptime(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get runtime statistics:', error);

      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
