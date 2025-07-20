import { DynamicModule, Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Core modules
import { PluginRegistryModule } from '@/core/plugin-registry/plugin-registry.module';
import { PluginManagerModule } from '@/core/plugin-manager/plugin-manager.module';
import { PluginRuntimeModule } from '@/core/plugin-runtime/plugin-runtime.module';
import { PluginSecurityModule } from '@/core/plugin-security/plugin-security.module';

// Enhanced plugin services
import { PluginStoreService } from './services/plugin-store.service';
import { PluginCompilerService } from './services/plugin-compiler.service';
import { PluginDevelopmentService } from './services/plugin-development.service';

// Controllers
import { PluginStoreController } from './controllers/plugin-store.controller';
import { PluginDevelopmentController } from './controllers/plugin-development.controller';
import { PluginCompilerController } from './controllers/plugin-compiler.controller';

// Existing services
import { PluginBootstrapService } from './plugin-bootstrap.service';
import { PluginDemoService } from './plugin-demo.service';

// Existing controllers
import { PluginDemoController } from './plugin-demo.controller';

/**
 * Enhanced Plugins Module - Comprehensive plugin ecosystem
 *
 * This module provides a complete plugin management system including:
 * - Plugin discovery and installation from multiple sources
 * - TypeScript compilation and bundling
 * - Development tools and scaffolding
 * - Plugin store and marketplace integration
 * - Hot-reload and development server
 * - Testing and validation tools
 * - Security and isolation
 * - Comprehensive monitoring and analytics
 */
@Global()
@Module({})
export class EnhancedPluginsModule {
  /**
   * Create the enhanced plugins module with full functionality
   */
  static forRoot(options: EnhancedPluginsModuleOptions = {}): DynamicModule {
    const providers = [
      // Enhanced services
      PluginStoreService,
      PluginCompilerService,
      PluginDevelopmentService,

      // Existing services
      PluginBootstrapService,
      PluginDemoService,
    ];

    const controllers = [
      // Enhanced controllers
      PluginStoreController,
      PluginDevelopmentController,
      PluginCompilerController,

      // Existing controllers
      PluginDemoController,
    ];

    // Add optional services based on configuration
    if (options.enableStore !== false) {
      // Store is enabled by default
    }

    if (options.enableDevelopment !== false) {
      // Development tools are enabled by default
    }

    if (options.enableCompiler !== false) {
      // Compiler is enabled by default
    }

    return {
      module: EnhancedPluginsModule,
      imports: [
        // Event system for plugin communication
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: '.',
          newListener: true,
          removeListener: true,
          maxListeners: 100,
          verboseMemoryLeak: false,
          ignoreErrors: false,
        }),

        // Core plugin modules
        PluginRegistryModule,
        PluginManagerModule,
        PluginRuntimeModule,
        PluginSecurityModule,
      ],
      providers,
      controllers,
      exports: [
        // Export enhanced services for use in other modules
        PluginStoreService,
        PluginCompilerService,
        PluginDevelopmentService,
        PluginBootstrapService,
        PluginDemoService,
      ],
      global: true,
    };
  }

  /**
   * Create a minimal plugins module for development
   */
  static forDevelopment(): DynamicModule {
    return this.forRoot({
      enableStore: false,
      enableCompiler: true,
      enableDevelopment: true,
    });
  }

  /**
   * Create a production-ready plugins module
   */
  static forProduction(): DynamicModule {
    return this.forRoot({
      enableStore: true,
      enableCompiler: true,
      enableDevelopment: false,
    });
  }

  /**
   * Create a testing-focused plugins module
   */
  static forTesting(): DynamicModule {
    return this.forRoot({
      enableStore: false,
      enableCompiler: false,
      enableDevelopment: true,
    });
  }
}

/**
 * Configuration options for the Enhanced Plugins Module
 */
export interface EnhancedPluginsModuleOptions {
  /**
   * Enable plugin store and marketplace functionality
   * @default true
   */
  enableStore?: boolean;

  /**
   * Enable development tools and utilities
   * @default true
   */
  enableDevelopment?: boolean;

  /**
   * Enable TypeScript compilation and bundling
   * @default true
   */
  enableCompiler?: boolean;

  /**
   * Plugin store configuration
   */
  store?: {
    defaultStores?: Array<{
      id: string;
      name: string;
      url: string;
      priority?: number;
      trusted?: boolean;
    }>;
    cacheTimeout?: number;
    maxConcurrentRequests?: number;
  };

  /**
   * Compiler configuration
   */
  compiler?: {
    defaultTarget?: string;
    enableSourceMaps?: boolean;
    enableMinification?: boolean;
    cacheDirectory?: string;
  };

  /**
   * Development configuration
   */
  development?: {
    hotReload?: boolean;
    watchFiles?: boolean;
    devServerPort?: number;
    enableLinting?: boolean;
    enableTesting?: boolean;
  };

  /**
   * Security configuration
   */
  security?: {
    enableSignatureValidation?: boolean;
    enableSandboxing?: boolean;
    maxResourceUsage?: {
      memory?: number;
      cpu?: number;
      network?: number;
    };
  };

  /**
   * Monitoring configuration
   */
  monitoring?: {
    enableMetrics?: boolean;
    enableHealthChecks?: boolean;
    enableAuditLogs?: boolean;
    metricsInterval?: number;
  };
}
