import { Module } from '@nestjs/common';
import { PluginHostController } from './plugin-host.controller';
import { PluginHostService } from './plugin-host.service';

@Module({
  imports: [],
  controllers: [PluginHostController],
  providers: [PluginHostService],
})
export class PluginHostModule {}
