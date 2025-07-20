import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PluginRegistryService } from './plugin-registry.service';
import { CompatibilityResult, PluginDependency, PluginMetadata, PluginRegistryEntry, PluginRegistrySortBy, PluginSearchQuery, PluginSearchResult, PluginStats, SortOrder } from '@types';

// DTOs for request/response
export class PluginSearchDto implements PluginSearchQuery {
  query?: string;
  category?: string;
  tags?: string[];
  capabilities?: string[];
  author?: string;
  verified?: boolean;
  sortBy?: PluginRegistrySortBy;
  sortOrder?: SortOrder;
  limit?: number;
  offset?: number;
}

@ApiTags('Plugin Registry')
@Controller('registry')
export class PluginRegistryController {
  constructor(private readonly registryService: PluginRegistryService) {}

  @Get('discover')
  @ApiOperation({ summary: 'Auto-discover installed plugins' })
  @ApiResponse({
    status: 200,
    description: 'Plugins discovered successfully',
    schema: {
      type: 'object',
      properties: {
        plugins: {
          type: 'array',
          items: { type: 'object' },
        },
        count: { type: 'number' },
      },
    },
  })
  async discoverPlugins(): Promise<{ plugins: PluginMetadata[]; count: number }> {
    const plugins = await this.registryService.discoverPlugins();
    return {
      plugins,
      count: plugins.length,
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search and filter plugins in the registry' })
  @ApiQuery({ name: 'query', required: false, description: 'Search term' })
  @ApiQuery({ name: 'category', required: false, description: 'Plugin category' })
  @ApiQuery({ name: 'tags', required: false, description: 'Plugin tags (comma-separated)' })
  @ApiQuery({ name: 'capabilities', required: false, description: 'Plugin capabilities (comma-separated)' })
  @ApiQuery({ name: 'author', required: false, description: 'Plugin author' })
  @ApiQuery({ name: 'verified', required: false, type: Boolean })
  @ApiQuery({ name: 'sortBy', required: false, enum: PluginRegistrySortBy })
  @ApiQuery({ name: 'sortOrder', required: false, enum: SortOrder })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Search results returned successfully',
    schema: {
      type: 'object',
      properties: {
        plugins: {
          type: 'array',
          items: { type: 'object' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        hasMore: { type: 'boolean' },
      },
    },
  })
  searchPlugins(@Query() searchDto: PluginSearchDto): PluginSearchResult {
    // Convert comma-separated strings to arrays
    if (searchDto.tags && typeof searchDto.tags === 'string') {
      searchDto.tags = (searchDto.tags as string).split(',').map((tag) => tag.trim());
    }
    if (searchDto.capabilities && typeof searchDto.capabilities === 'string') {
      searchDto.capabilities = (searchDto.capabilities as string).split(',').map((cap) => cap.trim());
    }

    // Validate pagination parameters
    if (searchDto.limit && (searchDto.limit < 1 || searchDto.limit > 100)) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }
    if (searchDto.offset && searchDto.offset < 0) {
      throw new BadRequestException('Offset must be non-negative');
    }

    return this.registryService.searchPlugins(searchDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get plugin registry statistics' })
  @ApiResponse({
    status: 200,
    description: 'Registry statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalPlugins: { type: 'number' },
        installedPlugins: { type: 'number' },
        enabledPlugins: { type: 'number' },
        categoriesCount: { type: 'number' },
        averageRating: { type: 'number' },
        totalDownloads: { type: 'number' },
        topCategories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
        topAuthors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              author: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
        recentlyUpdated: {
          type: 'array',
          items: { type: 'object' },
        },
        mostPopular: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  })
  getStats(): PluginStats {
    return this.registryService.getPluginStats();
  }

  @Get('plugins')
  @ApiOperation({ summary: 'Get all plugins in registry' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiResponse({
    status: 200,
    description: 'All plugins retrieved successfully',
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
  getAllPlugins(@Query('category') category?: string): { plugins: PluginRegistryEntry[]; total: number } {
    let plugins: PluginRegistryEntry[];

    if (category) {
      plugins = this.registryService.getPluginsByCategory(category);
    } else {
      plugins = this.registryService.getAllPlugins();
    }

    return {
      plugins,
      total: plugins.length,
    };
  }

  @Get('plugins/:pluginId')
  @ApiOperation({ summary: 'Get specific plugin details from registry' })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (name@version)' })
  @ApiResponse({
    status: 200,
    description: 'Plugin details retrieved successfully',
    schema: { type: 'object' },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found in registry' })
  getPlugin(@Param('pluginId') pluginId: string): PluginRegistryEntry {
    if (!pluginId) {
      throw new BadRequestException('Plugin ID is required');
    }

    const plugin = this.registryService.getPlugin(pluginId);
    if (!plugin) {
      throw new NotFoundException(`Plugin not found in registry: ${pluginId}`);
    }

    return plugin;
  }

  @Get('plugins/:pluginId/dependencies')
  @ApiOperation({ summary: 'Get plugin dependencies' })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (name@version)' })
  @ApiResponse({
    status: 200,
    description: 'Plugin dependencies retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        pluginId: { type: 'string' },
        dependencies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
              required: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  getPluginDependencies(@Param('pluginId') pluginId: string): { pluginId: string; dependencies: PluginDependency[] } {
    if (!pluginId) {
      throw new BadRequestException('Plugin ID is required');
    }

    try {
      const dependencies = this.registryService.getPluginDependencies(pluginId);
      return {
        pluginId,
        dependencies,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException('Failed to get plugin dependencies');
    }
  }

  @Get('plugins/:pluginId/compatibility')
  @ApiOperation({ summary: 'Check plugin compatibility with current system' })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (name@version)' })
  @ApiResponse({
    status: 200,
    description: 'Compatibility check completed',
    schema: {
      type: 'object',
      properties: {
        pluginId: { type: 'string' },
        compatible: { type: 'boolean' },
        reasons: {
          type: 'array',
          items: { type: 'string' },
        },
        suggestions: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  checkCompatibility(@Param('pluginId') pluginId: string): { pluginId: string } & CompatibilityResult {
    if (!pluginId) {
      throw new BadRequestException('Plugin ID is required');
    }

    try {
      const result = this.registryService.checkCompatibility(pluginId);
      return {
        pluginId,
        ...result,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException('Failed to check plugin compatibility');
    }
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all plugin categories' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              count: { type: 'number' },
              plugins: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  })
  getCategories(): { categories: Array<{ name: string; count: number; plugins: string[] }>; total: number } {
    // const stats = this.registryService.getPluginStats();
    const allPlugins = this.registryService.getAllPlugins();

    // Group plugins by category
    const categoryMap = new Map<string, string[]>();
    allPlugins.forEach((plugin) => {
      if (!categoryMap.has(plugin.category)) {
        categoryMap.set(plugin.category, []);
      }
      categoryMap.get(plugin.category)!.push(plugin.id);
    });

    const categories = Array.from(categoryMap.entries()).map(([name, plugins]) => ({
      name,
      count: plugins.length,
      plugins,
    }));

    return {
      categories,
      total: categories.length,
    };
  }

  @Get('categories/:category/plugins')
  @ApiOperation({ summary: 'Get plugins in a specific category' })
  @ApiParam({ name: 'category', description: 'Category name' })
  @ApiResponse({
    status: 200,
    description: 'Category plugins retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        plugins: {
          type: 'array',
          items: { type: 'object' },
        },
        count: { type: 'number' },
      },
    },
  })
  getCategoryPlugins(@Param('category') category: string): { category: string; plugins: PluginRegistryEntry[]; count: number } {
    if (!category) {
      throw new BadRequestException('Category is required');
    }

    const plugins = this.registryService.getPluginsByCategory(category);

    return {
      category,
      plugins,
      count: plugins.length,
    };
  }
}
