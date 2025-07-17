import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '../config/config.module';
import { PluginController } from './plugin.controller';
import { PluginManagerService } from './plugin-manager.service';
import { PluginLoaderService } from './plugin-loader.service';
import { SecurityManager } from './security-manager.service';
import { PluginMetricsService } from './plugin-metrics.service';
import { DynamicRouteController } from './dynamic-route.controller';
import { DynamicRouteService } from './dynamic-route.service';
import { DependencyInjectionService } from './dependency-injection.service';
import { LifecycleManagerService } from './lifecycle-manager.service';
import { HotReloadService } from './hot-reload.service';
import { ErrorBoundaryService } from './error-boundary.service';
import { PluginValidatorService } from './plugin-validator.service';
import { ConfigManagerService } from './config-manager.service';
import { AuditLoggerService } from './audit-logger.service';
import { PluginApplicationService } from '../application/plugin.service';
import { PluginRepositoryAdapter } from '../adapters/plugin.repository.adapter';
import { StartupOptimizerService } from './optimizations/startup-optimizer.service';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule
  ],
  controllers: [
    PluginController,
    DynamicRouteController
  ],
  providers: [
    PluginManagerService,
    PluginLoaderService,
    SecurityManager,
    PluginMetricsService,
    DynamicRouteService,
    DependencyInjectionService,
    LifecycleManagerService,
    HotReloadService,
    ErrorBoundaryService,
    PluginValidatorService,
    ConfigManagerService,
    AuditLoggerService,
    StartupOptimizerService,
    // PluginApplicationService, // Commented out until ports are properly configured
    PluginRepositoryAdapter
  ],
  exports: [
    PluginManagerService,
    PluginLoaderService,
    SecurityManager,
    PluginMetricsService,
    DynamicRouteService,
    DependencyInjectionService,
    LifecycleManagerService,
    HotReloadService,
    ErrorBoundaryService,
    PluginValidatorService,
    ConfigManagerService,
    AuditLoggerService,
    StartupOptimizerService,
    // PluginApplicationService, // Commented out until ports are properly configured
    PluginRepositoryAdapter
  ]
})
export class PluginModule {}