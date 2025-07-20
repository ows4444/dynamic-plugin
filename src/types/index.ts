/**
 * Plugin System Types - Central Export Index
 *
 * This file provides organized, conflict-free exports of all types in the plugin system.
 * Types are grouped by domain and usage frequency for optimal developer experience.
 */

import type { BaseCompilationResult, InstallationResult, LoadResult, PluginStatus, ReloadResult, UnloadResult, UpdateResult } from './common.types';
import type { MonitoringConfiguration, PluginSystemConfiguration, SecurityConfiguration, SystemConfiguration } from './config.types';
import type { BaseEvent, BusinessEvent, PerformanceEvent, PluginLifecycleEvent, SecurityEvent, SystemEvent } from './events.types';
import type { InteropCustomEvent, InteropSystemEvent, Message, PluginEvent, PluginEventBus, RpcRequest, RpcResponse } from './interop.types';
// Metadata types will be exported separately below
import type { CompilationResult } from './plugin-development.types';
import type { PluginContext, PluginInstance, PluginMetadata } from './plugin.types';
import type { RuntimeCompilationResult } from './runtime.types';

// =============================================================================
// CORE FOUNDATION TYPES (Most Frequently Used)
// =============================================================================

export { PluginSeverity, HealthStatusType, PluginStatus } from './common.types';

export type {
  EnvironmentType,
  IsolationLevel,
  NetworkProtocol,
  ModuleState,
  BuildTarget,

  // Registry enums
  PluginRegistryScope,
  PluginRegistrySortBy,
  SortOrder,
  PluginLicense,

  // Base interfaces and result types
  BaseResult,
  TimestampedResult,
  VersionedResult,
  ValidationResult,
  CompatibilityResult,
  ExecutionResult,
  InstallationResult,
  LoadResult,
  UnloadResult,
  ReloadResult,
  UpdateResult,
  RecoveryResult,

  // Resource and health types
  ResourceLimits,
  ResourceUsage,
  HealthStatus,
  HealthDetails,
  DependencyHealth,
  BaseMetrics,

  // Core plugin metadata
  PluginDependency,
  PluginEngines,
  PluginHooks,
  PluginConfiguration,
  MetadataInfo,

  // Base compilation types
  BaseCompilationResult,
  BaseCompilationDiagnostic,
  BaseCompiledAsset,
  BaseCompilationCache,

  // Utility types
  DeepPartial,
  DeepRequired,
  WithOptional,
  WithRequired,
  Merge,
  Optional,
  Nullable,
  NonNullableProps,
  Mutable,
  DeepMutable,
  UnionToIntersection,
  RemoveIndexSignature,

  // Error types
  ErrorContext,
  BaseError,
  Activity,
  ActivityMetadata,
} from './common.types';

// Type guards from common types
export { isBaseResult, isPluginStatus, isHealthStatus, isPluginSeverity } from './common.types';

// =============================================================================
// CORE PLUGIN TYPES
// =============================================================================

export type {
  // Main plugin interfaces
  IPlugin,
  PluginContext,
  PluginMetadata,
  PluginManifest,
  PluginInstance,
  PluginPackage,
  PluginSource,
  PluginCredentials,

  // Plugin configuration
  BasePluginConfig,
  PluginConfig,
  TypedPluginConfig,
  SamplePluginConfig,

  // Plugin permissions and security
  PluginPermissions,

  // Plugin events and errors
  PluginEventType,
  PluginError,
  PluginErrorContext,
  PluginMetrics,

  // External service interfaces
  Logger,
  DatabaseConnection,
  CacheService,
} from './plugin.types';

// =============================================================================
// COMMUNICATION & INTEROPERABILITY
// =============================================================================

