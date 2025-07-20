import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PluginDemoService } from './plugin-demo.service';
import { PluginBootstrapService } from './plugin-bootstrap.service';

@ApiTags('Plugin Demo & Examples')
@Controller('demo')
export class PluginDemoController {
  constructor(
    private readonly demoService: PluginDemoService,
    private readonly bootstrapService: PluginBootstrapService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get plugin system status and bootstrap information' })
  @ApiResponse({
    status: 200,
    description: 'Plugin system status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string' },
        bootstrapStatus: {
          type: 'object',
          properties: {
            pluginSystemReady: { type: 'boolean' },
            samplePluginInstalled: { type: 'boolean' },
            samplePluginLoaded: { type: 'boolean' },
            totalPlugins: { type: 'number' },
            loadedPlugins: { type: 'number' },
          },
        },
      },
    },
  })
  getStatus(): {
    timestamp: string;
    bootstrapStatus: any;
  } {
    const bootstrapStatus = this.bootstrapService.getBootstrapStatus();

    return {
      timestamp: new Date().toISOString(),
      bootstrapStatus,
    };
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run a complete plugin system demonstration',
    description: 'Demonstrates all major plugin functionality including search, events, status checks, and more',
  })
  @ApiResponse({
    status: 200,
    description: 'Plugin demonstration completed successfully',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string' },
        duration: { type: 'number' },
        success: { type: 'boolean' },
        systemStatus: { type: 'object' },
        pluginOperations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              operation: { type: 'string' },
              success: { type: 'boolean' },
              result: { type: 'object' },
              error: { type: 'string' },
            },
          },
        },
        eventDemonstration: { type: 'object' },
      },
    },
  })
  runDemonstration(): {
    timestamp: string;
    duration: number;
    success: boolean;
    systemStatus: any;
    pluginOperations: any[];
    eventDemonstration: any;
  } {
    const startTime = Date.now();

    const result = this.demoService.demonstratePluginUsage();

    const duration = Date.now() - startTime;
    const success = result.pluginOperations.every((op) => op.success);

    return {
      timestamp: new Date().toISOString(),
      duration,
      success,
      ...result,
    };
  }

  @Get('endpoints')
  @ApiOperation({
    summary: 'Get all available plugin API endpoints',
    description: 'Returns a comprehensive list of all plugin-related API endpoints for easy discovery',
  })
  @ApiResponse({
    status: 200,
    description: 'API endpoints retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        availableEndpoints: {
          type: 'array',
          items: { type: 'string' },
        },
        samplePluginEndpoints: {
          type: 'array',
          items: { type: 'string' },
        },
        managementEndpoints: {
          type: 'array',
          items: { type: 'string' },
        },
        registryEndpoints: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  getEndpoints(): {
    availableEndpoints: string[];
    samplePluginEndpoints?: string[];
    managementEndpoints: string[];
    registryEndpoints: string[];
  } {
    return this.demoService.getPluginAPIEndpoints();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Perform health check on plugin system components',
    description: 'Checks the health of plugin registry, manager, sample plugin, and event system',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check completed',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string' },
        healthy: { type: 'boolean' },
        checks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              status: { type: 'string', enum: ['healthy', 'unhealthy'] },
              details: { type: 'object' },
            },
          },
        },
      },
    },
  })
  healthCheck(): {
    timestamp: string;
    healthy: boolean;
    checks: Array<{ name: string; status: 'healthy' | 'unhealthy'; details?: any }>;
  } {
    const result = this.demoService.performHealthCheck();

    return {
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  @Get('quick-start')
  @ApiOperation({
    summary: 'Get quick start guide and example usage',
    description: 'Returns a quick start guide with example API calls and usage patterns',
  })
  @ApiResponse({
    status: 200,
    description: 'Quick start guide retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        quickStart: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  step: { type: 'number' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  example: { type: 'string' },
                },
              },
            },
          },
        },
        examples: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              method: { type: 'string' },
              url: { type: 'string' },
              description: { type: 'string' },
              payload: { type: 'object' },
            },
          },
        },
      },
    },
  })
  getQuickStart(): {
    quickStart: {
      title: string;
      steps: Array<{
        step: number;
        title: string;
        description: string;
        example: string;
      }>;
    };
    examples: Array<{
      title: string;
      method: string;
      url: string;
      description: string;
      payload?: any;
    }>;
  } {
    return {
      quickStart: {
        title: 'Dynamic Plugin System Quick Start',
        steps: [
          {
            step: 1,
            title: 'Check System Status',
            description: 'Verify the plugin system is running and sample plugin is loaded',
            example: 'GET /api/v1/demo/status',
          },
          {
            step: 2,
            title: 'Try Sample Plugin',
            description: 'Test the sample plugin endpoints to see plugins in action',
            example: 'GET /api/v1/sample',
          },
          {
            step: 3,
            title: 'Explore Plugin Registry',
            description: 'Browse available plugins and their capabilities',
            example: 'GET /api/v1/registry/plugins',
          },
          {
            step: 4,
            title: 'Install New Plugins',
            description: 'Install plugins from file system, npm, or git',
            example: 'POST /api/v1/plugins/install',
          },
          {
            step: 5,
            title: 'Manage Plugin Lifecycle',
            description: 'Load, unload, reload plugins as needed',
            example: 'POST /api/v1/plugins/:pluginId/load',
          },
          {
            step: 6,
            title: 'Monitor and Debug',
            description: 'Use health checks and demo endpoints for monitoring',
            example: 'GET /api/v1/demo/health',
          },
        ],
      },
      examples: [
        {
          title: 'Get Sample Plugin Status',
          method: 'GET',
          url: '/api/v1/sample/status',
          description: 'Check if the sample plugin is running and get its status',
        },
        {
          title: 'Create Data via Sample Plugin',
          method: 'POST',
          url: '/api/v1/sample/data',
          description: 'Create new data using the sample plugin API',
          payload: {
            name: 'Example Item',
            value: 'test-value',
            category: 'demo',
          },
        },
        {
          title: 'Search Plugins',
          method: 'GET',
          url: '/api/v1/registry/search?query=sample&limit=10',
          description: 'Search for plugins in the registry',
        },
        {
          title: 'Install Plugin from File',
          method: 'POST',
          url: '/api/v1/plugins/install',
          description: 'Install a plugin from local file system',
          payload: {
            type: 'file',
            location: './src/plugins/templates/sample-plugin',
          },
        },
        {
          title: 'Load Plugin',
          method: 'POST',
          url: '/api/v1/plugins/sample-plugin@1.0.0/load',
          description: 'Load and activate an installed plugin',
        },
        {
          title: 'Get Plugin Metrics',
          method: 'GET',
          url: '/api/v1/sample/metrics',
          description: 'Get performance metrics from a running plugin',
        },
        {
          title: 'Get Registry Statistics',
          method: 'GET',
          url: '/api/v1/registry/stats',
          description: 'Get comprehensive statistics about the plugin registry',
        },
        {
          title: 'Run Complete Demo',
          method: 'POST',
          url: '/api/v1/demo/run',
          description: 'Execute a comprehensive demonstration of all plugin features',
        },
      ],
    };
  }
}
