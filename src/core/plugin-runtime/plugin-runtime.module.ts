import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginRuntimeService } from './plugin-runtime.service';

@Module({
  imports: [EventEmitterModule],
  providers: [PluginRuntimeService],
  exports: [PluginRuntimeService],
})
export class PluginRuntimeModule {}
