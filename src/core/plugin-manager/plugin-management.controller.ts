import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PluginManagerService } from './plugin-manager.service';
import { PluginRegistryService } from '@/core/plugin-registry/plugin-registry.service';
import type { InstallationResult, LoadResult, PluginInstance, PluginSource, ReloadResult, UnloadResult, UpdateResult } from '@/types/plugin.types';
import { PluginStatus } from '@/types/plugin.types';

// DTOs for request/response
export class InstallPluginDto {
  type: 'file' | 'npm' | 'git' | 'url';
  location: string;
  version?: string;
}

export class UpdatePluginDto {
  version: string;
}

export class PluginStatusResponse {
  pluginId: string;
  status: PluginStatus;
  instance?: PluginInstance;
}

export class PluginListResponse {
  plugins: PluginInstance[];
  total: number;
}

@ApiTags('Plugin Management')
@Controller('plugins')
export class PluginManagementController {
  constructor(
    private readonly pluginManager: PluginManagerService,
    private readonly registryService: PluginRegistryService,
  ) {}

  @Post('install')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Install a new plugin' })
  @ApiBody({
    type: InstallPluginDto,
    examples: {
      file: {
        summary: 'Install from file system',
        value: {
          type: 'file',
          location: './src/plugins/templates/sample-plugin',
        },
      },
      npm: {
        summary: 'Install from NPM (not implemented)',
        value: {
          type: 'npm',
          location: '@my-org/my-plugin',
          version: '1.0.0',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Plugin installed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        pluginId: { type: 'string' },
        version: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid plugin source or validation failed' })
  @ApiResponse({ status: 409, description: 'Plugin already installed' })
  async installPlugin(@Body() installDto: InstallPluginDto): Promise<InstallationResult> {
    if (!installDto.type || !installDto.location) {
      throw new BadRequestException('Plugin type and location are required');
    }

    const source: PluginSource = {
      type: installDto.type,
      location: installDto.location,
      version: installDto.version,
    };

    const result = await this.pluginManager.installPlugin(source);

    if (!result.success) {
      if (result.message?.includes('already installed')) {
        throw new ConflictException(result.message);
      }
      throw new BadRequestException(result.message ?? 'Plugin installation failed');
    }

    return result;
  }

  @Post(':pluginId/load')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Load and activate a plugin' })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (name@version)' })
  @ApiResponse({
    status: 200,
    description: 'Plugin loaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        pluginId: { type: 'string' },
        loadTime: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found or not installed' })
  @ApiResponse({ status: 409, description: 'Plugin already loaded' })
  async loadPlugin(@Param('pluginId') pluginId: string): Promise<LoadResult> {
    if (!pluginId) {
      throw new BadRequestException('Plugin ID is required');
    }

    const result = await this.pluginManager.loadPlugin(pluginId);

    if (!result.success) {
      if (result.message?.includes('not found')) {
        throw new NotFoundException(result.message);
      }
      if (result.message?.includes('already loaded')) {
        throw new ConflictException(result.message);
      }
      throw new BadRequestException(result.message ?? 'Plugin loading failed');
    }

    return result;
  }

  @Post(':pluginId/unload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unload a plugin' })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (name@version)' })
  @ApiResponse({
    status: 200,
    description: 'Plugin unloaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        pluginId: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found or not loaded' })
  async unloadPlugin(@Param('pluginId') pluginId: string): Promise<UnloadResult> {
    if (!pluginId) {
      throw new BadRequestException('Plugin ID is required');
    }

    const result = await this.pluginManager.unloadPlugin(pluginId);

    if (!result.success) {
      if (result.message?.includes('not loaded')) {
        throw new NotFoundException(result.message);
      }
      throw new BadRequestException(result.message ?? 'Plugin unloading failed');
    }

    return result;
  }

  @Post(':pluginId/reload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reload a plugin (unload then load)' })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (name@version)' })
  @ApiResponse({
    status: 200,
    description: 'Plugin reloaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        pluginId: { type: 'string' },
        loadTime: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  async reloadPlugin(@Param('pluginId') pluginId: string): Promise<ReloadResult> {
    if (!pluginId) {
      throw new BadRequestException('Plugin ID is required');
    }

    const result = await this.pluginManager.reloadPlugin(pluginId);

    if (!result.success) {
      throw new BadRequestException(result.message ?? 'Plugin reloading failed');
    }

    return result;
  }

  @Put(':pluginId/update')
  @ApiOperation({ summary: 'Update a plugin to a new version' })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (name@version)' })
  @ApiBody({ type: UpdatePluginDto })
  @ApiResponse({
    status: 200,
    description: 'Plugin updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        pluginId: { type: 'string' },
        fromVersion: { type: 'string' },
        toVersion: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  @ApiResponse({ status: 501, description: 'Plugin updates not yet implemented' })
  updatePlugin(@Param('pluginId') pluginId: string, @Body() updateDto: UpdatePluginDto): UpdateResult {
    if (!pluginId) {
      throw new BadRequestException('Plugin ID is required');
    }

    if (!updateDto.version) {
      throw new BadRequestException('Version is required');
    }

    const result = this.pluginManager.updatePlugin(pluginId, updateDto.version);

    if (!result.success) {
      throw new BadRequestException(result.message ?? 'Plugin update failed');
    }

    return result;
  }

  @Delete(':pluginId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Uninstall a plugin completely' })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (name@version)' })
  @ApiResponse({
    status: 200,
    description: 'Plugin uninstalled successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        pluginId: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  async uninstallPlugin(@Param('pluginId') pluginId: string): Promise<{ success: boolean; pluginId: string; message: string }> {
    if (!pluginId) {
      throw new BadRequestException('Plugin ID is required');
    }

    const success = await this.pluginManager.uninstallPlugin(pluginId);

    if (!success) {
      throw new NotFoundException(`Plugin not found or uninstallation failed: ${pluginId}`);
    }

    return {
      success: true,
      pluginId,
      message: 'Plugin uninstalled successfully',
    };
  }

  @Get(':pluginId/status')
  @ApiOperation({ summary: 'Get plugin status' })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (name@version)' })
  @ApiResponse({
    status: 200,
    description: 'Plugin status retrieved successfully',
    type: PluginStatusResponse,
  })
  getPluginStatus(@Param('pluginId') pluginId: string): PluginStatusResponse {
    if (!pluginId) {
      throw new BadRequestException('Plugin ID is required');
    }

    const status = this.pluginManager.getPluginStatus(pluginId);
    const instance = this.pluginManager.getPluginInstance(pluginId);

    return {
      pluginId,
      status,
      instance: instance ?? undefined,
    };
  }

  @Get('loaded')
  @ApiOperation({ summary: 'Get all loaded plugin instances' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of results' })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset for pagination' })
  @ApiResponse({
    status: 200,
    description: 'Loaded plugins retrieved successfully',
    type: PluginListResponse,
  })
  getLoadedPlugins(@Query('limit') limit?: string, @Query('offset') offset?: string): PluginListResponse {
    const allPlugins = this.pluginManager.getLoadedPlugins();

    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    let plugins = allPlugins;

    if (offsetNum > 0) {
      plugins = plugins.slice(offsetNum);
    }

    if (limitNum && limitNum > 0) {
      plugins = plugins.slice(0, limitNum);
    }

    return {
      plugins,
      total: allPlugins.length,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all plugins (installed and loaded)' })
  @ApiQuery({ name: 'status', required: false, enum: PluginStatus, description: 'Filter by plugin status' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of results' })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset for pagination' })
  @ApiResponse({
    status: 200,
    description: 'Plugins retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        plugins: {
          type: 'array',
          items: { type: 'object' },
        },
        total: { type: 'number' },
      },
    },
  })
  getAllPlugins(@Query('status') status?: PluginStatus, @Query('limit') limit?: string, @Query('offset') offset?: string): { plugins: any[]; total: number } {
    const registryPlugins = this.registryService.getAllPlugins();
    const loadedPlugins = this.pluginManager.getLoadedPlugins();

    // Merge registry and loaded plugin data
    const allPlugins = registryPlugins.map((registryPlugin) => {
      const loadedInstance = loadedPlugins.find((loaded) => loaded.id === registryPlugin.id);
      return {
        ...registryPlugin,
        instance: loadedInstance ?? null,
        currentStatus: loadedInstance?.status ?? registryPlugin.status,
      };
    });

    // Filter by status if provided
    let filteredPlugins = status ? allPlugins.filter((plugin) => plugin.currentStatus === status) : allPlugins;

    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    if (offsetNum > 0) {
      filteredPlugins = filteredPlugins.slice(offsetNum);
    }

    if (limitNum && limitNum > 0) {
      filteredPlugins = filteredPlugins.slice(0, limitNum);
    }

    return {
      plugins: filteredPlugins,
      total: allPlugins.length,
    };
  }
}
