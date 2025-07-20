/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Common Types - Shared base types and utilities across the plugin system
 */

export type BuildTarget = 'es5' | 'es2015' | 'es2016' | 'es2017' | 'es2018' | 'es2019' | 'es2020' | 'es2021' | 'es2022' | 'esnext';

// Environment and Runtime Types
export enum EnvironmentType {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test',
}

export enum NetworkProtocol {
  HTTP = 'http',
  HTTPS = 'https',
  TCP = 'tcp',
  UDP = 'udp',
  WS = 'ws',
  WSS = 'wss',
}

// Status and State Enums
export enum PluginStatus {
  INSTALLED = 'installed',
  LOADING = 'loading',
  LOADED = 'loaded',
  RUNNING = 'running',
  STOPPED = 'stopped',
  ERROR = 'error',
  UNINSTALLING = 'uninstalling',
  UNINSTALLED = 'uninstalled',
  AVAILABLE = 'available',
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

export enum ModuleState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  UNLOADING = 'unloading',
}

export enum IsolationLevel {
  NONE = 'none',
  BASIC = 'basic',
  ENHANCED = 'enhanced',
  STRICT = 'strict',
}

// Plugin Registry Types
export enum PluginRegistryScope {
  PUBLIC = 'public',
  PRIVATE = 'private',
  ORGANIZATION = 'organization',
  LOCAL = 'local',
}

