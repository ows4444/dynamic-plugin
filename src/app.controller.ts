import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiProduces } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get application information',
    description: `
      Returns comprehensive information about the Dynamic Plugin System including:
      - Application name, version, and description
      - System uptime and current timestamp
      - Plugin system statistics
      - Available features and capabilities
      - Environment information
      
      This endpoint is useful for:
      - System monitoring dashboards
      - Health checks and status pages
      - API documentation and discovery
      - Version compatibility checks
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Application information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Dynamic Plugin System' },
        version: { type: 'string', example: '1.0.0' },
        description: { type: 'string', example: 'Enterprise-grade dynamic plugin architecture' },
        uptime: { type: 'number', example: 3600000 },
        timestamp: { type: 'string', format: 'date-time' },
        environment: { type: 'string', example: 'development' },
        features: {
          type: 'object',
          properties: {
            hotReload: { type: 'boolean', example: true },
            sandbox: { type: 'boolean', example: true },
            multiTenant: { type: 'boolean', example: true },
            registry: { type: 'boolean', example: true }
          }
        },
        plugins: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 15 },
            active: { type: 'number', example: 12 },
            inactive: { type: 'number', example: 2 },
            error: { type: 'number', example: 1 }
          }
        }
      }
    }
  })
  @ApiProduces('application/json')
  getAppInfo() {
    return this.appService.getAppInfo();
  }

  @Get('health')
  @ApiOperation({ 
    summary: 'Health check endpoint',
    description: `
      Performs a comprehensive health check of the Dynamic Plugin System including:
      - Application server status
      - Database connectivity
      - Plugin system health
      - Resource utilization
      - External service dependencies
      
      Used by:
      - Load balancers for health checks
      - Monitoring systems for alerting
      - Container orchestration platforms
      - CI/CD pipelines for deployment validation
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'System is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', example: 3600000 },
        version: { type: 'string', example: '1.0.0' },
        checks: {
          type: 'object',
          properties: {
            database: { type: 'string', enum: ['healthy', 'unhealthy'], example: 'healthy' },
            plugins: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
            memory: { type: 'string', enum: ['healthy', 'warning', 'critical'], example: 'healthy' },
            disk: { type: 'string', enum: ['healthy', 'warning', 'critical'], example: 'healthy' }
          }
        },
        metrics: {
          type: 'object',
          properties: {
            memoryUsage: { type: 'number', example: 45.6 },
            cpuUsage: { type: 'number', example: 23.4 },
            activeConnections: { type: 'number', example: 150 },
            requestsPerSecond: { type: 'number', example: 25.7 }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: 'System is unhealthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'unhealthy' },
        timestamp: { type: 'string', format: 'date-time' },
        error: { type: 'string', example: 'Database connection failed' },
        checks: { type: 'object' }
      }
    }
  })
  @ApiProduces('application/json')
  getHealth() {
    return this.appService.getHealth();
  }
}