import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  HttpCode, 
  HttpStatus,
  UseFilters,
  Logger
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiQuery,
  ApiSecurity,
  ApiBody,
  ApiConsumes,
  ApiProduces,
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath
} from '@nestjs/swagger';
import { PluginManagerService } from './plugin-manager.service';
import { PluginMetricsService } from './plugin-metrics.service';
import { SecurityManager } from './security-manager.service';
import { 
  InstallPluginDto, 
  UpdatePluginDto, 
  PluginInfoDto, 
  PluginHealthDto, 
  PluginMetricsDto,
  PluginLoadOptionsDto,
  PluginManifestDto,
  PluginSecurityDto,
  PluginDetailDto,
  PluginErrorDto
} from '../common/dto/plugin.dto';
import { PluginStatus } from '../common/interfaces/plugin.interface';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

@ApiTags('plugins')
@Controller('api/plugins')
@UseFilters(HttpExceptionFilter)
@ApiBearerAuth('JWT-auth')
@ApiExtraModels(
  PluginInfoDto,
  PluginHealthDto,
  PluginMetricsDto,
  InstallPluginDto,
  UpdatePluginDto,
  PluginLoadOptionsDto,
  PluginManifestDto,
  PluginSecurityDto,
  PluginDetailDto,
  PluginErrorDto
)
export class PluginController {
  private readonly logger = new Logger(PluginController.name);

  constructor(
    private readonly pluginManager: PluginManagerService,
    private readonly metricsService: PluginMetricsService,
    private readonly securityManager: SecurityManager
  ) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get all plugins',
    description: `
      Retrieves a comprehensive list of all installed plugins in the system.
      
      **Features:**
      - Filter by tenant for multi-tenant environments
      - Filter by plugin status (active, inactive, error, loading)
      - Paginated results for large plugin collections
      - Real-time status information
      
      **Use Cases:**
      - Plugin management dashboard
      - System health monitoring
      - Tenant-specific plugin listing
      - Plugin discovery and exploration
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Successfully retrieved plugin list',
    schema: {
      type: 'array',
      items: { $ref: getSchemaPath(PluginInfoDto) },
      example: [
        {
          id: 'analytics-plugin',
          name: 'Analytics Plugin',
          version: '1.2.0',
          description: 'Advanced analytics and reporting capabilities',
          author: 'Enterprise Team',
          status: 'active',
          created: '2024-01-15T10:30:00Z',
          updated: '2024-01-20T14:15:00Z',
          tenantId: 'tenant-001'
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing authentication' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiQuery({ 
    name: 'tenantId', 
    required: false, 
    description: 'Filter plugins by tenant ID for multi-tenant isolation',
    example: 'tenant-001'
  })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    enum: PluginStatus, 
    description: 'Filter plugins by current status',
    example: 'active'
  })
  async getAllPlugins(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: PluginStatus
  ): Promise<PluginInfoDto[]> {
    this.logger.log('Getting all plugins');
    
    let plugins = tenantId 
      ? this.pluginManager.getPluginsByTenant(tenantId)
      : this.pluginManager.getAllPlugins();

    if (status) {
      plugins = plugins.filter(p => p.status === status);
    }

    return plugins.map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      status: plugin.status,
      created: plugin.created,
      updated: plugin.updated,
      tenantId: plugin.tenantId
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plugin by ID' })
  @ApiResponse({ status: 200, description: 'Plugin details', type: PluginInfoDto })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  @ApiParam({ name: 'id', description: 'Plugin ID' })
  async getPlugin(@Param('id') id: string): Promise<PluginInfoDto> {
    this.logger.log(`Getting plugin: ${id}`);
    
    const metadata = this.pluginManager.getPluginMetadata(id);
    if (!metadata) {
      throw new Error(`Plugin ${id} not found`);
    }

    return {
      id: metadata.id,
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      author: metadata.author,
      status: metadata.status,
      created: metadata.created,
      updated: metadata.updated,
      tenantId: metadata.tenantId
    };
  }

  @Post()
  @ApiOperation({ 
    summary: 'Install a new plugin',
    description: `
      Installs a new plugin from various sources including:
      - Local file system paths
      - Remote URLs (HTTP/HTTPS)
      - NPM package names
      - Git repositories
      - Plugin marketplace
      
