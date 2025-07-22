import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheckService, HealthStatus, PluginHealthSummary } from '../monitoring/health-check.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly healthCheckService: HealthCheckService) {}
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is running' })
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Service status information' })
  @ApiResponse({ status: 200, description: 'Service status details' })
  getStatus(): { service: string; version: string; uptime: number } {
    return {
      service: 'plugin-host',
      version: '1.0.0',
      uptime: process.uptime(),
    };
  }

  @Get('health/detailed')
  @ApiOperation({ summary: 'Detailed health check including plugins' })
  @ApiResponse({ status: 200, description: 'Detailed health status', type: Object })
  async getDetailedHealth(): Promise<HealthStatus> {
    return this.healthCheckService.getOverallHealth();
  }

  @Get('health/plugins')
  @ApiOperation({ summary: 'Plugin-specific health status' })
  @ApiResponse({ status: 200, description: 'Plugin health summary' })
  async getPluginHealth(): Promise<PluginHealthSummary> {
    return this.healthCheckService.checkPluginHealth();
  }
}
