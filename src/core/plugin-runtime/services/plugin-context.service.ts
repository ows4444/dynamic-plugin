import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as path from 'path';
import * as fs from 'fs-extra';
import { PluginErrorCodes, PluginErrorHandler } from '@/shared/utils/error-handler.util';
import {
  DatabasePermissions,
  EnvironmentType,
  EventBus,
  FilesystemPermissions,
  IsolationLevel,
  NetworkPermissions,
  NetworkProtocol,
  PluginConfig,
  PluginContext,
  PluginEvent,
  PluginInterop,
  PluginMetadata,
  ResourceLimits,
  RuntimeContext,
  RuntimeEnvironment,
  RuntimeHooks,
  RuntimePermissions,
  SecurityContext,
  SharedResource,
  SystemPermissions,
} from '@types';

/**
 * Service for creating and managing plugin runtime contexts
 */
@Injectable()
export class PluginContextService {
  private readonly logger = new Logger(PluginContextService.name);
  private readonly pluginContexts = new Map<string, PluginContext>();
  private readonly runtimeContexts = new Map<string, RuntimeContext>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Creates a comprehensive runtime context for a plugin
   */
  createRuntimeContext(plugin: PluginMetadata): RuntimeContext {
    try {
      PluginErrorHandler.validatePluginId(plugin.id, 'runtime context creation');

      this.logger.debug(`Creating runtime context for plugin: ${plugin.id}`);

      const workingDirectory = path.join(process.cwd(), 'src', 'plugins', 'installed', plugin.name);

      const runtimeContext: RuntimeContext = {
        pluginId: plugin.id,
        workingDirectory,
        environment: this.createRuntimeEnvironment(plugin),
        isolation: this.determineIsolationLevel(plugin),
        resourceLimits: this.createResourceLimits(plugin),
        permissions: this.createRuntimePermissions(plugin),
        hooks: this.createRuntimeHooks(plugin),
        dependencies: [],
      };

      this.runtimeContexts.set(plugin.id, runtimeContext);

      this.eventEmitter.emit('plugin.runtime.context.created', {
        pluginId: plugin.id,
        isolation: runtimeContext.isolation,
      });

      this.logger.debug(`Runtime context created for plugin: ${plugin.id}`);
      return runtimeContext;
    } catch (error) {
      throw PluginErrorHandler.createPluginError(plugin.id, PluginErrorCodes.EXECUTION_FAILED, `Failed to create runtime context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates a plugin context for plugin execution
   */
  async createPluginContext(plugin: PluginMetadata): Promise<PluginContext> {
    try {
      PluginErrorHandler.validatePluginId(plugin.id, 'plugin context creation');

      this.logger.debug(`Creating plugin context for: ${plugin.id}`);

      const runtimeContext = this.createRuntimeContext(plugin);
      const config = await this.loadPluginConfig(plugin);

      const context: PluginContext = {
        pluginId: plugin.id,
        config,
        logger: new Logger(`Plugin:${plugin.name}`),
        eventBus: this.createEventBus(plugin.id),
        security: this.createSecurityContext(plugin, runtimeContext),
        interop: this.createPluginInterop(plugin.id),
      };

      this.pluginContexts.set(plugin.id, context);

      this.eventEmitter.emit('plugin.context.created', {
        pluginId: plugin.id,
        hasConfig: Object.keys(config).length > 0,
      });

      this.logger.debug(`Plugin context created successfully for: ${plugin.id}`);
      return context;
    } catch (error) {
      return PluginErrorHandler.withErrorHandling(
        () => {
          throw error;
        },
        plugin.id,
        'create plugin context',
      );
    }
  }

  /**
   * Destroys plugin contexts and cleans up resources
   */
  destroyPluginContext(pluginId: string): void {
    try {
      PluginErrorHandler.validatePluginId(pluginId, 'plugin context destruction');

      this.logger.debug(`Destroying plugin context for: ${pluginId}`);

      // Remove contexts
      this.pluginContexts.delete(pluginId);
      this.runtimeContexts.delete(pluginId);

      this.eventEmitter.emit('plugin.context.destroyed', { pluginId });

      this.logger.debug(`Plugin context destroyed for: ${pluginId}`);
    } catch (error) {
      PluginErrorHandler.handlePluginError(
        PluginErrorHandler.createPluginError(pluginId, PluginErrorCodes.EXECUTION_FAILED, `Failed to destroy plugin context: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  }

  /**
   * Gets plugin context
   */
  getPluginContext(pluginId: string): PluginContext | null {
    return this.pluginContexts.get(pluginId) ?? null;
  }

  /**
   * Gets runtime context
   */
  getRuntimeContext(pluginId: string): RuntimeContext | null {
    return this.runtimeContexts.get(pluginId) ?? null;
  }

  /**
   * Updates plugin configuration
   */
  updatePluginConfig(pluginId: string, config: Record<string, unknown>): void {
    try {
      PluginErrorHandler.validatePluginId(pluginId, 'config update');
      const validatedConfig = PluginErrorHandler.validateConfiguration(config, pluginId);

      const context = this.pluginContexts.get(pluginId);
      if (!context) {
        throw PluginErrorHandler.createPluginError(pluginId, PluginErrorCodes.PLUGIN_NOT_FOUND, `Plugin context not found: ${pluginId}`);
      }

      context.config = validatedConfig;

      this.eventEmitter.emit('plugin.config.updated', {
        pluginId,
        configKeys: Object.keys(validatedConfig),
      });

      this.logger.debug(`Plugin configuration updated for: ${pluginId}`);
    } catch (error) {
      PluginErrorHandler.handlePluginError(error as Error, pluginId);
    }
  }

  private createRuntimeEnvironment(plugin: PluginMetadata): RuntimeEnvironment {
    return {
      nodeVersion: process.version,
      nestjsVersion: '11.0.0', // Would get from actual NestJS version
      platform: process.platform,
      architecture: process.arch,
      environmentType: (process.env.NODE_ENV as EnvironmentType) ?? EnvironmentType.DEVELOPMENT,
      variables: this.getPluginEnvironmentVariables(plugin.id),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
    };
  }

  private determineIsolationLevel(plugin: PluginMetadata): IsolationLevel {
    // Basic isolation level determination based on plugin capabilities and permissions
    const permissions = Array.isArray(plugin.permissions) ? { general: plugin.permissions } : (plugin.permissions as any);

    const hasNetworkAccess = permissions.network && permissions.network.length > 0;
    const hasFileSystemAccess = permissions.filesystem && permissions.filesystem.length > 0;
    const hasDatabaseAccess = permissions.database && permissions.database.length > 0;

    if (hasNetworkAccess ?? hasFileSystemAccess ?? hasDatabaseAccess) {
      return IsolationLevel.BASIC;
    }

    return IsolationLevel.NONE;
  }

  private createResourceLimits(_plugin: PluginMetadata): ResourceLimits {
    // Default resource limits - could be customized based on plugin requirements
    return {
      memory: 512 * 1024 * 1024, // 512MB
      cpu: 100, // 100%
      network: 100 * 1024 * 1024, // 100MB
      filesystem: 1024 * 1024 * 1024, // 1GB
      processes: 10,
      timeouts: {
        startup: 30000, // 30 seconds
        shutdown: 10000, // 10 seconds
        idle: 300000, // 5 minutes
      },
    };
  }

  private createRuntimePermissions(plugin: PluginMetadata): RuntimePermissions {
    const pluginDir = path.join(process.cwd(), 'src', 'plugins', 'installed', plugin.name);

    const filesystem: FilesystemPermissions = {
      read: [pluginDir, path.join(pluginDir, 'data')],
      write: [path.join(pluginDir, 'data'), path.join(pluginDir, 'temp')],
      execute: [],
      delete: [path.join(pluginDir, 'temp')],
    };

    const network: NetworkPermissions = {
      outbound: [
        { protocol: NetworkProtocol.HTTPS, host: '*', port: 443, allowed: true },
        { protocol: NetworkProtocol.HTTP, host: 'localhost', port: [3000, 8000, 8080], allowed: true },
      ],
      inbound: [],
    };

    const system: SystemPermissions = {
      processes: false,
      environment: false,
      filesystem: true,
      network: true,
    };

    const pluginPermissions = Array.isArray(plugin.permissions) ? { general: plugin.permissions } : (plugin.permissions as any);

    const database: DatabasePermissions = {
      read: pluginPermissions.database ?? [],
      write: [],
      schema: [],
    };

    return {
      filesystem,
      network,
      system,
      database,
      plugins: plugin.permissions,
    };
  }

  private createRuntimeHooks(plugin: PluginMetadata): RuntimeHooks {
    const hooks = plugin.hooks || {};

    return {
      beforeLoad: hooks.onStart,
      afterLoad: hooks.onStart,
      beforeUnload: hooks.onStop,
      afterUnload: hooks.onStop,
      onError: undefined,
      onHealthCheck: undefined,
    };
  }

  private getPluginEnvironmentVariables(pluginId: string): Record<string, string> {
    const envVars: Record<string, string> = {};
    const prefix = `PLUGIN_${pluginId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_`;

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix) && value) {
        envVars[key.substring(prefix.length)] = value;
      }
    }

