import { Logger, Module } from '@nestjs/common';
import { Plugin } from '@/shared/decorators/plugin.decorator';
import { SampleController } from './sample.controller';
import { SampleService } from './sample.service';

@Plugin({
  id: 'sample-plugin',
  name: 'Sample Plugin',
  version: '1.0.0',
  description: 'A sample plugin demonstrating the plugin system capabilities',
  author: 'Plugin System',
  capabilities: ['rest-api', 'events'],
  permissions: {
    database: ['read', 'write'],
    network: ['outbound'],
    filesystem: ['read'],
  },
  events: ['sample.event', 'sample.notification'],
  routes: [
    {
      path: '/sample',
      method: 'GET',
      handler: 'SampleController.getHello',
      permissions: ['read'],
    },
    {
      path: '/sample/data',
      method: 'POST',
      handler: 'SampleController.createData',
      permissions: ['write'],
    },
  ],
})
@Module({
  controllers: [SampleController],
  providers: [SampleService],
  exports: [SampleService],
})
export class SamplePluginModule {
  private readonly logger = new Logger(SamplePluginModule.name);

  constructor(private readonly sampleService: SampleService) {}

  async onModuleInit() {
    this.logger.log('Sample Plugin Module initialized');
    await this.sampleService.initialize();
  }

  async onModuleDestroy() {
    this.logger.log('Sample Plugin Module destroyed');
    await this.sampleService.cleanup();
  }
}
