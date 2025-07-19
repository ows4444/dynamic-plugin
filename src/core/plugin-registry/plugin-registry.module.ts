import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginRegistryService } from './plugin-registry.service';

@Module({
  imports: [EventEmitterModule],
  providers: [PluginRegistryService],
  exports: [PluginRegistryService],
})
export class PluginRegistryModule {}