export { MessageType } from './interop.types';
export type {
  // Core message types

  MessagePriority,
  DeliveryMode,
  Message,
  MessageMetadata,
  MessageFilter,
  MessageHandler,
  MessageHandlerResult,
  MessageOptions,
  BroadcastOptions,

  // Plugin communication events
  PluginEvent,
  InteropSystemEvent,
  InteropLifecycleEvent,
  InteropCustomEvent,

  // RPC communication
  RpcRequest,
  RpcResponse,
  RpcError,
  RpcCall,
  RpcOptions,
  RpcMethodHandler,

  // Communication patterns
  RequestResponsePattern,
  PublishSubscribePattern,
  EventSourcingPattern,

  // Event bus and messaging
  PluginEventBus,
  EventBusMetrics,
  TopicMetrics,

  // Resource sharing
  SharedResource,
  ResourcePermissions,
  ResourceAccess,
  ResourceLease,
  ResourceFilter,

  // Plugin interoperability
  PluginInterop,

  // Channels and topics
  Channel,
  ChannelOptions,
  Topic,
  RetentionPolicy,
  CompressionType,

  // Transport and protocols
  TransportType,
  TransportConfig,
  TransportSecurity,
  ProtocolAdapter,
  ProtocolMetrics,
  LatencyMetrics,

  // Serialization
  SerializationType,
  Serializer,

  // Subscriptions and retry policies
  Subscription,
  SubscriptionOptions,
  RetryPolicy,
} from './interop.types';

// Type guards from interop
export { isMessage, isPluginEvent, isRpcRequest, isRpcResponse } from './interop.types';

// =============================================================================
// EVENT SYSTEM
// =============================================================================

export type {
  // Event categories and priorities
  EventCategory,
  EventPriority,
  EventStatus,

  // Base event system
  BaseEvent,
  EventMetadata,

  // Specific event types
  PluginLifecycleEvent,
  PluginLifecycleEventType,
  SystemEvent,
  SystemEventType,
  SecurityEvent,
  SecurityEventType,
  PerformanceEvent,
  PerformanceEventType,
  BusinessEvent,
  CustomEvent,
  PluginEventError,

  // Event handling
  EventHandler,
  EventHandlerResult,
  EventHandlerRegistration,
  EventHandlerOptions,
  EventFilter,
  RetryOptions,
  RateLimitOptions,

  // Event storage and queries
  EventStream,
  EventStore,
  EventQuery,
  EventQueryResult,
  EventAggregate,
  EventSnapshot,

  // System event bus
  SystemEventBus,
  EventMetrics,
  HandlerMetrics,

  // Activity and projections
  PluginActivity,
  EventProjection,
  ProjectionHandler,

  // Sagas and workflows
  EventSaga,
  SagaStep,
  SagaCompensation,
  CompensationHandler,
} from './events.types';

// Type guards from events
export { isPluginLifecycleEvent, isSystemEvent, isSecurityEvent as isEventSecurityEvent, isPerformanceEvent, isBusinessEvent, isCustomEvent, isHighPriorityEvent } from './events.types';

// =============================================================================
// SECURITY & AUTHORIZATION
// =============================================================================

export type {
  // Security resources and actions
  SecurityResourceType,
  SecurityAction,
  SecurityPermission,
  SecurityCondition,
  SecurityPolicy,
  SecurityRole,
  SecurityPrincipal,

  // Authentication
  AuthenticationToken,
  AuthenticationResult,
  AuthenticationProvider,

  // Authorization
  AuthorizationRequest,
  AuthorizationResult,

  // Rate limiting
  RateLimitRule,
  RateLimitViolation,
  RateLimitStatus,
  RateLimitOperation,
  PluginRateLimits,

  // Permissions (comprehensive definitions)
  NetworkRule,
  NetworkPermissions,
  FilesystemPermissions,
  SystemPermissions,
  DatabasePermissions,
  RuntimePermissions,

  // Security context and isolation
  SecurityContext,
  IsolationOptions,
  IsolationResult,

  // Activity and auditing
  SecurityActivity,
  ActivitySummary,
  PluginSecurityInfo,
  SecurityViolation,
  SecurityViolationEvent,
  SecurityReport,
  SecurityRecommendation,

  // Security configuration
  SecurityConfig,
  CryptoConfig,
  SignatureInfo,
  IntegrityCheck,
} from './security.types';

// Type guards from security
export { isSecurityEvent, isSecurityViolation, isAuthenticationResult, isAuthorizationResult } from './security.types';

// =============================================================================
// RUNTIME & EXECUTION
// =============================================================================