export enum PluginRegistrySortBy {
  NAME = 'name',
  DOWNLOADS = 'downloads',
  RATING = 'rating',
  UPDATED = 'updated',
  CREATED = 'created',
  POPULARITY = 'popularity',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum PluginLicense {
  MIT = 'MIT',
  APACHE_2_0 = 'Apache-2.0',
  GPL_3_0 = 'GPL-3.0',
  BSD_3_CLAUSE = 'BSD-3-Clause',
  ISC = 'ISC',
  PROPRIETARY = 'proprietary',
}

// Activity and Result Types
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

// Shared Interface Patterns
export interface BaseResult {
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface TimestampedResult extends BaseResult {
  timestamp: Date;
}

export interface VersionedResult extends BaseResult {
  version: string;
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

// Resource Management Types
export interface ResourceLimits {
  memory: number;
  cpu: number;
  network: number;
  filesystem: number;
  processes?: number;
  timeouts?: {
    startup: number;
    shutdown: number;
    idle: number;
  };
}

export interface ResourceUsage {
  memory?: number;
  cpu?: number;
  network?: number;
  disk?: number;
  handles?: number;
  processes?: number;
}

// Plugin Dependency Types
export interface PluginDependency {
  name: string;
  version: string;
  required: boolean;
}

export interface PluginEngines {
  node: string;
  nestjs: string;
}

// Error and Context Types
export interface ErrorContext {
  operation?: string;
  resource?: string;
  userId?: string;
  requestId?: string;
  stackTrace?: string;
  additionalInfo?: unknown;
  [key: string]: unknown;
}

export interface BaseError extends Error {
  code: string;
  severity: PluginSeverity;
  recoverable: boolean;
  context?: ErrorContext;
  timestamp: Date;
  stackTrace?: string;
}

// Metadata and Info Types
export interface MetadataInfo {
  category: string;
  tags: string[];
  documentation?: string;
  repository?: string;
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

export interface DependencyHealth {
  name: string;
  status: HealthStatusType;
  latency?: number;
  version?: string;
  endpoint?: string;
}

export interface HealthStatus {
  status: HealthStatusType;
  timestamp: Date;
  details?: HealthDetails;
}

// Metrics Types
export interface BaseMetrics {
  cpu: number;
  memory: number;
  requests: number;
  errors: number;
  uptime: number;
  [key: string]: number;
}

// Utility Types
// Basic Utility Types
export type WithOptional<TType, TKey extends keyof TType> = Omit<TType, TKey> & Partial<Pick<TType, TKey>>;

export type WithRequired<TType, TKey extends keyof TType> = Omit<TType, TKey> & Required<Pick<TType, TKey>>;

// Deep Utility Types
export type DeepPartial<TType> = {
  [TKey in keyof TType]?: TType[TKey] extends object ? (TType[TKey] extends (...args: any[]) => any ? TType[TKey] : DeepPartial<TType[TKey]>) : TType[TKey];
};

export type DeepRequired<TType> = {
  [TKey in keyof TType]-?: TType[TKey] extends object ? (TType[TKey] extends (...args: any[]) => any ? TType[TKey] : DeepRequired<TType[TKey]>) : TType[TKey];
};

// Merge two types (TTarget gets overridden by TSource)
export type Merge<TTarget, TSource> = Omit<TTarget, keyof TSource> & TSource;

// Convert union to intersection
export type UnionToIntersection<TUnion> = (TUnion extends any ? (arg: TUnion) => void : never) extends (arg: infer TIntersection) => void ? TIntersection : never;

// Make all properties mutable (remove readonly)
export type Mutable<TType> = {
  -readonly [TKey in keyof TType]: TType[TKey];
};

// Deep version of Mutable
export type DeepMutable<TType> = {
  -readonly [TKey in keyof TType]: TType[TKey] extends object ? DeepMutable<TType[TKey]> : TType[TKey];
};

// Exclude null and undefined
export type NonNullableProps<TType> = {
  [TKey in keyof TType]: NonNullable<TType[TKey]>;
};

// Nullable all properties
export type Nullable<TType> = {
  [TKey in keyof TType]: TType[TKey] | null;
};

// Optional all properties
export type Optional<TType> = {
  [TKey in keyof TType]?: TType[TKey];
};

// Remove index signatures
export type RemoveIndexSignature<TType> = {
  [TKey in keyof TType as string extends TKey ? never : number extends TKey ? never : symbol extends TKey ? never : TKey]: TType[TKey];
};

// Generic Result Types
export interface InstallationResult extends BaseResult {
  pluginId: string;
  version: string;
  installTime?: Date;
}

export interface LoadResult extends BaseResult {
  pluginId: string;
  loadTime: number;
}

export interface UnloadResult extends BaseResult {
  pluginId: string;
}

export interface ReloadResult extends BaseResult {
  pluginId: string;
  loadTime: number;
}

export interface UpdateResult extends BaseResult {
  pluginId: string;
  fromVersion: string;
  toVersion: string;
}

export interface RecoveryResult extends BaseResult {
  strategy: string;
}

// Plugin Information Types
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

// Activity Types
export interface ActivityMetadata {
  duration?: number;
  result?: PluginActivityResult;
  resourcesUsed?: ResourceUsage;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  parameters?: Record<string, unknown>;
  returnValue?: unknown;
  operation?: string;
  currentCount?: number;
  limit?: number;
  [key: string]: unknown;
}

export interface Activity {
  timestamp: Date;
  metadata?: ActivityMetadata;
  version?: string;
  environment?: string;
}

// Module and Status Types are defined in runtime.types.ts

// Compilation Types (shared between development and runtime)
export interface BaseCompilationResult {
  success: boolean;
  outputPath: string;
  sourceMap?: string;
  diagnostics: BaseCompilationDiagnostic[];
  assets: BaseCompiledAsset[];
  dependencies: string[];
  size: number;
  time: number;
}

export interface BaseCompilationDiagnostic {
  level: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
  source?: string;
}

export interface BaseCompiledAsset {
  name: string;
  path: string;
  size: number;
  type: string;
  checksum: string;
}

export interface BaseCompilationCache {
  pluginId: string;
  sourceHash: string;
  compiledPath: string;
  timestamp: Date;
  dependencies: string[];
  valid: boolean;
}

// Type Guards
export function isBaseResult(obj: unknown): obj is BaseResult {
  return typeof obj === 'object' && obj !== null && 'success' in obj;
}

export function isPluginStatus(status: string): status is PluginStatus {
  return Object.values(PluginStatus).includes(status as PluginStatus);
}

export function isHealthStatus(status: string): status is HealthStatusType {
  return Object.values(HealthStatusType).includes(status as HealthStatusType);
}

export function isPluginSeverity(severity: string): severity is PluginSeverity {
  return Object.values(PluginSeverity).includes(severity as PluginSeverity);
}
