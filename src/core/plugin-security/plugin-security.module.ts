import { Module } from '@nestjs/common';
import { PluginSecurityService } from './plugin-security.service';

@Module({
  providers: [PluginSecurityService],
  exports: [PluginSecurityService],
})
export class PluginSecurityModule {}
