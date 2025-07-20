/**
 * Metadata Types - Comprehensive metadata interfaces for the plugin system
 */

// Base Metadata Interfaces
export interface BaseMetadata {
  version?: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  tags?: string[];
  description?: string;
  [key: string]: unknown;
}

export interface VersionedMetadata extends BaseMetadata {
  version: string;
  previousVersion?: string;
  versionChanges?: string[];
}

export interface TimestampedMetadata extends BaseMetadata {
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
}

export interface AuthoredMetadata extends BaseMetadata {
  createdBy?: string;
  updatedBy?: string;
  author?: string;
  maintainers?: string[];
}

// Configuration Metadata
export interface ConfigurationMetadata extends BaseMetadata {
  source: 'file' | 'environment' | 'database' | 'remote' | 'default';
  format: 'json' | 'yaml' | 'toml' | 'xml' | 'ini' | 'env';
  scope: 'global' | 'plugin' | 'user' | 'session' | 'request';
  priority: number;
  readonly: boolean;
  encrypted: boolean;
  sensitive: boolean;
  schema?: string;
  validation?: {
    required?: boolean;
    type?: string;
    pattern?: string;
    min?: number;
    max?: number;
  };
}

// Plugin Metadata
export interface PluginMetadata extends BaseMetadata {
  pluginId: string;
  version: string;
  category: string;
  keywords?: string[];
  homepage?: string;
  repository?: string;
  bugs?: string;
  license: string;
  engines?: {
    node?: string;
    nestjs?: string;
  };
  capabilities: string[];
  permissions: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  size?: number;
  downloadCount?: number;
  rating?: number;
  verified?: boolean;
  featured?: boolean;
  deprecated?: boolean;
  createdBy?: string;
  updatedBy?: string;
  author?: string;
  maintainers?: string[];
  previousVersion?: string;
  versionChanges?: string[];
  security?: {
    signed: boolean;
    verified: boolean;
    checksum?: string;
    signature?: string;
  };
}

// Event Metadata
export interface EventMetadata extends BaseMetadata {
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  retryCount?: number;
  maxRetries?: number;
  ttl?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
  encrypted?: boolean;
  compressed?: boolean;
  deliveryMode?: 'fire_and_forget' | 'at_least_once' | 'exactly_once';
  schema?: string;
  contentType?: string;
  encoding?: string;
}

// Security Metadata
export interface SecurityMetadata extends BaseMetadata {
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  author?: string;
  maintainers?: string[];
  principalId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  riskScore?: number;
  threatLevel?: 'low' | 'medium' | 'high' | 'critical';
  classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  auditRequired?: boolean;
  compliance?: string[];
  policies?: string[];
  certificates?: string[];
  permissions?: string[];
}

// Activity Metadata
export interface ActivityMetadata extends BaseMetadata {
  duration?: number;
  result?: 'success' | 'failure' | 'partial' | 'timeout' | 'cancelled';
  operation?: string;
  resource?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  parameters?: Record<string, unknown>;
  returnValue?: unknown;
  errorCode?: string;
  errorMessage?: string;
  retryAttempt?: number;
  resourcesUsed?: {
    memory?: number;
    cpu?: number;
    network?: number;
    disk?: number;
    time?: number;
  };
  performance?: {
    latency?: number;
    throughput?: number;
    errorRate?: number;
  };
}

// Message Metadata
export interface MessageMetadata extends EventMetadata {
  messageId?: string;
  replyTo?: string;
  messageType?: 'request' | 'response' | 'event' | 'broadcast' | 'notification';
  topic?: string;
  partition?: number;
  offset?: number;
  timestamp?: Date;
  expiresAt?: Date;
  headers?: Record<string, string>;
}

// Resource Metadata
export interface ResourceMetadata extends BaseMetadata {
  resourceId: string;
  resourceType: string;
  name: string;
  version: string;
  size?: number;
  checksum?: string;
  mimeType?: string;
  encoding?: string;
  createdBy?: string;
  updatedBy?: string;
  author?: string;
  maintainers?: string[];
  previousVersion?: string;
  versionChanges?: string[];
  permissions?: {
    read: string[];
    write: string[];
    delete: string[];
    share: string[];
  };
  access?: {
    public: boolean;
    restricted: boolean;
    requiresAuth: boolean;
  };
  lifecycle?: {
    ttl?: number;
    renewable?: boolean;
    autoCleanup?: boolean;
  };
}