      **Installation Process:**
      1. Download/locate plugin source
      2. Validate plugin manifest and structure
      3. Perform security checks and dependency validation
      4. Create sandboxed environment (if enabled)
      5. Initialize plugin and register routes
      6. Start health monitoring
      
      **Security Features:**
      - Automatic malware scanning
      - Permission validation
      - Resource limit enforcement
      - Sandbox isolation
    `
  })
  @ApiBody({
    type: InstallPluginDto,
    description: 'Plugin installation configuration',
    examples: {
      'local-plugin': {
        summary: 'Install from local path',
        description: 'Install a plugin from local file system',
        value: {
          source: './plugins/my-custom-plugin',
          options: {
            tenantId: 'tenant-001',
            sandboxed: true,
            resourceLimits: {
              memory: '128MB',
              cpu: '0.5',
              disk: '1GB',
              network: '10MB/s',
              executionTime: 30000
            },
            permissions: [
              { name: 'api:read', description: 'Read API access', level: 'read' },
              { name: 'database:write', description: 'Database write access', level: 'write' }
            ]
          }
        }
      },
      'remote-plugin': {
        summary: 'Install from URL',
        description: 'Install a plugin from remote URL',
        value: {
          source: 'https://plugins.example.com/advanced-analytics.zip',
          options: {
            tenantId: 'tenant-002',
            sandboxed: true,
            hotReload: true
          }
        }
      },
      'npm-plugin': {
        summary: 'Install from NPM',
        description: 'Install a plugin from NPM registry',
        value: {
          source: '@company/analytics-plugin@^2.0.0',
          options: {
            config: {
              apiEndpoint: 'https://analytics.company.com',
              enableCaching: true
            }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Plugin installed successfully',
    schema: {
      $ref: getSchemaPath(PluginInfoDto),
      example: {
        id: 'analytics-plugin',
        name: 'Analytics Plugin',
        version: '2.1.0',
        description: 'Advanced analytics and reporting',
        author: 'Enterprise Team',
        status: 'active',
        created: '2024-01-20T15:30:00Z',
        updated: '2024-01-20T15:30:00Z',
        tenantId: 'tenant-001'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid plugin data or source' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Conflict - Plugin already exists' })
  @ApiResponse({ status: 422, description: 'Unprocessable Entity - Plugin validation failed' })
  @ApiResponse({ status: 500, description: 'Internal server error during installation' })
  @HttpCode(HttpStatus.CREATED)
  async installPlugin(@Body() installDto: InstallPluginDto): Promise<PluginInfoDto> {
    this.logger.log(`Installing plugin from source: ${installDto.source}`);
    
    // Extract plugin ID from source (simplified)
    const pluginId = this.extractPluginIdFromSource(installDto.source);
    
    const metadata = await this.pluginManager.loadPlugin(pluginId, installDto.options);
    
    return {
      id: metadata.id,
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      author: metadata.author,
      status: metadata.status,
      created: metadata.created,
      updated: metadata.updated,
      tenantId: metadata.tenantId
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a plugin' })
  @ApiResponse({ status: 200, description: 'Plugin updated successfully', type: PluginInfoDto })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  @ApiParam({ name: 'id', description: 'Plugin ID' })
  async updatePlugin(
    @Param('id') id: string,
    @Body() updateDto: UpdatePluginDto
  ): Promise<PluginInfoDto> {
    this.logger.log(`Updating plugin: ${id}`);
    
    const metadata = updateDto.version 
      ? await this.pluginManager.updatePlugin(id, updateDto.version)
      : this.pluginManager.getPluginMetadata(id);

    if (!metadata) {
      throw new Error(`Plugin ${id} not found`);
    }

    return {
      id: metadata.id,
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      author: metadata.author,
      status: metadata.status,
      created: metadata.created,
      updated: metadata.updated,
      tenantId: metadata.tenantId
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Uninstall a plugin' })
  @ApiResponse({ status: 204, description: 'Plugin uninstalled successfully' })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  @ApiParam({ name: 'id', description: 'Plugin ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async uninstallPlugin(@Param('id') id: string): Promise<void> {
    this.logger.log(`Uninstalling plugin: ${id}`);
    await this.pluginManager.unloadPlugin(id);
  }

  @Post(':id/enable')
  @ApiOperation({ summary: 'Enable a plugin' })
  @ApiResponse({ status: 200, description: 'Plugin enabled successfully' })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  @ApiParam({ name: 'id', description: 'Plugin ID' })
  async enablePlugin(@Param('id') id: string): Promise<{ message: string }> {
    this.logger.log(`Enabling plugin: ${id}`);
    await this.pluginManager.enablePlugin(id);
    return { message: `Plugin ${id} enabled successfully` };
  }

  @Post(':id/disable')
  @ApiOperation({ summary: 'Disable a plugin' })
  @ApiResponse({ status: 200, description: 'Plugin disabled successfully' })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  @ApiParam({ name: 'id', description: 'Plugin ID' })
  async disablePlugin(@Param('id') id: string): Promise<{ message: string }> {
    this.logger.log(`Disabling plugin: ${id}`);
    await this.pluginManager.disablePlugin(id);
    return { message: `Plugin ${id} disabled successfully` };
  }

  @Post(':id/reload')
  @ApiOperation({ summary: 'Reload a plugin' })
  @ApiResponse({ status: 200, description: 'Plugin reloaded successfully', type: PluginInfoDto })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  @ApiParam({ name: 'id', description: 'Plugin ID' })
  async reloadPlugin(@Param('id') id: string): Promise<PluginInfoDto> {
    this.logger.log(`Reloading plugin: ${id}`);
    
    const metadata = await this.pluginManager.reloadPlugin(id);
    
    return {
      id: metadata.id,
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      author: metadata.author,
      status: metadata.status,
      created: metadata.created,
      updated: metadata.updated,
      tenantId: metadata.tenantId
    };
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Get plugin health status' })
  @ApiResponse({ status: 200, description: 'Plugin health status', type: PluginHealthDto })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  @ApiParam({ name: 'id', description: 'Plugin ID' })
  async getPluginHealth(@Param('id') id: string): Promise<PluginHealthDto> {
    this.logger.log(`Getting health status for plugin: ${id}`);
    
    const health = await this.pluginManager.getPluginHealth(id);
    
    return {
      status: health.status,
      checks: health.checks,
      lastCheck: health.lastCheck,
      uptime: health.uptime
    };
  }

  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get plugin metrics' })
  @ApiResponse({ status: 200, description: 'Plugin metrics', type: PluginMetricsDto })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  @ApiParam({ name: 'id', description: 'Plugin ID' })
  async getPluginMetrics(@Param('id') id: string): Promise<PluginMetricsDto> {
    this.logger.log(`Getting metrics for plugin: ${id}`);
    
    const metrics = await this.metricsService.collectMetrics(id);
    
    return {
      pluginId: metrics.pluginId,
      memoryUsage: metrics.resource.memoryUsage,
      cpuUsage: metrics.resource.cpuUsage,
      requestCount: metrics.usage.requestCount,
      errorCount: metrics.errors.totalErrors,
      averageResponseTime: metrics.performance.averageResponseTime,
      timestamp: metrics.timestamp
    };
  }

  @Get(':id/security')
  @ApiOperation({ summary: 'Get plugin security status' })
  @ApiResponse({ status: 200, description: 'Plugin security status' })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  @ApiParam({ name: 'id', description: 'Plugin ID' })
  async getPluginSecurity(@Param('id') id: string): Promise<any> {
    this.logger.log(`Getting security status for plugin: ${id}`);
    
    const plugin = this.pluginManager.getPlugin(id);
    if (!plugin) {
      throw new Error(`Plugin ${id} not found`);
    }

    const securityResult = await this.securityManager.validatePlugin(plugin, []);
    const sandbox = this.securityManager.getSandbox(id);
    
    return {
      pluginId: id,
      isSecure: securityResult.isSecure,
      violations: securityResult.violations,
      warnings: securityResult.warnings,
      sandbox: sandbox ? {
        id: sandbox.id,
        resourceUsage: sandbox.resourceUsage,
        createdAt: sandbox.createdAt,
        lastActivity: sandbox.lastActivity
      } : null
    };
  }

  private extractPluginIdFromSource(source: string): string {
    // Simple extraction logic - in real implementation, this would handle
    // URLs, file paths, npm packages, etc.
    if (source.startsWith('http')) {
      return source.split('/').pop() || 'unknown';
    }
    
    if (source.includes('/')) {
      return source.split('/').pop() || 'unknown';
    }
    
    return source;
  }
}