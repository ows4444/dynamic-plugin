import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginManagerService } from './plugin-manager.service';
import { PluginManagementController } from './plugin-management.controller';
import { PluginRegistryModule } from '@/core/plugin-registry/plugin-registry.module';
import { PluginRuntimeModule } from '@/core/plugin-runtime/plugin-runtime.module';

@Module({
  imports: [EventEmitterModule, PluginRegistryModule, PluginRuntimeModule],
  controllers: [PluginManagementController],
  providers: [PluginManagerService],
  exports: [PluginManagerService],
})
export class PluginManagerModule {}
