import { Module } from '@nestjs/common';
import { PluginManagerService } from './plugin-manager.service';
import { PluginRegistryModule } from '@/core/plugin-registry/plugin-registry.module';

@Module({
  imports: [PluginRegistryModule],
  providers: [PluginManagerService],
  exports: [PluginManagerService],
})
export class PluginManagerModule {}
