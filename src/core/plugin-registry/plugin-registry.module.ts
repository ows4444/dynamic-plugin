import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginRegistryController } from './plugin-registry.controller';
import { PluginMetadataRepository } from './repositories/plugin-metadata.repository';
import { PluginDiscoveryService } from './services/plugin-discovery.service';
import { PluginCompatibilityService } from './services/plugin-compatibility.service';
import { PluginSearchService } from './services/plugin-search.service';

@Module({
  imports: [EventEmitterModule],
  controllers: [PluginRegistryController],
  providers: [PluginRegistryService, PluginMetadataRepository, PluginDiscoveryService, PluginCompatibilityService, PluginSearchService],
  exports: [PluginRegistryService, PluginMetadataRepository, PluginDiscoveryService, PluginCompatibilityService, PluginSearchService],
})
export class PluginRegistryModule {}