export type {
  // Module status (specific runtime version)
  ModuleStatus,

  // Runtime context and environment
  RuntimeContext,
  RuntimeEnvironment,
  RuntimeHooks,
  RuntimeDependency,

  // Plugin loading and modules
  PluginLoader,
  PluginModule,
  PluginModuleInstance,
  PluginModuleInstanceWithMethods,
  PluginExports,
  DynamicModule,
  DynamicModuleImport,
  PluginInstanceMethods,
  ModuleMetadata,

  // Runtime compilation (renamed to avoid conflicts)
  PluginCompiler,
  RuntimeCompilationResult,
  RuntimeCompilationDiagnostic,
  RuntimeCompiledAsset,
  RuntimeCompilationCache,

  // Sandboxing and isolation
  PluginSandbox,
  SandboxInstance,
  SandboxStatus,

  // Profiling and monitoring
  PluginProfiler,
  ProfileResult,
  MemoryProfile,
  MemoryLeak,
  CpuProfile,
  CpuSample,
  NetworkProfile,
  NetworkRequest,
  FilesystemProfile,
  FilesystemOperation,
} from './runtime.types';

// =============================================================================
// PLUGIN REGISTRY & CATALOG
// =============================================================================

export {} from './registry.types';
export type {
  // Core registry
  PluginRegistry,
  PluginRegistryEntry,
  PluginRegistryStatus,

  // Search and discovery
  PluginSearchQuery,
  PluginSearchResult,

  // Versioning
  PluginVersion,
  PluginVersionHistory,

  // Statistics and analytics
  PluginStats,
  PluginAnalytics,

  // Dependencies and conflicts
  PluginDependencyTree,
  PluginDependencyNode,
  PluginConflict,

  // Updates
  PluginUpdateInfo,
  PluginDependencyUpdate,

  // Backup and restore
  PluginBackup,
  PluginBackupMetadata,
  PluginRestoreOptions,

  // Reviews and collections
  PluginReview,
  PluginCollection,
} from './registry.types';

// =============================================================================
// PLUGIN STORE & MARKETPLACE
// =============================================================================

export type {
  // Store entries and queries
  PluginStoreEntry,
  PluginStoreQuery,
  PluginStoreResult,

  // Store configuration
  PluginStore,
  PluginStoreConfig,

  // Downloads and metadata
  PluginDownloadInfo,
  PluginStoreMetrics,
} from './plugin-store.types';

// =============================================================================
// DEVELOPMENT & TOOLING
// =============================================================================

export type {
  // Templates and scaffolding
  PluginTemplate,
  PluginScaffoldConfig,

  // Validation and testing
  PluginValidationResult,
  PluginTestResult,

  // Documentation
  PluginDocumentationConfig,

  // Development server
  PluginDevServer,

  // Development compilation (extended versions)
  PluginCompileRequest,
  CompilationOptions,
  CompilationResult,
  CompilationDiagnostic,
  CompiledAsset,
  PluginBuildConfig,
  CompilationCache,

  // Development metrics and tools
  PluginDevelopmentMetrics,
  PluginGenerator,
  GeneratorOptions,

  // CLI and workspace
  PluginCliCommand,
  PluginDevelopmentWorkspace,
  PluginDevelopmentPhase,
  PluginDevelopmentStatus,
} from './plugin-development.types';

// =============================================================================
// CONFIGURATION MANAGEMENT
// =============================================================================

