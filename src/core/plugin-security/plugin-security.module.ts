import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginSecurityService } from './plugin-security.service';

@Module({
  imports: [EventEmitterModule],
  providers: [PluginSecurityService],
  exports: [PluginSecurityService],
})
export class PluginSecurityModule {}
