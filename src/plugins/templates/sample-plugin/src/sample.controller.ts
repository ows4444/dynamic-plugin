import { Body, Get, Post } from '@nestjs/common';
import { PluginController, PluginLogger, PluginPermission, PluginRoute } from '@/shared/decorators/plugin.decorator';
import { SampleService } from './sample.service';

@PluginController('/sample')
export class SampleController {
  @PluginLogger('SampleController')
  private readonly logger: any;

  constructor(private readonly sampleService: SampleService) {}

  @Get()
  @PluginRoute({
    path: '/',
    method: 'GET',
    permissions: ['read'],
  })
  @PluginPermission(['read'])
  getHello(): { message: string; timestamp: string } {
    this.logger?.log('Getting hello message');

    return {
      message: this.sampleService.getHelloMessage(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('status')
  @PluginRoute({
    path: '/status',
    method: 'GET',
  })
  getStatus(): { status: string; version: string; uptime: number } {
    this.logger?.log('Getting plugin status');

    return {
      status: 'running',
      version: '1.0.0',
      uptime: this.sampleService.getUptime(),
    };
  }

  @Post('data')
  @PluginRoute({
    path: '/data',
    method: 'POST',
    permissions: ['write'],
  })
  @PluginPermission(['write'])
  async createData(@Body() data: any): Promise<{ id: string; data: any; created: string }> {
    this.logger?.log('Creating new data entry');

    const result = await this.sampleService.createData(data);

    return {
      id: result.id,
      data: result.data,
      created: new Date().toISOString(),
    };
  }

  @Get('metrics')
  @PluginRoute({
    path: '/metrics',
    method: 'GET',
  })
  getMetrics(): any {
    this.logger?.log('Getting plugin metrics');

    return this.sampleService.getMetrics();
  }
}
