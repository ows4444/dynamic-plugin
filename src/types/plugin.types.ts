/**
 * Core Plugin Types - Core plugin interfaces and metadata
 */

import type { BaseMetrics, HealthStatus, MetadataInfo, PluginConfiguration, PluginDependency, PluginEngines, PluginHooks, PluginSeverity, PluginStatus } from './common.types';
import type { PluginEventBus, PluginInterop } from './interop.types';
import type { SecurityContext } from './security.types';

// IPlugin interface definition (moved here to avoid circular dependency)
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

// Plugin configuration schema definition
export interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, PluginConfigProperty>;
  required?: string[];
  additionalProperties?: boolean;
  title?: string;
  description?: string;
}

// Individual configuration property definition
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

// Core Plugin Interfaces
export interface PluginContext<T extends BasePluginConfig = BasePluginConfig> {
  pluginId: string;
  config: PluginConfig<T>;
  logger: Logger;
  database?: DatabaseConnection;
  eventBus?: PluginEventBus;
  cache?: CacheService;
  security: SecurityContext;
  interop: PluginInterop;
}

// Base configuration interface that all plugins should extend
export interface BasePluginConfig {
  // Core plugin settings
  enabled?: boolean;
  debug?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';

  // Performance settings
  timeout?: number;
  retryAttempts?: number;
  maxConnections?: number;

  // Security settings
  allowedOrigins?: string[];
  rateLimitRequests?: number;
  rateLimitWindow?: number;

  // Feature flags
  features?: Record<string, boolean>;

  // Custom configuration (more type-safe)
  customConfig?: Record<string, string | number | boolean | object>;

  // Metadata for plugins
  metadata?: Record<string, string | number | boolean>;
}

// Sample plugin specific configuration
export interface SamplePluginConfig extends BasePluginConfig {
  greeting?: string;
  maxItems?: number;
  autoCleanup?: boolean;
  cleanupInterval?: number;
  notificationSettings?: {
    enabled: boolean;
    channels: string[];
    threshold: number;
  };
}

// Generic plugin config type that can be extended by specific plugins
export type PluginConfig<T extends BasePluginConfig = BasePluginConfig> = T;

// Utility type for strongly typed plugin configurations
export type TypedPluginConfig<T> = T extends BasePluginConfig ? T : BasePluginConfig;

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  status: PluginStatus;
  capabilities: string[];
  permissions: PluginPermissions;
  dependencies: Record<string, string>;
  pluginDependencies: PluginDependency[];
  loadTime: number;
  memory: number;
  cpu: number;
  main: string; // Entry point for the plugin
  types?: string;
  engines: PluginEngines;
  hooks: PluginHooks;
  configuration: PluginConfiguration;
  metadata: MetadataInfo;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  main: string;
  types?: string;
  engines: PluginEngines;
  dependencies: Record<string, string>;
  pluginDependencies: PluginDependency[];
  capabilities: string[];
  permissions: PluginPermissions;
  hooks: PluginHooks;
  configuration: PluginConfiguration;
  metadata: MetadataInfo;
}

export interface PluginPermissions {
  database?: string[];
  network?: string[];
  filesystem?: string[];
  [key: string]: string[] | undefined;
}

export interface PluginInstance {
  id: string;
  metadata: PluginMetadata;
  module: unknown;
  context: PluginContext;
  status: PluginStatus;
  startTime: Date;
  lastActivity: Date;
}

export interface PluginSource {
  type?: 'npm' | 'git' | 'file' | 'url';
  location: string;
  version?: string;
  credentials?: PluginCredentials;
}

export interface PluginCredentials {
  username?: string;
  password?: string;
  token?: string;
}

export interface PluginPackage {
  name?: string;
  manifest: PluginManifest;
  files: Map<string, Buffer>;
  signature?: string;
  checksum: string;
}

// SecurityContext is imported from security.types
export type { SecurityContext } from './security.types';

export enum PluginEventType {
  LIFECYCLE = 'plugin.lifecycle',
  ERROR = 'plugin.error',
  HEALTH = 'plugin.health',
  METRICS = 'plugin.metrics',
  COMMUNICATION = 'plugin.communication',
  SECURITY = 'plugin.security',
}

export interface PluginMetrics extends BaseMetrics {
  // Plugin-specific metrics can be added here
  executionTime: number;
}

export interface PluginError extends Error {
  pluginId: string;
  code: string;
  severity: PluginSeverity;
  recoverable: boolean;
  context?: PluginErrorContext;
  timestamp: Date;
  stackTrace?: string;
}

export interface PluginErrorContext {
  operation?: string;
  resource?: string;
  userId?: string;
  requestId?: string;
  stackTrace?: string;
  additionalInfo?: unknown;
  [key: string]: unknown;
}

// External service interfaces
export interface Logger {
  log(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export interface DatabaseConnection {
  query(sql: string, params?: unknown[]): Promise<unknown>;
  transaction<T>(fn: (trx: unknown) => Promise<T>): Promise<T>;
}

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
}

// Import communication interfaces from interop.types
export type { PluginEventBus, PluginInterop, PluginEvent, SharedResource } from './interop.types';

// Re-export common types that plugins frequently need
export type {
  // Status and results
  PluginStatus,
  PluginSeverity,
  HealthStatusType,
  InstallationResult,
  LoadResult,
  UnloadResult,
  ReloadResult,
  UpdateResult,
  ValidationResult,
  CompatibilityResult,
  ExecutionResult,
  RecoveryResult,
  HealthStatus,
  DependencyHealth,
  HealthDetails,

  // Plugin-specific common types
  PluginDependency,
  PluginEngines,
  PluginHooks,
  PluginConfiguration,
  MetadataInfo,
  ResourceLimits,
  ResourceUsage,

  // Environment and isolation
  EnvironmentType,
  IsolationLevel,
} from './common.types';

// Note: Store and development types should be imported directly from their respective modules
// to avoid circular dependencies. They are re-exported from index.ts
