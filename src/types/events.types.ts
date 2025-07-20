/**
 * Event Types - Event system types for plugin lifecycle and custom events
 */

import type { ActivityMetadata, PluginActivityAction, PluginActivityResult, PluginSeverity } from './common.types';
import type { LatencyMetrics } from './interop.types';

// Base Event Types
export enum EventCategory {
  SYSTEM = 'system',
  PLUGIN = 'plugin',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  BUSINESS = 'business',
  CUSTOM = 'custom',
}

export enum EventPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

export enum EventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

// Core Event Interface
export interface BaseEvent {
  id: string;
  type: string;
  category: EventCategory;
  source: string;
  target?: string;
  priority: EventPriority;
  timestamp: Date;
  data: unknown;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  retryCount?: number;
  maxRetries?: number;
  ttl?: number;
  encrypted?: boolean;
  compressed?: boolean;
  version?: string;
  schema?: string;
  tags?: string[];
  [key: string]: unknown;
}

// Plugin Lifecycle Events
export enum PluginLifecycleEventType {
  PLUGIN_INSTALLING = 'plugin.installing',
  PLUGIN_INSTALLED = 'plugin.installed',
  PLUGIN_LOADING = 'plugin.loading',
  PLUGIN_LOADED = 'plugin.loaded',
  PLUGIN_STARTING = 'plugin.starting',
  PLUGIN_STARTED = 'plugin.started',
  PLUGIN_STOPPING = 'plugin.stopping',
  PLUGIN_STOPPED = 'plugin.stopped',
  PLUGIN_UNLOADING = 'plugin.unloading',
  PLUGIN_UNLOADED = 'plugin.unloaded',
  PLUGIN_UNINSTALLING = 'plugin.uninstalling',
  PLUGIN_UNINSTALLED = 'plugin.uninstalled',
  PLUGIN_ERROR = 'plugin.error',
  PLUGIN_HEALTH_CHECK = 'plugin.health_check',
  PLUGIN_CONFIGURATION_CHANGED = 'plugin.configuration_changed',
}

export interface PluginLifecycleEvent extends BaseEvent {
  type: PluginLifecycleEventType;
  category: EventCategory.PLUGIN;
  pluginId: string;
  pluginVersion?: string;
  previousState?: string;
  newState?: string;
  reason?: string;
  error?: PluginEventError;
}

export interface PluginEventError {
  code: string;
  message: string;
  stack?: string;
  severity: PluginSeverity;
  recoverable: boolean;
  context?: Record<string, unknown>;
}

// System Events
export enum SystemEventType {
  SYSTEM_STARTUP = 'system.startup',
  SYSTEM_SHUTDOWN = 'system.shutdown',
  SYSTEM_ERROR = 'system.error',
  SYSTEM_WARNING = 'system.warning',
  SYSTEM_INFO = 'system.info',
  SYSTEM_HEALTH_CHECK = 'system.health_check',
  SYSTEM_CONFIGURATION_CHANGED = 'system.configuration_changed',
  SYSTEM_MAINTENANCE_START = 'system.maintenance_start',
  SYSTEM_MAINTENANCE_END = 'system.maintenance_end',
}

export interface SystemEvent extends BaseEvent {
  type: SystemEventType;
  category: EventCategory.SYSTEM;
  component?: string;
  version?: string;
  environment?: string;
  details?: Record<string, unknown>;
}

// Security Events
export enum SecurityEventType {
  AUTHENTICATION_SUCCESS = 'security.authentication_success',
  AUTHENTICATION_FAILURE = 'security.authentication_failure',
  AUTHORIZATION_GRANTED = 'security.authorization_granted',
  AUTHORIZATION_DENIED = 'security.authorization_denied',
  PERMISSION_VIOLATION = 'security.permission_violation',
  RATE_LIMIT_EXCEEDED = 'security.rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'security.suspicious_activity',
  INTRUSION_ATTEMPT = 'security.intrusion_attempt',
  DATA_BREACH = 'security.data_breach',
  POLICY_VIOLATION = 'security.policy_violation',
}

