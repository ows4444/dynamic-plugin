import { Injectable, Logger } from '@nestjs/common';
import { PluginManagerService } from '@/core/plugin-manager/plugin-manager.service';
import { PluginRegistryService } from '@/core/plugin-registry/plugin-registry.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PluginEvent, PluginStatus } from '@types';

@Injectable()
export class PluginDemoService {
  private readonly logger = new Logger(PluginDemoService.name);

  constructor(
    private readonly pluginManager: PluginManagerService,
    private readonly registryService: PluginRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen to plugin lifecycle events
    this.eventEmitter.on('plugin.installed', (event) => {
      this.logger.log(`🔧 Plugin installed: ${event.pluginId} (${event.installTime}ms)`);
    });

    this.eventEmitter.on('plugin.loaded', (event) => {
      this.logger.log(`🚀 Plugin loaded: ${event.pluginId} (${event.loadTime}ms)`);
    });

    this.eventEmitter.on('plugin.unloaded', (event) => {
      this.logger.log(`🛑 Plugin unloaded: ${event.pluginId}`);
    });

    this.eventEmitter.on('plugin.uninstalled', (event) => {
      this.logger.log(`🗑️ Plugin uninstalled: ${event.pluginId}`);
    });

    // Listen to sample plugin events
    this.eventEmitter.on('sample.event', (event) => {
      this.logger.log(`📩 Received sample plugin event:`, event);
    });

    this.eventEmitter.on('sample.notification', (event) => {
      this.logger.log(`🔔 Sample plugin notification:`, event);
    });
  }

