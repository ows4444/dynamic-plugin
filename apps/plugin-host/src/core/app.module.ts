import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PluginManagerModule } from '../plugin-manager/plugin-manager.module';
import { PluginLoaderModule } from '../plugin-loader/plugin-loader.module';
import { PluginRegistryModule } from '../plugin-registry/plugin-registry.module';
import { PluginRuntimeModule } from '../plugin-runtime/plugin-runtime.module';
import { StorageModule } from '../storage/storage.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [
    PluginManagerModule,
    PluginLoaderModule,
    PluginRegistryModule,
    PluginRuntimeModule,
    StorageModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}