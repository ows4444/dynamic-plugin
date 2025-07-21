import { Module } from '@nestjs/common';
import { PluginSdkService } from './plugin-sdk.service';
import { PluginContext } from '../context/plugin-context';

@Module({
  providers: [PluginSdkService, PluginContext],
  exports: [PluginSdkService, PluginContext],
})
export class PluginSdkModule {}
