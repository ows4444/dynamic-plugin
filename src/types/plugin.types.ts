export interface IPlugin {
  onModuleInit?(): Promise<void>;
  onModuleDestroy?(): Promise<void>;
  onPluginInstall?(context: PluginContext): Promise<void>;
  onPluginUninstall?(context: PluginContext): Promise<void>;
  getHealth?(): Promise<HealthStatus>;
  getMetrics?(): Promise<PluginMetrics>;
}

export interface PluginContext<T extends BasePluginConfig = BasePluginConfig> {
  pluginId: string;
  config: PluginConfig<T>;
  logger: Logger;
  database?: DatabaseConnection;
  eventBus: EventBus;
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

  // Custom configuration (extensible)
  [key: string]: unknown;
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
  module: unknown;
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

export interface PluginEventMetadata {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  priority?: PluginSeverity;
  retryCount?: number;
  maxRetries?: number;
  ttl?: number;
  encrypted?: boolean;
  [key: string]: unknown;
}

export interface PluginEvent {
  id: string;
  type: string;
  source: string;
  target?: string;
  data: unknown;
  timestamp: Date;
  metadata?: PluginEventMetadata;
}

export interface PluginInterop {
  sendMessage(target: string, message: unknown): Promise<void>;
  broadcastEvent(event: PluginEvent): Promise<void>;
  subscribeToEvents(eventTypes: string[]): Promise<void>;
  callPluginMethod(pluginId: string, method: string, args: unknown[]): Promise<unknown>;
  shareResource(resource: SharedResource): Promise<void>;
}

export interface SharedResource {
  id: string;
  type: string;
  data: unknown;
  permissions: string[];
  ttl?: number;
}

export interface EventBus {
  publish(event: PluginEvent): Promise<void>;
  subscribe(eventPattern: string, handler: (event: PluginEvent) => void): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
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

export interface Logger {
  log(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export enum HealthStatusType {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
}

export enum PluginSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum PluginEventType {
  LIFECYCLE = 'plugin.lifecycle',
  ERROR = 'plugin.error',
  HEALTH = 'plugin.health',
  METRICS = 'plugin.metrics',
  COMMUNICATION = 'plugin.communication',
  SECURITY = 'plugin.security',
}

export enum SecurityResourceType {
  DATABASE = 'database',
  FILESYSTEM = 'filesystem',
  NETWORK = 'network',
  SYSTEM = 'system',
  PLUGINS = 'plugins',
  CONFIG = 'config',
  LOGS = 'logs',
}

export enum SecurityAction {
  READ = 'read',
  WRITE = 'write',
  CREATE = 'create',
  DELETE = 'delete',
  EXECUTE = 'execute',
  MODIFY = 'modify',
  ACCESS = 'access',
  WILDCARD = '*',
}

export type RateLimitOperation = Map<string, number>;

export type PluginRateLimits = Map<string, RateLimitOperation>;

export interface SecurityReport {
  timestamp: Date;
  totalPlugins: number;
  totalActivities: number;
  recentActivities: ActivitySummary[];
  securityViolations: PluginActivity[];
  rateLimitViolations: RateLimitViolation[];
  plugins: PluginSecurityInfo[];
}

export interface ActivitySummary {
  pluginId: string;
  action: string;
  timestamp: Date;
  metadata?: PluginActivityMetadata;
}

export interface RateLimitViolation {
  pluginId: string;
  operation: string;
  currentCount: number;
  limit: number;
  timestamp: Date;
}

export interface PluginSecurityInfo {
  pluginId: string;
  permissions: PluginPermissions;
  isolation: boolean;
  resourceLimits: ResourceLimits;
}

export interface DependencyHealth {
  name: string;
  status: HealthStatusType;
  latency?: number;
  version?: string;
  endpoint?: string;
}

export interface HealthDetails {
  uptime?: number;
  memory?: number;
  cpu?: number;
  disk?: number;
  network?: number;
  dependencies?: DependencyHealth[];
  lastError?: string;
  serviceInfo?: {
    version: string;
    environment: string;
    region?: string;
  };
  [key: string]: unknown;
}

export interface HealthStatus {
  status: HealthStatusType;
  timestamp: Date;
  details?: HealthDetails;
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
  result?: unknown;
  error?: Error;
  executionTime: number;
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

export interface PluginError extends Error {
  pluginId: string;
  code: string;
  severity: PluginSeverity;
  recoverable: boolean;
  context?: PluginErrorContext;
  timestamp: Date;
  stackTrace?: string;
}

export interface RecoveryResult {
  success: boolean;
  strategy: string;
  message?: string;
}

export enum PluginActivityResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

export enum PluginActivityAction {
  INSTALL = 'install',
  UNINSTALL = 'uninstall',
  START = 'start',
  STOP = 'stop',
  RELOAD = 'reload',
  UPDATE = 'update',
  HEALTH_CHECK = 'health_check',
  CONFIG_UPDATE = 'config_update',
  METHOD_CALL = 'method_call',
}

export interface ResourceUsage {
  memory?: number;
  cpu?: number;
  network?: number;
  disk?: number;
  handles?: number;
}

export interface PluginActivityMetadata {
  duration?: number;
  result?: PluginActivityResult;
  resourcesUsed?: ResourceUsage;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  parameters?: Record<string, unknown>;
  returnValue?: unknown;
  [key: string]: unknown;
}

export interface PluginActivity {
  pluginId: string;
  action: PluginActivityAction | string;
  timestamp: Date;
  metadata?: PluginActivityMetadata;
  version?: string;
  environment?: string;
}

export interface Subscription {
  id: string;
  pluginId: string;
  eventPattern: string;
  handler: (event: PluginEvent) => void;
  createdAt: Date;
}