  demonstratePluginUsage(): {
    systemStatus: any;
    pluginOperations: any[];
    eventDemonstration: any;
  } {
    this.logger.log('🎬 Starting plugin system demonstration...');

    const operations: any[] = [];

    try {
      // 1. Show system status
      const systemStatus = this.getSystemStatus();
      operations.push({
        operation: 'System Status Check',
        success: true,
        result: systemStatus,
      });

      // 2. Demonstrate plugin search
      const searchResult = this.registryService.searchPlugins({
        query: 'sample',
        limit: 5,
      });
      operations.push({
        operation: 'Plugin Search',
        success: true,
        result: { foundPlugins: searchResult.plugins.length, query: 'sample' },
      });

      // 3. Demonstrate registry stats
      const stats = this.registryService.getPluginStats();
      operations.push({
        operation: 'Registry Statistics',
        success: true,
        result: {
          totalPlugins: stats.totalPlugins,
          categories: stats.topCategories.length,
          averageRating: stats.averageRating,
        },
      });

      // 4. Demonstrate plugin management
      const samplePluginId = 'sample-plugin@1.0.0';
      const pluginStatus = this.pluginManager.getPluginStatus(samplePluginId);
      operations.push({
        operation: 'Plugin Status Check',
        success: true,
        result: { pluginId: samplePluginId, status: pluginStatus },
      });

      // 5. Demonstrate event publishing
      const eventDemo = this.demonstrateEvents();
      operations.push({
        operation: 'Event System Demo',
        success: true,
        result: eventDemo,
      });

      // 6. Show loaded plugin instances
      const loadedPlugins = this.pluginManager.getLoadedPlugins();
      operations.push({
        operation: 'Loaded Plugins',
        success: true,
        result: {
          count: loadedPlugins.length,
          plugins: loadedPlugins.map((p) => ({
            id: p.id,
            name: p.metadata.name,
            status: p.status,
            uptime: Date.now() - p.startTime.getTime(),
          })),
        },
      });

      this.logger.log('✅ Plugin demonstration completed successfully');

      return {
        systemStatus,
        pluginOperations: operations,
        eventDemonstration: eventDemo,
      };
    } catch (error) {
      this.logger.error('❌ Plugin demonstration failed', error);
      operations.push({
        operation: 'Demonstration',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        systemStatus: null,
        pluginOperations: operations,
        eventDemonstration: null,
      };
    }
  }

  private getSystemStatus(): any {
    const allPlugins = this.registryService.getAllPlugins();
    const loadedPlugins = this.pluginManager.getLoadedPlugins();
    const stats = this.registryService.getPluginStats();

    return {
      timestamp: new Date().toISOString(),
      pluginSystem: {
        ready: true,
        totalPlugins: allPlugins.length,
        loadedPlugins: loadedPlugins.length,
        installedPlugins: stats.installedPlugins,
        enabledPlugins: stats.enabledPlugins,
      },
      categories: stats.topCategories,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };
  }

  private demonstrateEvents(): any {
    const events: any[] = [];

    try {
      // Publish a custom event
      const customEvent: PluginEvent = {
        id: `demo-${Date.now()}`,
        type: 'plugin.demo.event',
        source: 'plugin-demo-service',
        data: {
          message: 'This is a demonstration event',
          timestamp: new Date().toISOString(),
          demoData: {
            number: Math.floor(Math.random() * 100),
            boolean: Math.random() > 0.5,
            array: ['demo', 'event', 'data'],
          },
        },
        timestamp: new Date(),
      };

      this.eventEmitter.emit(customEvent.type, customEvent);
      events.push({
        type: 'Published Event',
        event: customEvent,
      });

      // Simulate sample plugin event
      const sampleEvent: PluginEvent = {
        id: `sample-${Date.now()}`,
        type: 'sample.notification',
        source: 'sample-plugin',
        data: {
          message: 'Demo notification from sample plugin',
          severity: 'info',
          action: 'demo_action',
        },
        timestamp: new Date(),
      };

      this.eventEmitter.emit(sampleEvent.type, sampleEvent);
      events.push({
        type: 'Sample Plugin Event',
        event: sampleEvent,
      });

      return {
        success: true,
        eventsPublished: events.length,
        events,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        eventsPublished: events.length,
        events,
      };
    }
  }

  getPluginAPIEndpoints(): {
    availableEndpoints: string[];
    samplePluginEndpoints?: string[];
    managementEndpoints: string[];
    registryEndpoints: string[];
  } {
    const baseUrl = 'http://localhost:3000/api/v1';

    const managementEndpoints = [
      'POST /plugins/install',
      'POST /plugins/:pluginId/load',
      'POST /plugins/:pluginId/unload',
      'POST /plugins/:pluginId/reload',
      'PUT /plugins/:pluginId/update',
      'DELETE /plugins/:pluginId',
      'GET /plugins/:pluginId/status',
      'GET /plugins/loaded',
      'GET /plugins',
    ].map((endpoint) => `${baseUrl}${endpoint.replace('GET /plugins', '/plugins').replace('POST /plugins', '/plugins').replace('PUT /plugins', '/plugins').replace('DELETE /plugins', '/plugins')}`);

    const registryEndpoints = [
      'GET /registry/discover',
      'GET /registry/search',
      'GET /registry/stats',
      'GET /registry/plugins',
      'GET /registry/plugins/:pluginId',
      'GET /registry/plugins/:pluginId/dependencies',
      'GET /registry/plugins/:pluginId/compatibility',
      'GET /registry/categories',
      'GET /registry/categories/:category/plugins',
    ].map((endpoint) => `${baseUrl}${endpoint.replace('GET /', '/')}`);

    const samplePluginEndpoints = ['GET /sample', 'GET /sample/status', 'POST /sample/data', 'GET /sample/metrics'].map((endpoint) => `${baseUrl}${endpoint}`);

    const allEndpoints = [...managementEndpoints, ...registryEndpoints, ...samplePluginEndpoints];

    return {
      availableEndpoints: allEndpoints,
      samplePluginEndpoints,
      managementEndpoints,
      registryEndpoints,
    };
  }

  performHealthCheck(): {
    healthy: boolean;
    checks: Array<{ name: string; status: 'healthy' | 'unhealthy'; details?: any }>;
  } {
    const checks: Array<{ name: string; status: 'healthy' | 'unhealthy'; details?: any }> = [];

    // Check plugin registry
    try {
      const stats = this.registryService.getPluginStats();
      checks.push({
        name: 'Plugin Registry',
        status: 'healthy',
        details: { totalPlugins: stats.totalPlugins },
      });
    } catch (error) {
      checks.push({
        name: 'Plugin Registry',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }

    // Check plugin manager
    try {
      const loadedPlugins = this.pluginManager.getLoadedPlugins();
      checks.push({
        name: 'Plugin Manager',
        status: 'healthy',
        details: { loadedPlugins: loadedPlugins.length },
      });
    } catch (error) {
      checks.push({
        name: 'Plugin Manager',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }

    // Check sample plugin
    try {
      const samplePluginStatus = this.pluginManager.getPluginStatus('sample-plugin@1.0.0');
      checks.push({
        name: 'Sample Plugin',
        status: samplePluginStatus === PluginStatus.LOADED || samplePluginStatus === PluginStatus.RUNNING ? 'healthy' : 'unhealthy',
        details: { status: samplePluginStatus },
      });
    } catch (error) {
      checks.push({
        name: 'Sample Plugin',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }

    // Check event system
    try {
      this.eventEmitter.emit('health.check', { timestamp: new Date() });
      checks.push({
        name: 'Event System',
        status: 'healthy',
      });
    } catch (error) {
      checks.push({
        name: 'Event System',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }

    const healthy = checks.every((check) => check.status === 'healthy');

    return {
      healthy,
      checks,
    };
  }
}