    return envVars;
  }

  private async loadPluginConfig(plugin: PluginMetadata): Promise<PluginConfig> {
    try {
      const configPath = path.join(process.cwd(), 'src', 'plugins', 'installed', plugin.name, 'config', 'plugin.config.json');

      if (await fs.pathExists(configPath)) {
        const configData = (await fs.readJson(configPath)) as PluginConfig;
        return PluginErrorHandler.validateConfiguration(configData, plugin.id);
      }

      return {};
    } catch (error) {
      this.logger.warn(`Failed to load config for plugin ${plugin.id}:`, error);
      return {};
    }
  }

  private createEventBus(pluginId: string): EventBus {
    return {
      publish: (event: PluginEvent): void => {
        // Add plugin source to event
        const enrichedEvent = {
          ...event,
          source: pluginId,
          timestamp: new Date(),
        };

        this.eventEmitter.emit('plugin.event', enrichedEvent);
      },

      subscribe: (eventPattern: string, handler: (event: PluginEvent) => void): string => {
        const subscriptionId = `${pluginId}:${eventPattern}:${Date.now()}`;

        // Wrap handler to ensure proper error handling
        const wrappedHandler = (event: PluginEvent) => {
          try {
            handler(event);
          } catch (error) {
            this.logger.error(`Error in event handler for ${pluginId}:`, error);
          }
        };

        this.eventEmitter.on(eventPattern, wrappedHandler);
        return subscriptionId;
      },

      unsubscribe: (subscriptionId: string): void => {
        // Implementation would track and remove specific subscription
        this.logger.debug(`Unsubscribing ${subscriptionId}`);
      },
    };
  }

  private createSecurityContext(plugin: PluginMetadata, runtimeContext: RuntimeContext): SecurityContext {
    return {
      pluginId: plugin.id,
      permissions: plugin.permissions,
      isolation: runtimeContext.isolation !== IsolationLevel.NONE,
      resourceLimits: runtimeContext.resourceLimits,
    };
  }

  private createPluginInterop(pluginId: string): PluginInterop {
    return {
      sendMessage: (target: string, message: unknown): void => {
        this.eventEmitter.emit('plugin.message', {
          from: pluginId,
          to: target,
          message,
          timestamp: new Date(),
        });
      },

      broadcastEvent: (event: PluginEvent): void => {
        this.eventEmitter.emit('plugin.broadcast', {
          ...event,
          source: pluginId,
          timestamp: new Date(),
        });
      },

      subscribeToEvents: (eventTypes: string[]): void => {
        for (const eventType of eventTypes) {
          this.eventEmitter.on(eventType, (data: PluginEvent) => {
            this.logger.debug(`Plugin ${pluginId} received event: ${eventType}`, data);
          });
        }
      },

      callPluginMethod: (targetPluginId: string, method: string, args: unknown[]): unknown => {
        // Implementation would call method on target plugin through plugin manager
        this.logger.debug(`Plugin ${pluginId} calling method ${method} on ${targetPluginId}`, args);
        return undefined;
      },

      shareResource: (resource: SharedResource): void => {
        this.eventEmitter.emit('plugin.resource.shared', {
          from: pluginId,
          resource,
          timestamp: new Date(),
        });
      },
    };
  }
}
