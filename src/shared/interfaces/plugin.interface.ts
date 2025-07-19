import type { ModuleMetadata } from '@nestjs/common';
import type { HealthStatus, PluginMetrics } from '@/types/plugin.types';

// Forward declaration to avoid circular dependency
export interface PluginContext {
  pluginId: string;
  config: Record<string, unknown>;
  logger: {
    log(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
  };
}

/**
 * Plugin configuration schema definition
 * Describes the structure and validation rules for plugin configuration
 */
export interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, PluginConfigProperty>;
  required?: string[];
  additionalProperties?: boolean;
  title?: string;
  description?: string;
}

/**
 * Individual configuration property definition
 */
export interface PluginConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: unknown;
  required?: boolean;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: PluginConfigProperty;
  properties?: Record<string, PluginConfigProperty>;
}

/**
 * Core plugin interface that all plugins must implement
 * Provides lifecycle methods and configuration management
 */
export interface IPlugin {
  /**
   * Called when the plugin module is initialized
   */
  onModuleInit?(): Promise<void>;

  /**
   * Called when the plugin module is destroyed
   */
  onModuleDestroy?(): Promise<void>;

  /**
   * Called when the plugin is installed
   */
  onPluginInstall?(context: PluginContext): Promise<void>;

  /**
   * Called when the plugin is uninstalled
   */
  onPluginUninstall?(context: PluginContext): Promise<void>;

  /**
   * Returns the health status of the plugin
   */
  getHealth?(): Promise<HealthStatus>;

  /**
   * Returns metrics about the plugin's performance
   */
  getMetrics?(): Promise<PluginMetrics>;

  /**
   * Returns the plugin's configuration schema
   * Defines the structure and validation rules for the plugin's configuration
   */
  getConfigSchema?(): Promise<PluginConfigSchema>;

  /**
   * Validates the plugin's configuration
   */
  validateConfig?(config: unknown): Promise<boolean>;

  /**
   * Gets the current plugin configuration
   */
  getConfig?(): Promise<Record<string, unknown>>;

  /**
   * Updates the plugin configuration
   */
  updateConfig?(config: Record<string, unknown>): Promise<void>;

  /**
   * Called when plugin is being reloaded
   */
  onReload?(): Promise<void>;

  /**
   * Called before plugin shutdown for cleanup
   */
  onBeforeShutdown?(): Promise<void>;
}

export interface PluginModuleMetadata extends ModuleMetadata {
  /**
   * Plugin-specific configuration
   */
  plugin?: PluginConfiguration;
}

export interface PluginConfiguration {
  /**
   * Plugin identifier
   */
  id: string;

  /**
   * Plugin name
   */
  name: string;

  /**
   * Plugin version
   */
  version: string;

  /**
   * Plugin description
   */
  description?: string;

  /**
   * Plugin author
   */
  author?: string;

  /**
   * Plugin capabilities
   */
  capabilities?: string[];

  /**
   * Plugin permissions required
   */
  permissions?: Record<string, string[]>;

  /**
   * Plugin dependencies
   */
  dependencies?: Record<string, string>;

  /**
   * Plugin configuration schema
   */
  configSchema?: Record<string, unknown>;

  /**
   * Plugin routes configuration
   */
  routes?: PluginRouteConfig[];

  /**
   * Plugin event subscriptions
   */
  events?: string[];
}

export interface PluginRouteConfig {
  /**
   * Route path
   */
  path: string;

  /**
   * HTTP method
   */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  /**
   * Route handler
   */
  handler: string;

  /**
   * Route middleware
   */
  middleware?: string[];

  /**
   * Route permissions
   */
  permissions?: string[];
}

/**
 * Marks a class as a plugin module
 */
export type PluginDecorator = (metadata: PluginConfiguration) => ClassDecorator;

export interface PluginServiceInterface {
  /**
   * Plugin context
   */
  readonly context: PluginContext;

  /**
   * Initialize the plugin service
   */
  initialize(): Promise<void>;

  /**
   * Cleanup the plugin service
   */
  cleanup(): Promise<void>;

  /**
   * Handle plugin events
   */
  handleEvent?(eventType: string, data: unknown): Promise<void>;
}

export interface PluginControllerInterface {
  /**
   * Plugin context
   */
  readonly context: PluginContext;
}

export interface PluginEventHandler {
  /**
   * Event type to handle
   */
  eventType: string;

  /**
   * Event handler function
   */
  handler: (data: unknown) => Promise<void>;
}

export interface PluginHookHandler {
  /**
   * Hook name
   */
  hookName: string;

  /**
   * Hook handler function
   */
  handler: (context: PluginContext) => Promise<void>;
}

export interface PluginMiddleware {
  /**
   * Middleware name
   */
  name: string;

  /**
   * Middleware function
   */
  use: (req: unknown, res: unknown, next: unknown) => void;
}

export interface PluginGuard {
  /**
   * Guard name
   */
  name: string;

  /**
   * Can activate function
   */
  canActivate: (context: unknown) => boolean | Promise<boolean>;
}

export interface PluginInterceptor {
  /**
   * Interceptor name
   */
  name: string;

  /**
   * Intercept function
   */
  intercept: (context: unknown, next: unknown) => unknown;
}

export interface PluginPipe {
  /**
   * Pipe name
   */
  name: string;

  /**
   * Transform function
   */
  transform: (value: unknown, metadata: unknown) => unknown;
}

export interface PluginFilter {
  /**
   * Filter name
   */
  name: string;

  /**
   * Catch function
   */
  catch: (exception: unknown, host: unknown) => void;
}
