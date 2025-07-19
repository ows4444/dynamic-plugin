import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PluginRuntimeService } from './plugin-runtime.service';
import { PluginRouterService } from './services/plugin-router.service';
import { PluginLoaderService } from './services/plugin-loader.service';
import { PluginContextService } from './services/plugin-context.service';
import { PluginExecutionService } from './services/plugin-execution.service';
import { PluginIsolationService } from './services/plugin-isolation.service';
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
 * - Plugin isolation and sandboxing
 * - Advanced execution controls
 */
@Module({
  imports: [EventEmitterModule],
  controllers: [PluginProxyController, PluginManagementController],
  providers: [PluginRuntimeService, PluginRouterService, PluginLoaderService, PluginContextService, PluginExecutionService, PluginIsolationService],
  exports: [PluginRuntimeService, PluginRouterService, PluginLoaderService, PluginContextService, PluginExecutionService, PluginIsolationService],
})
export class PluginRuntimeModule {}
