import { Module } from '@nestjs/common';
import { PluginInstanceService } from './plugin-instance.service';
import { PluginProxyService } from './plugin-proxy.service';
import { PluginEventsService } from './plugin-events.service';
import { PluginSecurityService } from './plugin-security.service';

@Module({
  providers: [
    PluginInstanceService,
    PluginProxyService,
    PluginEventsService,
    PluginSecurityService,
  ],
  exports: [
    PluginInstanceService,
    PluginProxyService,
    PluginEventsService,
    PluginSecurityService,
  ],
})
export class PluginRuntimeModule {}
