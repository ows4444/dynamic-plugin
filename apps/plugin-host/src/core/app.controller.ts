import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('status')
  getStatus(): { service: string; version: string; uptime: number } {
    return {
      service: 'plugin-host',
      version: '1.0.0',
      uptime: process.uptime(),
    };
  }
}
