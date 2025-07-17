import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  IPlugin, 
  PluginMetadata, 
  PluginStatus, 
  PluginEvent, 
  PluginEventType, 
  PluginLoadOptions,
  HealthStatus 
} from '../common/interfaces/plugin.interface';
import { 
  PluginNotFoundException, 
  PluginLoadException, 
  PluginConflictException,
  PluginExecutionException 
} from '../common/exceptions/plugin.exceptions';
import { PluginLoaderService } from './plugin-loader.service';
import { SecurityManager } from './security-manager.service';
import { PluginMetricsService } from './plugin-metrics.service';
import { DynamicRouteService } from './dynamic-route.service';
import { DependencyInjectionService } from './dependency-injection.service';
import { LifecycleManagerService } from './lifecycle-manager.service';
import { HotReloadService } from './hot-reload.service';
import { ErrorBoundaryService } from './error-boundary.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PluginManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PluginManagerService.name);
  private readonly plugins = new Map<string, IPlugin>();
  private readonly pluginMetadata = new Map<string, PluginMetadata>();
  private readonly tenantPlugins = new Map<string, Set<string>>();
  private healthCheckInterval: NodeJS.Timeout;

  constructor(
    private readonly pluginLoader: PluginLoaderService,
    private readonly securityManager: SecurityManager,
    private readonly metricsService: PluginMetricsService,
    @Inject(forwardRef(() => DynamicRouteService))
    private readonly dynamicRouteService: DynamicRouteService,
    private readonly dependencyInjection: DependencyInjectionService,
    private readonly lifecycleManager: LifecycleManagerService,
    @Inject(forwardRef(() => HotReloadService))
    private readonly hotReloadService: HotReloadService,
    @Inject(forwardRef(() => ErrorBoundaryService))
    private readonly errorBoundary: ErrorBoundaryService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async onModuleInit() {
    this.logger.log('Plugin Manager initializing...');
    this.startHealthMonitoring();
    await this.hotReloadService.startWatching();
    await this.loadInitialPlugins();
    this.logger.log('Plugin Manager initialized successfully');
  }

  async onModuleDestroy() {
    this.logger.log('Plugin Manager shutting down...');
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    await this.hotReloadService.stopWatching();
    await this.unloadAllPlugins();
    this.logger.log('Plugin Manager shut down successfully');
  }

  async loadPlugin(pluginId: string, options: PluginLoadOptions = {}): Promise<PluginMetadata> {
    this.logger.log(`Loading plugin: ${pluginId}`);
    
    if (this.plugins.has(pluginId)) {
      throw new PluginConflictException(pluginId, 'Plugin already loaded');
    }

    const loadStartTime = Date.now();
    
    try {
      this.emitPluginEvent(PluginEventType.LOADING, pluginId, options.tenantId);

      const plugin = await this.pluginLoader.loadPlugin(pluginId, options);
      
      await this.securityManager.validatePlugin(plugin, options.permissions || []);

      const metadata: PluginMetadata = {
        id: pluginId,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        license: plugin.license,
        main: '', // Set by loader
        dependencies: plugin.dependencies || [],
        peerDependencies: plugin.peerDependencies || [],
        minimumNodeVersion: plugin.minimumNodeVersion || process.version,
        requiredPermissions: plugin.requiredPermissions || [],
        created: new Date(),
        updated: new Date(),
        status: PluginStatus.LOADING,
        tenantId: options.tenantId
      };

      this.plugins.set(pluginId, plugin);
      this.pluginMetadata.set(pluginId, metadata);

      if (options.tenantId) {
        this.addPluginToTenant(options.tenantId, pluginId);
      }

      // Register plugin dependencies
      await this.dependencyInjection.registerPluginDependencies(pluginId, plugin.dependencies || []);

      // Setup lifecycle management
      await this.lifecycleManager.registerPlugin(pluginId, plugin);

      // Setup error boundary
      await this.errorBoundary.createRollbackPoint(pluginId, { loadOptions: options });

      await this.initializePlugin(pluginId, options);

      // Register plugin routes
      this.dynamicRouteService.registerPluginRoutes(pluginId);

      metadata.status = PluginStatus.ACTIVE;
      this.emitPluginEvent(PluginEventType.LOADED, pluginId, options.tenantId);

      // Track metrics
      const loadTime = Date.now() - loadStartTime;
      this.metricsService.recordPluginLoad(pluginId, loadTime, true);

      this.logger.log(`Plugin loaded successfully: ${pluginId}`);
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to load plugin ${pluginId}:`, error);
      
      // Track failed load metrics
      const loadTime = Date.now() - loadStartTime;
      this.metricsService.recordPluginLoad(pluginId, loadTime, false);
      
      // Handle error through error boundary
      await this.errorBoundary.handleError(error, {
        pluginId,
        operation: 'load',
        timestamp: new Date(),
        stackTrace: error.stack
      });

      this.emitPluginEvent(PluginEventType.ERROR, pluginId, options.tenantId, { error: error.message });
      throw new PluginLoadException(pluginId, error.message);
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    this.logger.log(`Unloading plugin: ${pluginId}`);
    
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new PluginNotFoundException(pluginId);
    }

    const metadata = this.pluginMetadata.get(pluginId);
    const unloadStartTime = Date.now();
    
    try {
      metadata.status = PluginStatus.STOPPING;
      this.emitPluginEvent(PluginEventType.STOPPING, pluginId, metadata.tenantId);

      // Lifecycle management for graceful shutdown
      await this.lifecycleManager.shutdownPlugin(pluginId);

      await plugin.destroy();

      // Unregister plugin routes
      this.dynamicRouteService.unregisterPluginRoutes(pluginId);

      // Clean up dependencies
      await this.dependencyInjection.unregisterPluginDependencies(pluginId);

      this.plugins.delete(pluginId);
      this.pluginMetadata.delete(pluginId);

      if (metadata.tenantId) {
        this.removePluginFromTenant(metadata.tenantId, pluginId);
      }

      // Track metrics
      const unloadTime = Date.now() - unloadStartTime;
      this.metricsService.recordPluginUnload(pluginId, unloadTime, true);

      this.emitPluginEvent(PluginEventType.UNLOADED, pluginId, metadata.tenantId);
      this.logger.log(`Plugin unloaded successfully: ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to unload plugin ${pluginId}:`, error);
      
      // Track failed unload metrics
      const unloadTime = Date.now() - unloadStartTime;
      this.metricsService.recordPluginUnload(pluginId, unloadTime, false);
      
      // Handle error through error boundary
      await this.errorBoundary.handleError(error, {
        pluginId,
        operation: 'unload',
        timestamp: new Date(),
        stackTrace: error.stack
      });

      metadata.status = PluginStatus.ERROR;
      this.emitPluginEvent(PluginEventType.ERROR, pluginId, metadata.tenantId, { error: error.message });
      throw new PluginExecutionException(pluginId, error.message);
    }
  }

  async reloadPlugin(pluginId: string): Promise<PluginMetadata> {
    this.logger.log(`Reloading plugin: ${pluginId}`);
    
    const metadata = this.pluginMetadata.get(pluginId);
    if (!metadata) {
      throw new PluginNotFoundException(pluginId);
    }

    const reloadStartTime = Date.now();

    try {
      const options: PluginLoadOptions = {
        tenantId: metadata.tenantId,
        permissions: metadata.requiredPermissions
      };

      await this.unloadPlugin(pluginId);
      const result = await this.loadPlugin(pluginId, options);

      // Track metrics
      const reloadTime = Date.now() - reloadStartTime;
      this.metricsService.recordPluginReload(pluginId, reloadTime, true);

      return result;
    } catch (error) {
      // Track failed reload metrics
      const reloadTime = Date.now() - reloadStartTime;
      this.metricsService.recordPluginReload(pluginId, reloadTime, false);
      
      throw error;
    }
  }

  async updatePlugin(pluginId: string, newVersion: string): Promise<PluginMetadata> {
    this.logger.log(`Updating plugin ${pluginId} to version ${newVersion}`);
    
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new PluginNotFoundException(pluginId);
    }

    const metadata = this.pluginMetadata.get(pluginId);
    const oldVersion = metadata.version;
    const updateStartTime = Date.now();

    try {
      metadata.status = PluginStatus.UPDATING;
      this.emitPluginEvent(PluginEventType.LOADING, pluginId, metadata.tenantId);

      // Create rollback point before update
      await this.errorBoundary.createRollbackPoint(pluginId, { 
        oldVersion, 
        newVersion,
        updateType: 'version' 
      });

      // Use lifecycle manager for update process
      await this.lifecycleManager.updatePlugin(pluginId, oldVersion, newVersion);

      if (plugin.onUpdate) {
        await plugin.onUpdate(oldVersion);
      }

      metadata.version = newVersion;
      metadata.updated = new Date();
      metadata.status = PluginStatus.ACTIVE;

      // Track metrics
      const updateTime = Date.now() - updateStartTime;
      this.metricsService.recordPluginUpdate(pluginId, updateTime, true);

      this.emitPluginEvent(PluginEventType.LOADED, pluginId, metadata.tenantId);
      this.logger.log(`Plugin updated successfully: ${pluginId}`);
      
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to update plugin ${pluginId}:`, error);
      
      // Track failed update metrics
      const updateTime = Date.now() - updateStartTime;
      this.metricsService.recordPluginUpdate(pluginId, updateTime, false);
      
      // Handle error through error boundary
      await this.errorBoundary.handleError(error, {
        pluginId,
        operation: 'update',
        timestamp: new Date(),
        stackTrace: error.stack,
        metadata: { oldVersion, newVersion }
      });

      metadata.status = PluginStatus.ERROR;
      this.emitPluginEvent(PluginEventType.ERROR, pluginId, metadata.tenantId, { error: error.message });
      throw new PluginExecutionException(pluginId, error.message);
    }
  }

  getPlugin(pluginId: string): IPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getPluginMetadata(pluginId: string): PluginMetadata | undefined {
    return this.pluginMetadata.get(pluginId);
  }

  getAllPlugins(): PluginMetadata[] {
    return Array.from(this.pluginMetadata.values());
  }

  getPluginsByTenant(tenantId: string): PluginMetadata[] {
    const pluginIds = this.tenantPlugins.get(tenantId) || new Set();
    return Array.from(pluginIds)
      .map(id => this.pluginMetadata.get(id))
      .filter(metadata => metadata !== undefined);
  }

  async getPluginHealth(pluginId: string): Promise<HealthStatus> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new PluginNotFoundException(pluginId);
    }

    if (plugin.onHealthCheck) {
      return await plugin.onHealthCheck();
    }

    return {
      status: 'healthy',
      checks: [],
      lastCheck: new Date(),
      uptime: Date.now() - this.pluginMetadata.get(pluginId).created.getTime()
    };
  }

  async enablePlugin(pluginId: string): Promise<void> {
    const metadata = this.pluginMetadata.get(pluginId);
    if (!metadata) {
      throw new PluginNotFoundException(pluginId);
    }

    if (metadata.status === PluginStatus.ACTIVE) {
      return;
    }

    metadata.status = PluginStatus.ACTIVE;
    this.emitPluginEvent(PluginEventType.STARTED, pluginId, metadata.tenantId);
    this.logger.log(`Plugin enabled: ${pluginId}`);
  }

  async disablePlugin(pluginId: string): Promise<void> {
    const metadata = this.pluginMetadata.get(pluginId);
    if (!metadata) {
      throw new PluginNotFoundException(pluginId);
    }

    if (metadata.status === PluginStatus.INACTIVE) {
      return;
    }

    const disableStartTime = Date.now();

    try {
      // Use lifecycle manager for graceful disable
      await this.lifecycleManager.disablePlugin(pluginId);

      metadata.status = PluginStatus.INACTIVE;
      
      // Track metrics
      const disableTime = Date.now() - disableStartTime;
      this.metricsService.recordPluginDisable(pluginId, disableTime, true);

      this.emitPluginEvent(PluginEventType.STOPPED, pluginId, metadata.tenantId);
      this.logger.log(`Plugin disabled: ${pluginId}`);
    } catch (error) {
      // Track failed disable metrics
      const disableTime = Date.now() - disableStartTime;
      this.metricsService.recordPluginDisable(pluginId, disableTime, false);
      
      throw error;
    }
  }

  async getPluginMetrics(pluginId?: string): Promise<any> {
    if (pluginId) {
      return this.metricsService.getPluginMetrics(pluginId);
    }
    return this.metricsService.getAllMetrics();
  }

  async resolvePluginDependencies(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new PluginNotFoundException(pluginId);
    }

    await this.dependencyInjection.resolvePluginDependencies(pluginId);
  }

  async executePluginMethod(pluginId: string, methodName: string, args: any[] = []): Promise<any> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new PluginNotFoundException(pluginId);
    }

    const executionStartTime = Date.now();

    try {
      const result = await this.dependencyInjection.executePluginMethod(pluginId, methodName, args);
      
      // Track execution metrics
      const executionTime = Date.now() - executionStartTime;
      this.metricsService.recordPluginExecution(pluginId, methodName, executionTime, true);

      return result;
    } catch (error) {
      // Track failed execution metrics
      const executionTime = Date.now() - executionStartTime;
      this.metricsService.recordPluginExecution(pluginId, methodName, executionTime, false);
      
      // Handle execution error
      await this.errorBoundary.handleError(error, {
        pluginId,
        operation: `execute-${methodName}`,
        timestamp: new Date(),
        stackTrace: error.stack,
        metadata: { methodName, args }
      });

      throw error;
    }
  }

  private async initializePlugin(pluginId: string, options: PluginLoadOptions): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    const metadata = this.pluginMetadata.get(pluginId);

    const context = {
      pluginId,
      tenantId: options.tenantId,
      config: options.config || {},
      logger: new Logger(`Plugin:${pluginId}`),
      eventEmitter: this.eventEmitter,
      permissions: options.permissions || [],
      resourceLimits: options.resourceLimits || {
        memory: '128MB',
        cpu: '0.5',
        disk: '1GB',
        network: '10MB/s',
        executionTime: 30000
      }
    };

    metadata.status = PluginStatus.STARTING;
    this.emitPluginEvent(PluginEventType.STARTING, pluginId, options.tenantId);

    await plugin.initialize(context);

    this.emitPluginEvent(PluginEventType.STARTED, pluginId, options.tenantId);
  }

  private async loadInitialPlugins(): Promise<void> {
    // Load any pre-configured plugins
    // This would typically read from a configuration or database
    this.logger.log('Loading initial plugins...');
    
    try {
      const fs = require('fs-extra');
      const path = require('path');
      const pluginDirectory = './plugins';
      
      if (await fs.pathExists(pluginDirectory)) {
        const pluginDirs = await fs.readdir(pluginDirectory);
        
        for (const dir of pluginDirs) {
          const pluginPath = path.join(pluginDirectory, dir);
          const stat = await fs.stat(pluginPath);
          
          if (stat.isDirectory()) {
            const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
            if (await fs.pathExists(manifestPath)) {
              try {
                this.logger.log(`Loading plugin: ${dir}`);
                await this.loadPlugin(dir, {
                  config: {
                    enableDebug: true,
                    maxRetries: 3,
                    timeout: 30000
                  }
                });
              } catch (error) {
                this.logger.error(`Failed to load plugin ${dir}:`, error.message);
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error loading initial plugins:', error.message);
    }
  }

  private async unloadAllPlugins(): Promise<void> {
    const pluginIds = Array.from(this.plugins.keys());
    for (const pluginId of pluginIds) {
      try {
        await this.unloadPlugin(pluginId);
      } catch (error) {
        this.logger.error(`Failed to unload plugin ${pluginId} during shutdown:`, error);
      }
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [pluginId, plugin] of this.plugins) {
        const healthCheckStart = Date.now();
        
        try {
          if (plugin.onHealthCheck) {
            const health = await plugin.onHealthCheck();
            const metadata = this.pluginMetadata.get(pluginId);
            metadata.health = health;

            // Track health check metrics
            const healthCheckTime = Date.now() - healthCheckStart;
            this.metricsService.recordHealthCheck(pluginId, healthCheckTime, health.status);

            if (health.status === 'unhealthy') {
              this.logger.warn(`Plugin ${pluginId} is unhealthy:`, health);
              
              // Handle unhealthy plugin through error boundary
              await this.errorBoundary.handleError(new Error(`Plugin ${pluginId} is unhealthy`), {
                pluginId,
                operation: 'health-check',
                timestamp: new Date(),
                metadata: { health }
              });

              this.emitPluginEvent(PluginEventType.HEALTH_CHECK, pluginId, metadata.tenantId, { health });
            }
          }
        } catch (error) {
          this.logger.error(`Health check failed for plugin ${pluginId}:`, error);
          
          // Track failed health check
          const healthCheckTime = Date.now() - healthCheckStart;
          this.metricsService.recordHealthCheck(pluginId, healthCheckTime, 'unhealthy');
          
          // Handle health check error
          await this.errorBoundary.handleError(error, {
            pluginId,
            operation: 'health-check',
            timestamp: new Date(),
            stackTrace: error.stack
          });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private addPluginToTenant(tenantId: string, pluginId: string): void {
    if (!this.tenantPlugins.has(tenantId)) {
      this.tenantPlugins.set(tenantId, new Set());
    }
    this.tenantPlugins.get(tenantId).add(pluginId);
  }

  private removePluginFromTenant(tenantId: string, pluginId: string): void {
    const plugins = this.tenantPlugins.get(tenantId);
    if (plugins) {
      plugins.delete(pluginId);
      if (plugins.size === 0) {
        this.tenantPlugins.delete(tenantId);
      }
    }
  }

  private emitPluginEvent(type: PluginEventType, pluginId: string, tenantId?: string, data?: any): void {
    const event: PluginEvent = {
      type,
      pluginId,
      tenantId,
      timestamp: new Date(),
      data,
      traceId: uuidv4()
    };

    this.eventEmitter.emit(`plugin.${type}`, event);
    this.eventEmitter.emit('plugin.event', event);
  }
}