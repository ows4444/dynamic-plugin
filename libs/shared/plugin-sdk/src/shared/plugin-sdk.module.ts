import { Module } from '@nestjs/common';
import { Shared/pluginSdkService } from './shared/plugin-sdk.service';

@Module({
  providers: [Shared/pluginSdkService],
  exports: [Shared/pluginSdkService],
})
export class Shared/pluginSdkModule {}
