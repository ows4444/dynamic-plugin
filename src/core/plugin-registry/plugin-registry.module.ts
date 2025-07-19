import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginRegistryController } from './plugin-registry.controller';

@Module({
  imports: [EventEmitterModule],
  controllers: [PluginRegistryController],
  providers: [PluginRegistryService],
  exports: [PluginRegistryService],
})
export class PluginRegistryModule {}
