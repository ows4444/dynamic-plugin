import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginRuntimeService } from './plugin-runtime.service';
import { PluginRouterService } from './services/plugin-router.service';
import { PluginLoaderService } from './services/plugin-loader.service';
import { PluginContextService } from './services/plugin-context.service';
import { PluginProxyController } from './plugin-proxy.controller';
import { PluginManagementController } from './controllers/plugin-management.controller';

/**
 * Enhanced Plugin Runtime Module with improved architecture
 *
 * Features:
 * - Dynamic plugin loading and execution
 * - Comprehensive route management
 * - Plugin lifecycle management
 * - Security and validation
 * - Performance monitoring
 */
@Module({
  imports: [EventEmitterModule],
  controllers: [PluginProxyController, PluginManagementController],
  providers: [PluginRuntimeService, PluginRouterService, PluginLoaderService, PluginContextService],
  exports: [PluginRuntimeService, PluginRouterService, PluginLoaderService, PluginContextService],
})
export class PluginRuntimeModule {}
