import { HealthCheckResponse, HealthCheckService } from '@lib/shared/common';
import { Controller, Get, HttpException, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';


@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get comprehensive system health status',
    description: 'Performs a complete health check of all system components, plugins, and dependencies'
  })
  @ApiQuery({ 
    name: 'detailed', 
    required: false, 
    type: Boolean, 
    description: 'Include detailed system information and metrics' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Health check completed successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy', 'unknown'] },
        timestamp: { type: 'string', format: 'date-time' },
        duration: { type: 'number', description: 'Health check duration in milliseconds' },
        checks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy', 'unknown'] },
              message: { type: 'string' },
              duration: { type: 'number' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        },
        info: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            uptime: { type: 'number' },
            environment: { type: 'string' },
            host: { type: 'string' }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.SERVICE_UNAVAILABLE, 
    description: 'System is unhealthy' 
  })
  async getHealth(@Query('detailed') detailed?: string): Promise<HealthCheckResponse> {
    const includeDetails = detailed === 'true' || detailed === '1';
    const healthStatus = await this.healthCheckService.performHealthCheck(includeDetails);
    
    // Return appropriate HTTP status based on health
    if (healthStatus.status === 'unhealthy') {
      throw new HttpException(healthStatus, HttpStatus.SERVICE_UNAVAILABLE);
    }
    
    return healthStatus;
  }

  @Get('ready')
  @ApiOperation({ 
    summary: 'Check application readiness',
    description: 'Determines if the application is ready to accept traffic'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Application is ready',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ready', 'not-ready'] },
        timestamp: { type: 'string', format: 'date-time' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.SERVICE_UNAVAILABLE, 
    description: 'Application is not ready' 
  })
  async getReadiness(): Promise<{ status: string; timestamp: Date; message: string }> {
    const healthStatus = await this.healthCheckService.performHealthCheck(false);
    
    // Consider ready if not unhealthy
    const isReady = healthStatus.status !== 'unhealthy';
    
    const readinessStatus = {
      status: isReady ? 'ready' : 'not-ready',
      timestamp: new Date(),
      message: isReady 
        ? 'Application is ready to accept traffic'
        : 'Application is not ready - system is unhealthy'
    };

    if (!isReady) {
      throw new HttpException(readinessStatus, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return readinessStatus;
  }

  
  @Get('live')
  @ApiOperation({ 
    summary: 'Check application liveness',
    description: 'Determines if the application is alive and should continue running'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Application is alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', value: 'alive' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Application uptime in milliseconds' }
      }
    }
  })
  getLiveness(): { status: string; timestamp: Date; uptime: number } {
    // Basic liveness check - if we can respond, we're alive
    return {
      status: 'alive',
      timestamp: new Date(),
      uptime: process.uptime() * 1000 // Convert to milliseconds
    };
  }

 
  @Get('metrics')
  @ApiOperation({ 
    summary: 'Get health check metrics',
    description: 'Returns performance metrics and statistics for health checks'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Health check metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        registeredChecks: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of registered health check names'
        },
        lastCheck: {
          type: 'object',
          description: 'Information about the last health check performed'
        },
        systemInfo: {
          type: 'object',
          description: 'Basic system information'
        }
      }
    }
  })
  getHealthMetrics(): {
    registeredChecks: string[];
    lastCheck: {
      timestamp: Date;
      checksPerformed: number;
    };
    systemInfo: {
      nodeVersion: string;
      platform: string;
      arch: string;
      uptime: number;
    };
  } {
    const registeredChecks = this.healthCheckService.getRegisteredHealthChecks();
    
    return {
      registeredChecks,
      lastCheck: {
        timestamp: new Date(),
        checksPerformed: registeredChecks.length + 3, // + system checks
      },
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime() * 1000,
      },
    };
  }
}