// Store Metadata
export interface StoreMetadata extends BaseMetadata {
  storeId: string;
  storeName: string;
  version: string;
  priority: number;
  trusted: boolean;
  verified: boolean;
  region?: string;
  mirrors?: string[];
  previousVersion?: string;
  versionChanges?: string[];
  statistics?: {
    pluginCount: number;
    downloadCount: number;
    averageRating: number;
    lastSync: Date;
  };
  health?: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    latency: number;
    errorRate: number;
  };
}

// Compilation Metadata
export interface CompilationMetadata extends TimestampedMetadata {
  sourceHash: string;
  targetPlatform?: string;
  compilerVersion: string;
  options: Record<string, unknown>;
  environment: {
    nodeVersion: string;
    platform: string;
    architecture: string;
  };
  optimization?: {
    minified: boolean;
    compressed: boolean;
    treeShaken: boolean;
  };
  sourceMaps?: boolean;
  warnings?: string[];
  performance?: {
    compilationTime: number;
    bundleSize: number;
    chunkCount: number;
  };
}

// Registry Metadata
export interface RegistryMetadata extends BaseMetadata {
  registryId: string;
  version: string;
  scope: 'public' | 'private' | 'organization' | 'local';
  visibility: 'public' | 'internal' | 'private';
  createdBy?: string;
  updatedBy?: string;
  author?: string;
  maintainers?: string[];
  previousVersion?: string;
  versionChanges?: string[];
  statistics?: {
    totalPlugins: number;
    totalDownloads: number;
    averageRating: number;
    categories: string[];
  };
  indexing?: {
    lastIndexed: Date;
    indexSize: number;
    searchable: boolean;
  };
  mirroring?: {
    mirrors: string[];
    syncFrequency: number;
    lastSync: Date;
  };
}

// Runtime Metadata
export interface RuntimeMetadata extends TimestampedMetadata {
  runtimeId: string;
  environment: 'development' | 'staging' | 'production' | 'test';
  platform: string;
  architecture: string;
  nodeVersion: string;
  nestjsVersion: string;
  isolation: 'none' | 'basic' | 'enhanced' | 'strict';
  sandbox?: {
    enabled: boolean;
    type: 'vm' | 'worker' | 'container';
    restrictions: string[];
  };
  resources?: {
    memory: number;
    cpu: number;
    network: number;
    disk: number;
  };
  monitoring?: {
    metricsEnabled: boolean;
    tracingEnabled: boolean;
    profilingEnabled: boolean;
  };
}

// Development Metadata
export interface DevelopmentMetadata extends BaseMetadata {
  projectName: string;
  template: string;
  framework: string;
  language: 'typescript' | 'javascript';
  features: string[];
  version: string;
  createdBy?: string;
  updatedBy?: string;
  author?: string;
  maintainers?: string[];
  previousVersion?: string;
  versionChanges?: string[];
  toolchain?: {
    bundler?: string;
    compiler?: string;
    linter?: string;
    formatter?: string;
    testing?: string;
  };
  scripts?: Record<string, string>;
  dependencies?: {
    production: Record<string, string>;
    development: Record<string, string>;
    peer: Record<string, string>;
  };
  build?: {
    target: string;
    sourceMaps: boolean;
    minified: boolean;
    outputPath: string;
  };
}

// Analytics Metadata
export interface AnalyticsMetadata extends TimestampedMetadata {
  metricType: 'performance' | 'usage' | 'error' | 'business' | 'security';
  aggregation: 'sum' | 'average' | 'count' | 'min' | 'max' | 'percentile';
  dimensions: Record<string, string>;
  filters: Record<string, unknown>;
  timeRange: {
    start: Date;
    end: Date;
    granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
  };
  sampling?: {
    rate: number;
    method: 'random' | 'systematic' | 'stratified';
  };
}

// Monitoring Metadata
export interface MonitoringMetadata extends TimestampedMetadata {
  source: string;
  component: string;
  environment: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  category: 'system' | 'plugin' | 'security' | 'performance' | 'business';
  alerts?: {
    enabled: boolean;
    threshold: number;
    channels: string[];
  };
  retention?: {
    period: number;
    archival: boolean;
    compression: boolean;
  };
}

