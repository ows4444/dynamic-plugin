import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginBootstrapService } from './plugin-bootstrap.service';
import { PluginDemoService } from './plugin-demo.service';
import { PluginDemoController } from './plugin-demo.controller';
import { PluginManagerModule } from '@/core/plugin-manager/plugin-manager.module';
import { PluginRegistryModule } from '@/core/plugin-registry/plugin-registry.module';

@Module({
  imports: [EventEmitterModule, PluginManagerModule, PluginRegistryModule],
  controllers: [PluginDemoController],
  providers: [PluginBootstrapService, PluginDemoService],
  exports: [PluginBootstrapService, PluginDemoService],
})
export class PluginsModule {}
