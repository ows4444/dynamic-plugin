import { Module } from '@nestjs/common';
import { PluginLoaderService } from './plugin-loader.service';
import { ModuleResolverService } from './module-resolver.service';
import { RouteManagerService } from './route-manager.service';

@Module({
  providers: [PluginLoaderService, ModuleResolverService, RouteManagerService],
  exports: [PluginLoaderService],
})
export class PluginLoaderModule {}