// Backup Metadata
export interface BackupMetadata extends BaseMetadata {
  backupId: string;
  backupType: 'full' | 'incremental' | 'differential';
  compressionFormat: 'gzip' | 'zip' | 'tar' | 'none';
  encryptionEnabled: boolean;
  originalSize: number;
  compressedSize: number;
  backupPath: string;
  includedFiles: string[];
  excludedFiles: string[];
  reason: 'manual' | 'scheduled' | 'pre-update' | 'pre-uninstall';
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  author?: string;
  maintainers?: string[];
  retention?: {
    period: number;
    autoDelete: boolean;
  };
  verification?: {
    checksumVerified: boolean;
    integrityVerified: boolean;
    restoreTestPassed: boolean;
  };
}

// Audit Metadata
export interface AuditMetadata extends BaseMetadata {
  auditId: string;
  eventType: 'access' | 'modification' | 'deletion' | 'creation' | 'execution';
  resource: string;
  action: string;
  result: 'success' | 'failure' | 'partial';
  risk: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  author?: string;
  maintainers?: string[];
  compliance?: {
    frameworks: string[];
    requirements: string[];
    controls: string[];
  };
  evidence?: {
    logs: string[];
    screenshots: string[];
    recordings: string[];
    documents: string[];
  };
}

// Test Metadata
export interface TestMetadata extends TimestampedMetadata {
  testSuite: string;
  testType: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  framework: string;
  environment: string;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  results?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  artifacts?: {
    reports: string[];
    screenshots: string[];
    videos: string[];
    logs: string[];
  };
}

// Documentation Metadata
export interface DocumentationMetadata extends BaseMetadata {
  documentType: 'readme' | 'api' | 'guide' | 'tutorial' | 'reference' | 'changelog';
  format: 'markdown' | 'html' | 'pdf' | 'json' | 'yaml';
  language: string;
  audience: 'developer' | 'user' | 'admin' | 'public';
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived';
  version: string;
  createdBy?: string;
  updatedBy?: string;
  author?: string;
  maintainers?: string[];
  previousVersion?: string;
  versionChanges?: string[];
  sections?: string[];
  references?: string[];
  examples?: string[];
  images?: string[];
  lastReview?: Date;
  reviewers?: string[];
}

// Utility Types for Metadata
export type MetadataWithDefaults<T extends BaseMetadata> = T & Required<Pick<BaseMetadata, 'version' | 'createdAt' | 'updatedAt'>>;

export type OptionalMetadata<T extends BaseMetadata> = Partial<T>;

export type MetadataUpdate<T extends BaseMetadata> = Partial<Omit<T, 'createdAt' | 'createdBy'>> & {
  updatedAt: Date;
  updatedBy?: string;
};

// Metadata Validation
export interface MetadataValidation {
  required: string[];
  optional: string[];
  readonly: string[];
  format: Record<string, string>;
  constraints: Record<
    string,
    {
      min?: number;
      max?: number;
      pattern?: string;
      enum?: unknown[];
    }
  >;
}

// Type Guards
export function isBaseMetadata(obj: unknown): obj is BaseMetadata {
  return typeof obj === 'object' && obj !== null;
}

export function isVersionedMetadata(obj: unknown): obj is VersionedMetadata {
  return isBaseMetadata(obj) && 'version' in obj && typeof obj.version === 'string';
}

export function isTimestampedMetadata(obj: unknown): obj is TimestampedMetadata {
  return isBaseMetadata(obj) && 'createdAt' in obj && 'updatedAt' in obj;
}

export function isAuthoredMetadata(obj: unknown): obj is AuthoredMetadata {
  return isBaseMetadata(obj) && 'createdBy' in obj;
}

export function isPluginMetadata(obj: unknown): obj is PluginMetadata {
  return isVersionedMetadata(obj) && 'pluginId' in obj && 'category' in obj;
}

export function isEventMetadata(obj: unknown): obj is EventMetadata {
  return isBaseMetadata(obj) && ('correlationId' in obj || 'traceId' in obj || 'sessionId' in obj);
}

export function isSecurityMetadata(obj: unknown): obj is SecurityMetadata {
  return isTimestampedMetadata(obj) && ('principalId' in obj || 'riskScore' in obj || 'threatLevel' in obj);
}
