import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PluginManagerModule } from '../plugin-manager/plugin-manager.module';
import { PluginLoaderModule } from '../plugin-loader/plugin-loader.module';
import { PluginRegistryModule } from '../plugin-registry/plugin-registry.module';

@Module({
  imports: [PluginManagerModule, PluginLoaderModule, PluginRegistryModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
