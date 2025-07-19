export interface IPlugin {
  onModuleInit?(): Promise<void>;
  onModuleDestroy?(): Promise<void>;
  onPluginInstall?(context: PluginContext): Promise<void>;
  onPluginUninstall?(context: PluginContext): Promise<void>;
  getHealth?(): Promise<HealthStatus>;
  getMetrics?(): Promise<PluginMetrics>;
}

export interface PluginContext {
  pluginId: string;
  config: PluginConfig;
  logger: Logger;
  database?: DatabaseConnection;
  eventBus: EventBus;
  cache?: CacheService;
  security: SecurityContext;
  interop: PluginInterop;
}

export type PluginConfig = Record<string, any>;

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
  dependencies: PluginDependency[];
  pluginDependencies: Record<string, string>;
  loadTime: number;
  memory: number;
  cpu: number;
  main: string;
  types?: string;
  engines: PluginEngines;
  hooks: PluginHooks;
  configuration: PluginConfiguration;
  metadata: PluginMetadataInfo;
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
  pluginDependencies: Record<string, string>;
  capabilities: string[];
  permissions: PluginPermissions;
  hooks: PluginHooks;
  configuration: PluginConfiguration;
  metadata: PluginMetadataInfo;
}

export interface PluginEngines {
  node: string;
  nestjs: string;
}

export interface PluginHooks {
  onInstall?: string;
  onUninstall?: string;
  onStart?: string;
  onStop?: string;
}

export interface PluginConfiguration {
  schema?: string;
  defaults?: string;
}

export interface PluginMetadataInfo {
  category: string;
  tags: string[];
  documentation?: string;
  repository?: string;
}

export interface PluginPermissions {
  database?: string[];
  network?: string[];
  filesystem?: string[];
  [key: string]: string[] | undefined;
}

export interface PluginDependency {
  name: string;
  version: string;
  required: boolean;
}

export interface PluginInstance {
  id: string;
  metadata: PluginMetadata;
  module: any;
  context: PluginContext;
  status: PluginStatus;
  startTime: Date;
  lastActivity: Date;
}

export interface PluginSource {
  type: 'npm' | 'git' | 'file' | 'url';
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
  manifest: PluginManifest;
  files: Map<string, Buffer>;
  signature?: string;
  checksum: string;
}

export interface SecurityContext {
  pluginId: string;
  permissions: PluginPermissions;
  isolation: boolean;
  resourceLimits: ResourceLimits;
}

export interface ResourceLimits {
  memory: number;
  cpu: number;
  network: number;
  filesystem: number;
}

export interface PluginEvent {
  id: string;
  type: string;
  source: string;
  target?: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PluginInterop {
  sendMessage(target: string, message: any): Promise<void>;
  broadcastEvent(event: PluginEvent): Promise<void>;
  subscribeToEvents(eventTypes: string[]): Promise<void>;
  callPluginMethod(pluginId: string, method: string, args: any[]): Promise<any>;
  shareResource(resource: SharedResource): Promise<void>;
}

export interface SharedResource {
  id: string;
  type: string;
  data: any;
  permissions: string[];
  ttl?: number;
}

export interface EventBus {
  publish(event: PluginEvent): Promise<void>;
  subscribe(eventPattern: string, handler: (event: PluginEvent) => void): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
}

export interface DatabaseConnection {
  query(sql: string, params?: any[]): Promise<any>;
  transaction<T>(fn: (trx: any) => Promise<T>): Promise<T>;
}

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface Logger {
  log(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  details?: Record<string, any>;
}

export interface PluginMetrics {
  cpu: number;
  memory: number;
  requests: number;
  errors: number;
  uptime: number;
  [key: string]: number;
}

export enum PluginStatus {
  INSTALLED = 'installed',
  LOADING = 'loading',
  LOADED = 'loaded',
  RUNNING = 'running',
  STOPPED = 'stopped',
  ERROR = 'error',
  UNINSTALLING = 'uninstalling',
  UNINSTALLED = 'uninstalled',
}

export interface InstallationResult {
  success: boolean;
  pluginId: string;
  version: string;
  message?: string;
  errors?: string[];
}

export interface LoadResult {
  success: boolean;
  pluginId: string;
  loadTime: number;
  message?: string;
  errors?: string[];
}

export interface UnloadResult {
  success: boolean;
  pluginId: string;
  message?: string;
  errors?: string[];
}

export interface ReloadResult {
  success: boolean;
  pluginId: string;
  loadTime: number;
  message?: string;
  errors?: string[];
}

export interface UpdateResult {
  success: boolean;
  pluginId: string;
  fromVersion: string;
  toVersion: string;
  message?: string;
  errors?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompatibilityResult {
  compatible: boolean;
  reasons: string[];
  suggestions: string[];
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: Error;
  executionTime: number;
}

export interface PluginError extends Error {
  pluginId: string;
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  context?: Record<string, any>;
}

export interface RecoveryResult {
  success: boolean;
  strategy: string;
  message?: string;
}

export interface PluginActivity {
  pluginId: string;
  action: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Subscription {
  id: string;
  pluginId: string;
  eventPattern: string;
  handler: (event: PluginEvent) => void;
  createdAt: Date;
}
