import { Module } from '@nestjs/common';
import { PluginRuntimeService } from './plugin-runtime.service';

@Module({
  providers: [PluginRuntimeService],
  exports: [PluginRuntimeService],
})
export class PluginRuntimeModule {}
