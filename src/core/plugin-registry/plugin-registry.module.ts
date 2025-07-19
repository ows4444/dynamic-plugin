import { Module } from '@nestjs/common';
import { PluginRegistryService } from './plugin-registry.service';

@Module({
  providers: [PluginRegistryService],
  exports: [PluginRegistryService],
})
export class PluginRegistryModule {}
