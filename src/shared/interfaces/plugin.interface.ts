import type { ModuleMetadata } from '@nestjs/common';
import type { PluginContext } from './plugin.interface';

// Re-export plugin types to maintain compatibility
export { IPlugin, PluginContext, PluginConfigSchema, PluginConfigProperty, HealthStatus, PluginMetrics } from '@types';

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
