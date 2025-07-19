import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginManagerService } from './plugin-manager.service';
import { PluginRegistryModule } from '@/core/plugin-registry/plugin-registry.module';

@Module({
  imports: [EventEmitterModule, PluginRegistryModule],
  providers: [PluginManagerService],
  exports: [PluginManagerService],
})
export class PluginManagerModule {}
