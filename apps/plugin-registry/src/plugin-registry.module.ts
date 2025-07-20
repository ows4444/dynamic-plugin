import { Module } from '@nestjs/common';
import { PluginRegistryController } from './plugin-registry.controller';
import { PluginRegistryService } from './plugin-registry.service';

@Module({
  imports: [],
  controllers: [PluginRegistryController],
  providers: [PluginRegistryService],
})
export class PluginRegistryModule {}