export interface SecurityEvent extends BaseEvent {
  type: SecurityEventType;
  category: EventCategory.SECURITY;
  principalId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  riskLevel: PluginSeverity;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
}

// Performance Events
export enum PerformanceEventType {
  PERFORMANCE_THRESHOLD_EXCEEDED = 'performance.threshold_exceeded',
  PERFORMANCE_BASELINE_CHANGED = 'performance.baseline_changed',
  MEMORY_PRESSURE = 'performance.memory_pressure',
  CPU_PRESSURE = 'performance.cpu_pressure',
  DISK_PRESSURE = 'performance.disk_pressure',
  NETWORK_CONGESTION = 'performance.network_congestion',
  SLOW_QUERY = 'performance.slow_query',
  HIGH_LATENCY = 'performance.high_latency',
}

export interface PerformanceEvent extends BaseEvent {
  type: PerformanceEventType;
  category: EventCategory.PERFORMANCE;
  metric: string;
  value: number;
  threshold: number;
  unit: string;
  duration?: number;
  impact: PluginSeverity;
  recommendations?: string[];
}

// Business Events
export interface BusinessEvent extends BaseEvent {
  category: EventCategory.BUSINESS;
  aggregateId?: string;
  aggregateType?: string;
  version?: number;
  causedBy?: string;
  expectedVersion?: number;
}

// Custom Events
export interface CustomEvent extends BaseEvent {
  category: EventCategory.CUSTOM;
  namespace: string;
  schema?: string;
  version?: string;
}

// Activity Events
export interface PluginActivity extends BaseEvent {
  pluginId: string;
  action: PluginActivityAction | string;
  result?: PluginActivityResult;
  duration?: number;
  resourcesUsed?: {
    memory?: number;
    cpu?: number;
    network?: number;
    disk?: number;
  };
  metadata?: ActivityMetadata;
}

// Event Handlers and Processing
export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => Promise<EventHandlerResult>;

export interface EventHandlerResult {
  success: boolean;
  result?: unknown;
  error?: Error;
  retry?: boolean;
  retryDelay?: number;
  metadata?: Record<string, unknown>;
}

export interface EventHandlerRegistration {
  id: string;
  handlerId: string;
  eventType: string;
  eventPattern?: string;
  handler: EventHandler;
  options: EventHandlerOptions;
  registeredAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
  successCount: number;
  errorCount: number;
}

