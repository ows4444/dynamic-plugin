import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginManagerService } from './plugin-manager.service';
import { PluginManagementController } from './plugin-management.controller';
import { PluginRegistryModule } from '@/core/plugin-registry/plugin-registry.module';
import { PluginRuntimeModule } from '@/core/plugin-runtime/plugin-runtime.module';
import { PluginInstallerService } from './services/plugin-installer.service';
import { PluginLifecycleService } from './services/plugin-lifecycle.service';

@Module({
  imports: [EventEmitterModule, PluginRegistryModule, PluginRuntimeModule],
  controllers: [PluginManagementController],
  providers: [PluginManagerService, PluginInstallerService, PluginLifecycleService],
  exports: [PluginManagerService, PluginInstallerService, PluginLifecycleService],
})
export class PluginManagerModule {}