export type {
  // Configuration basics
  ConfigurationScope,
  ConfigurationFormat,
  ConfigurationSource,
  ConfigurationValueType,
  ConfigurationEntry,
  ConfigurationValidation,

  // Schema and properties
  PluginConfigurationSchema,
  ConfigurationProperty,

  // System configuration
  SystemConfiguration,
  ServerConfiguration,
  CorsConfiguration,
  CompressionConfiguration,
  SslConfiguration,

  // Database configuration
  DatabaseConfiguration,
  DatabaseConnectionConfig,
  DatabasePoolConfiguration,
  MigrationConfiguration,
  DatabaseLoggingConfiguration,

  // Security configuration (renamed to avoid conflicts)
  SecurityConfiguration,
  RateLimitConfiguration,
  CsrfConfiguration,
  SecurityHeadersConfiguration,

  // Authentication and authorization config
  AuthProviderConfiguration,
  SessionConfiguration,
  JwtConfiguration,
  OAuthConfiguration,
  OAuthProviderConfig,

  // Monitoring configuration
  MonitoringConfiguration,
  MetricsConfiguration,
  TracingConfiguration,
  LoggingConfiguration,
  LogTransportConfiguration,
  LogRotationConfiguration,
  LogCorrelationConfiguration,
  HealthCheckConfiguration,
  HealthCheckDefinition,
  AlertConfiguration,
  AlertChannelConfiguration,
  AlertRuleConfiguration,

  // Plugin system configuration
  PluginSystemConfiguration,
  PluginRegistryConfiguration,
  PluginCacheConfiguration,
  PluginSyncConfiguration,
  PluginRuntimeConfiguration,
  CompilationConfiguration,
  PluginSecurityConfiguration,
  PluginSigningConfiguration,
  PluginVerificationConfiguration,
  PluginPermissionsConfiguration,
  PluginStoreConfiguration,
  PluginStoreConnectionConfig,
  PluginStoreCacheConfiguration,
  PluginDevelopmentConfiguration,
  DevServerConfiguration,
  TestingConfiguration,
  DebuggingConfiguration,

  // Performance configuration
  PerformanceConfiguration,
  CachingConfiguration,
  ClusteringConfiguration,
  OptimizationConfiguration,
  StaticAssetsConfiguration,

  // Rate limiting configurations
  GlobalRateLimitConfig,
  PerUserRateLimitConfig,
  PerIPRateLimitConfig,

  // Configuration management
  ConfigurationManager,
  EnvironmentConfiguration,
  ConfigurationValidationResult,
  ConfigurationValidationError,
  ConfigurationValidationWarning,
} from './config.types';

// Type guards from config
export { isConfigurationEntry, isSystemConfiguration, isPluginConfiguration } from './config.types';

// =============================================================================
// METADATA SYSTEM
// =============================================================================

export type {
  // Base metadata interfaces
  BaseMetadata,
  VersionedMetadata,
  TimestampedMetadata,
  AuthoredMetadata,

  // Domain-specific metadata
  ConfigurationMetadata as MetadataConfigurationMetadata,
  PluginMetadata as MetadataPluginMetadata,
  EventMetadata as MetadataEventMetadata,
  SecurityMetadata,
  ActivityMetadata as MetadataActivityMetadata,
  MessageMetadata as MetadataMessageMetadata,
  ResourceMetadata,
  StoreMetadata,
  CompilationMetadata,
  RegistryMetadata,
  RuntimeMetadata,
  DevelopmentMetadata,
  AnalyticsMetadata,
  MonitoringMetadata,
  BackupMetadata,
  AuditMetadata,
  TestMetadata,
  DocumentationMetadata,

  // Metadata utility types
  MetadataWithDefaults,
  OptionalMetadata,
  MetadataUpdate,
  MetadataValidation,
} from './metadata.types';

// Type guards from metadata
export { isBaseMetadata, isVersionedMetadata, isTimestampedMetadata, isAuthoredMetadata, isPluginMetadata, isEventMetadata, isSecurityMetadata } from './metadata.types';

// =============================================================================
// COMMONLY USED TYPE COMBINATIONS
// =============================================================================

// Plugin lifecycle combination
export interface PluginLifecycle {
  status: PluginStatus;
  metadata: PluginMetadata;
  context: PluginContext;
  instance?: PluginInstance;
}

// Plugin operation results union
export type PluginOperationResult = InstallationResult | LoadResult | UnloadResult | ReloadResult | UpdateResult;

// All event types union
export type AnyEvent = BaseEvent | PluginLifecycleEvent | SystemEvent | SecurityEvent | PerformanceEvent | BusinessEvent | CustomEvent;

// All configuration types union
export type AnyConfiguration = SystemConfiguration | PluginSystemConfiguration | SecurityConfiguration | MonitoringConfiguration;

// All message types union
export type AnyMessage = Message | PluginEvent | RpcRequest | RpcResponse;

// All compilation results union
export type AnyCompilationResult = BaseCompilationResult | CompilationResult | RuntimeCompilationResult;

// =============================================================================
// DEPRECATED ALIASES (For Backward Compatibility)
// =============================================================================

/** @deprecated Use PluginEventBus instead */
export type EventBus = PluginEventBus;

/** @deprecated Use InteropSystemEvent instead */
export type SystemEventDeprecated = InteropSystemEvent;

/** @deprecated Use InteropCustomEvent instead */
export type CustomEventDeprecated = InteropCustomEvent;
