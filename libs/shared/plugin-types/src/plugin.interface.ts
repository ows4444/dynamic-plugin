import { IManifest } from "./manifest.interface";
import type { ConfigSchema as ConfigPropertySchema, PluginConfig } from './config.interface';
import type { ValidationError, ValidationResult, ValidationWarning } from './validation.interface';

export interface IPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly type: string;
  readonly category: string;
  readonly status: string;
  readonly health: string;
  readonly manifest: IPluginManifest;
  readonly config: PluginConfig;
  readonly dependencies: string[];
  readonly routes: PluginRoute[];
  readonly permissions: string[];
  readonly startedAt?: Date;
  readonly stoppedAt?: Date;
  readonly errorCount: number;
  readonly lastError?: Error;

  start(config?: PluginConfig): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  configure(config: PluginConfig): Promise<void>;
  getStatus(): string;
  getHealth(): Promise<PluginHealthCheck>;
  getMetrics(): Promise<PluginMetrics>;
  validateConfig(config: PluginConfig): Promise<ValidationResult>;
  onEvent(event: PluginEvent): Promise<void>;
  cleanup(): Promise<void>;

  // Lifecycle hooks - optional
  onInit?(): Promise<void>;
  onDestroy?(): Promise<void>;
  healthCheck?(): Promise<boolean>;

  // Request handling - optional
  handleRequest?<T = unknown, R = unknown>(requestData: T): Promise<R>;
  onWebSocketConnection?<T = unknown>(
    socket: unknown,
    data: T,
  ): Promise<void>;
}

// Re-export the comprehensive manifest interface with a cleaner name
export type IPluginManifest = IManifest;

// Re-export configuration types from the centralized config interface
export type {
  PluginConfig,
  PluginConfigSchema,
  ConfigValue,
  ConfigSchema as ConfigPropertySchema,
  ConfigValidationResult,
  ConfigValidationError,
  ConfigValidationWarning
} from './config.interface';

export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  path: string;
  handler: string;
  middleware?: string[];
  guards?: string[];
  description?: string;
  tags?: string[];
  parameters?: RouteParameter[];
  requestBody?: RouteRequestBody;
  responses?: Record<string, RouteResponse>;
}

export interface RouteParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema: ConfigPropertySchema;
}

export interface RouteRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, { schema: ConfigPropertySchema }>;
}

export interface RouteResponse {
  description: string;
  content?: Record<string, { schema: ConfigPropertySchema }>;
  headers?: Record<
    string,
    { description?: string; schema: ConfigPropertySchema }
  >;
}

export interface PluginHook {
  name: string;
  type: 'before' | 'after' | 'around';
  target: string;
  handler: string;
  priority?: number;
  async?: boolean;
}

export interface PluginHealthCheck {
  status: string;
  timestamp: Date;
  uptime: number;
  checks: HealthCheckResult[];
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
  details?: Record<string, unknown>;
}

export interface PluginMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  lastActivity: Date;
  customMetrics?: Record<string, number>;
}

// Re-export validation types from the centralized validation interface
export type { ValidationResult, ValidationError, ValidationWarning };

export interface PluginEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: Record<string, unknown>;
  pluginId?: string;
  correlationId?: string;
}

export interface PluginContext {
  pluginId: string;
  pluginName: string;
  version: string;
  hostVersion: string;
  environment: string;
  config: PluginConfig;
  logger: IPluginLogger;
  eventBus: IPluginEventBus;
  storage: IPluginStorage;
  http: IPluginHttpClient;
  cache: IPluginCache;
  scheduler: IPluginScheduler;
  metrics: IPluginMetrics;
}

export interface IPluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, error?: Error, ...args: unknown[]): void;
  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
  child(context: Record<string, unknown>): IPluginLogger;
}

export interface IPluginEventBus {
  emit(event: string, data: unknown): Promise<void>;
  on(event: string, handler: (data: unknown) => void | Promise<void>): void;
  off(event: string, handler: (data: unknown) => void | Promise<void>): void;
  once(event: string, handler: (data: unknown) => void | Promise<void>): void;
}

export interface IPluginStorage {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  clear(): Promise<void>;
}

export interface IPluginHttpClient {
  get<T = unknown>(
    url: string,
    config?: RequestConfig,
  ): Promise<HttpResponse<T>>;
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<HttpResponse<T>>;
  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<HttpResponse<T>>;
  delete<T = unknown>(
    url: string,
    config?: RequestConfig,
  ): Promise<HttpResponse<T>>;
  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<HttpResponse<T>>;
}

export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  params?: Record<string, unknown>;
  auth?: { username: string; password: string };
  retry?: number;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
}

export interface IPluginCache {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  ttl(key: string): Promise<number>;
}

export interface IPluginScheduler {
  schedule(
    name: string,
    cron: string,
    handler: () => void | Promise<void>,
  ): Promise<void>;
  unschedule(name: string): Promise<boolean>;
  listJobs(): Promise<ScheduledJob[]>;
  isScheduled(name: string): Promise<boolean>;
}

export interface ScheduledJob {
  name: string;
  cron: string;
  nextRun: Date;
  lastRun?: Date;
  status: 'active' | 'paused' | 'error';
}

export interface IPluginMetrics {
  increment(name: string, value?: number, tags?: Record<string, string>): void;
  decrement(name: string, value?: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  timer(name: string): ITimer;
  flush(): Promise<void>;
}

export interface ITimer {
  stop(): number;
}
