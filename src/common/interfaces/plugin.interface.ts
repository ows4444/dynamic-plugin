import { Type } from '@nestjs/common';
import { CanActivate, NestInterceptor, ExceptionFilter } from '@nestjs/common';
import { Provider } from '@nestjs/common';

export interface PluginDependency {
  name: string;
  version: string;
  optional?: boolean;
}

export interface Permission {
  name: string;
  description: string;
  level: 'read' | 'write' | 'admin';
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: HealthCheck[];
  lastCheck: Date;
  uptime: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  data?: any;
}

export interface RouteDefinition {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: string;
  middleware?: string[];
  guards?: string[];
  interceptors?: string[];
}

export interface MiddlewareDefinition {
  name: string;
  handler: Function;
  order: number;
}

export interface TenantIsolationConfig {
  enabled: boolean;
  isolationType: 'namespace' | 'database' | 'schema';
  tenantKey: string;
}

export interface ResourceLimits {
  memory: string;
  cpu: string;
  disk: string;
  network: string;
  executionTime: number;
}

export interface CachingStrategy {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'lfu' | 'fifo';
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PluginContext {
  pluginId: string;
  tenantId?: string;
  config: any;
  logger: any;
  eventEmitter: any;
  permissions: Permission[];
  resourceLimits: ResourceLimits;
}

export interface JSONSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface IPlugin {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly author?: string;
  readonly license?: string;
  
  readonly dependencies?: PluginDependency[];
  readonly peerDependencies?: string[];
  readonly minimumNodeVersion?: string;
  readonly requiredPermissions?: Permission[];
  
  initialize(context: PluginContext): Promise<void>;
  destroy(): Promise<void>;
  onUpdate?(oldVersion: string): Promise<void>;
  onHealthCheck?(): Promise<HealthStatus>;
  onHotReload?(): Promise<void>;
  onAssetReload?(): Promise<void>;
  onGracefulShutdown?(): Promise<void>;
  getState?(): Promise<any>;
  setState?(state: any): Promise<void>;
  
  getRoutes?(): RouteDefinition[];
  getProviders?(): Provider[];
  getMiddleware?(): MiddlewareDefinition[];
  getControllers?(): Type<any>[];
  getGuards?(): Type<CanActivate>[];
  getInterceptors?(): Type<NestInterceptor>[];
  getFilters?(): Type<ExceptionFilter>[];
  
  getConfigSchema?(): JSONSchema;
  validateConfig?(config: any): Promise<ValidationResult>;
  
  getTenantIsolation?(): TenantIsolationConfig;
  
  getResourceLimits?(): ResourceLimits;
  getCachingStrategy?(): CachingStrategy;
}

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  main: string;
  dependencies: PluginDependency[];
  peerDependencies: string[];
  minimumNodeVersion: string;
  requiredPermissions: Permission[];
  created: Date;
  updated: Date;
  status: PluginStatus;
  health?: HealthStatus;
  tenantId?: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  main: string;
  dependencies?: PluginDependency[];
  peerDependencies?: string[];
  minimumNodeVersion?: string;
  requiredPermissions?: Permission[];
  configSchema?: JSONSchema;
  tenantIsolation?: TenantIsolationConfig;
  resourceLimits?: ResourceLimits;
  cachingStrategy?: CachingStrategy;
}

export interface PluginLoadOptions {
  tenantId?: string;
  config?: any;
  resourceLimits?: ResourceLimits;
  permissions?: Permission[];
  hotReload?: boolean;
  sandboxed?: boolean;
}

export interface PluginEvent {
  type: PluginEventType;
  pluginId: string;
  tenantId?: string;
  timestamp: Date;
  data?: any;
  traceId?: string;
}

export enum PluginEventType {
  LOADING = 'loading',
  LOADED = 'loaded',
  STARTING = 'starting',
  STARTED = 'started',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  UNLOADING = 'unloading',
  UNLOADED = 'unloaded',
  ERROR = 'error',
  HEALTH_CHECK = 'health_check',
  CONFIG_UPDATED = 'config_updated',
  DEPENDENCY_RESOLVED = 'dependency_resolved',
  SECURITY_VIOLATION = 'security_violation'
}

export enum PluginStatus {
  INACTIVE = 'inactive',
  LOADING = 'loading',
  STARTING = 'starting',
  ACTIVE = 'active',
  ERROR = 'error',
  STOPPING = 'stopping',
  UPDATING = 'updating'
}