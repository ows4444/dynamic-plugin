import type { ModuleMetadata } from '@nestjs/common';
import { Type } from '@nestjs/common';
import type { HealthStatus, PluginContext, PluginMetrics } from '@/types/plugin.types';

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
   */
  getConfigSchema?(): Promise<any>;

  /**
   * Validates the plugin's configuration
   */
  validateConfig?(config: any): Promise<boolean>;
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
  configSchema?: any;

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
  handleEvent?(eventType: string, data: any): Promise<void>;
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
  handler: (data: any) => Promise<void>;
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
  use: (req: any, res: any, next: any) => void;
}

export interface PluginGuard {
  /**
   * Guard name
   */
  name: string;

  /**
   * Can activate function
   */
  canActivate: (context: any) => boolean | Promise<boolean>;
}

export interface PluginInterceptor {
  /**
   * Interceptor name
   */
  name: string;

  /**
   * Intercept function
   */
  intercept: (context: any, next: any) => any;
}

export interface PluginPipe {
  /**
   * Pipe name
   */
  name: string;

  /**
   * Transform function
   */
  transform: (value: any, metadata: any) => any;
}

export interface PluginFilter {
  /**
   * Filter name
   */
  name: string;

  /**
   * Catch function
   */
  catch: (exception: any, host: any) => void;
}
