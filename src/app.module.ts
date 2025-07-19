import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginRegistryModule } from '@/core/plugin-registry/plugin-registry.module';
import { PluginManagerModule } from '@/core/plugin-manager/plugin-manager.module';
import { PluginRuntimeModule } from '@/core/plugin-runtime/plugin-runtime.module';
import { PluginSecurityModule } from '@/core/plugin-security/plugin-security.module';
import { PluginsModule } from '@/plugins/plugins.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 100,
      verboseMemoryLeak: false,
    }),
    PluginRegistryModule,
    PluginManagerModule,
    PluginRuntimeModule,
    PluginSecurityModule,
    PluginsModule,
  ],
})
export class AppModule {}
