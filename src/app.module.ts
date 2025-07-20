import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginRegistryModule } from '@/core/plugin-registry/plugin-registry.module';
import { PluginManagerModule } from '@/core/plugin-manager/plugin-manager.module';
import { PluginRuntimeModule } from '@/core/plugin-runtime/plugin-runtime.module';
import { PluginSecurityModule } from '@/core/plugin-security/plugin-security.module';
import { PluginsModule } from '@/plugins/plugins.module';
import { InfrastructureConfigModule } from '@/infrastructure/config/config.module';
import { CachingModule } from '@/infrastructure/caching/caching.module';
import { DatabaseModule } from '@/infrastructure/database/database.module';
import { MessagingModule } from '@/infrastructure/messaging/messaging.module';
import { MonitoringModule } from '@/infrastructure/monitoring/monitoring.module';
import { LoggingModule } from '@/infrastructure/logging/logging.module';
import { SecurityModule } from '@/infrastructure/security/security.module';

@Module({
  imports: [
    // Infrastructure modules (loaded first for dependencies)
    InfrastructureConfigModule,
    DatabaseModule,
    CachingModule,
    MessagingModule,
    MonitoringModule,
    LoggingModule,
    SecurityModule,

    // Core NestJS modules
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 100,
      verboseMemoryLeak: false,
    }),

    // Plugin system core modules
    PluginRegistryModule,
    PluginManagerModule,
    PluginRuntimeModule,
    PluginSecurityModule,

    // Application modules
    PluginsModule,
  ],
})
export class AppModule {}