export interface EventHandlerOptions {
  priority?: number;
  async?: boolean;
  retry?: RetryOptions;
  filter?: EventFilter;
  rateLimit?: RateLimitOptions;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface RetryOptions {
  maxAttempts: number;
  backoffType: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay: number;
  multiplier?: number;
  jitter?: boolean;
}

export interface RateLimitOptions {
  maxEvents: number;
  window: number; // in milliseconds
  burst?: number;
}

export interface EventFilter {
  source?: string | string[];
  category?: EventCategory | EventCategory[];
  priority?: EventPriority | EventPriority[];
  metadata?: Record<string, unknown>;
  customFilter?: (event: BaseEvent) => boolean;
}

// Event Streams and Aggregation
export interface EventStream {
  id: string;
  name: string;
  description?: string;
  events: BaseEvent[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  lastEventAt?: Date;
  eventCount: number;
  size: number;
}

export interface EventAggregate {
  id: string;
  type: string;
  version: number;
  events: BaseEvent[];
  snapshot?: EventSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventSnapshot {
  id: string;
  aggregateId: string;
  version: number;
  data: unknown;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Event Store and Persistence
export interface EventStore {
  save(event: BaseEvent): Promise<void>;
  saveMany(events: BaseEvent[]): Promise<void>;
  getById(eventId: string): Promise<BaseEvent | null>;
  getByStream(streamId: string, fromVersion?: number): Promise<BaseEvent[]>;
  getByType(eventType: string, limit?: number): Promise<BaseEvent[]>;
  getByTimeRange(start: Date, end: Date, filter?: EventFilter): Promise<BaseEvent[]>;
  createStream(stream: Omit<EventStream, 'events' | 'eventCount' | 'size'>): Promise<EventStream>;
  appendToStream(streamId: string, events: BaseEvent[]): Promise<void>;
}

export interface EventQuery {
  streamId?: string;
  eventType?: string | string[];
  category?: EventCategory | EventCategory[];
  source?: string | string[];
  priority?: EventPriority | EventPriority[];
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'priority' | 'category';
  orderDirection?: 'asc' | 'desc';
  metadata?: Record<string, unknown>;
}

export interface EventQueryResult {
  events: BaseEvent[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

// System Event Bus Interface (for system-level events)
export interface SystemEventBus {
  publish(event: BaseEvent): Promise<void>;
  publishMany(events: BaseEvent[]): Promise<void>;
  subscribe<T extends BaseEvent = BaseEvent>(eventType: string, handler: EventHandler<T>, options?: EventHandlerOptions): Promise<string>;
  subscribeToPattern<T extends BaseEvent = BaseEvent>(pattern: string, handler: EventHandler<T>, options?: EventHandlerOptions): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  getSubscriptions(handlerId?: string): Promise<EventHandlerRegistration[]>;
  replay(query: EventQuery, handler: EventHandler): Promise<void>;
}

// Event Metrics and Monitoring
export interface EventMetrics {
  totalEvents: number;
  eventsByCategory: Record<EventCategory, number>;
  eventsByType: Record<string, number>;
  eventsByPriority: Record<EventPriority, number>;
  eventRate: number;
  processingLatency: LatencyMetrics;
  errorRate: number;
  handlerMetrics: Record<string, HandlerMetrics>;
}

// LatencyMetrics is imported from interop.types
export type { LatencyMetrics } from './interop.types';

export interface HandlerMetrics {
  handlerId: string;
  eventsProcessed: number;
  successRate: number;
  errorRate: number;
  averageProcessingTime: number;
  lastTriggered?: Date;
}

// Event Projections
export interface EventProjection {
  id: string;
  name: string;
  description?: string;
  eventTypes: string[];
  handler: ProjectionHandler;
  state: unknown;
  version: number;
  lastEventPosition: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectionHandler = (state: unknown, event: BaseEvent) => Promise<unknown>;

// Saga and Process Management
export interface EventSaga {
  id: string;
  name: string;
  description?: string;
  state: 'active' | 'completed' | 'failed' | 'cancelled';
  currentStep: string;
  data: unknown;
  steps: SagaStep[];
  compensations: SagaCompensation[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface SagaStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: unknown;
  output?: unknown;
  error?: Error;
  startedAt?: Date;
  completedAt?: Date;
}

export interface SagaCompensation {
  stepId: string;
  handler: CompensationHandler;
  executed: boolean;
  executedAt?: Date;
}

export type CompensationHandler = (sagaData: unknown, stepOutput: unknown) => Promise<void>;

// Type Guards and Utilities
export function isPluginLifecycleEvent(event: BaseEvent): event is PluginLifecycleEvent {
  return event.category === EventCategory.PLUGIN && Object.values(PluginLifecycleEventType).includes(event.type as PluginLifecycleEventType);
}

export function isSystemEvent(event: BaseEvent): event is SystemEvent {
  return event.category === EventCategory.SYSTEM;
}

export function isSecurityEvent(event: BaseEvent): event is SecurityEvent {
  return event.category === EventCategory.SECURITY;
}

export function isPerformanceEvent(event: BaseEvent): event is PerformanceEvent {
  return event.category === EventCategory.PERFORMANCE;
}

export function isBusinessEvent(event: BaseEvent): event is BusinessEvent {
  return event.category === EventCategory.BUSINESS;
}

export function isCustomEvent(event: BaseEvent): event is CustomEvent {
  return event.category === EventCategory.CUSTOM;
}

export function isHighPriorityEvent(event: BaseEvent): boolean {
  return event.priority === EventPriority.HIGH || event.priority === EventPriority.URGENT || event.priority === EventPriority.CRITICAL;
}
