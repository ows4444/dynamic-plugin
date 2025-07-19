import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginSecurityService } from './plugin-security.service';
import { PluginAuthService } from './services/plugin-auth.service';
import { PluginAuditService } from './services/plugin-audit.service';

@Module({
  imports: [EventEmitterModule],
  providers: [PluginSecurityService, PluginAuthService, PluginAuditService],
  exports: [PluginSecurityService, PluginAuthService, PluginAuditService],
})
export class PluginSecurityModule {}
