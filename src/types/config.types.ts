/**
 * Configuration Types - Configuration management and schema types
 */

import type { EnvironmentType, IsolationLevel, NetworkProtocol, ResourceLimits } from './common.types';

// Base Configuration Types
export enum ConfigurationScope {
  GLOBAL = 'global',
  PLUGIN = 'plugin',
  USER = 'user',
  SESSION = 'session',
  REQUEST = 'request',
}

export enum ConfigurationFormat {
  JSON = 'json',
  YAML = 'yaml',
  TOML = 'toml',
  XML = 'xml',
  INI = 'ini',
  ENV = 'env',
}

export enum ConfigurationSource {
  FILE = 'file',
  ENVIRONMENT = 'environment',
  COMMAND_LINE = 'command_line',
  DATABASE = 'database',
  REMOTE = 'remote',
  VAULT = 'vault',
  CONSUL = 'consul',
  ETCD = 'etcd',
}

export interface ConfigurationMetadata {
  source: ConfigurationSource;
  format: ConfigurationFormat;
  scope: ConfigurationScope;
  priority: number;
  readonly: boolean;
  encrypted: boolean;
  sensitive: boolean;
  version: string;
  lastModified: Date;
  modifiedBy?: string;
  description?: string;
  tags?: string[];
}

export interface ConfigurationEntry {
  key: string;
  value: unknown;
  type: ConfigurationValueType;
  metadata: ConfigurationMetadata;
  validation?: ConfigurationValidation;
  dependencies?: string[];
  defaultValue?: unknown;
}

export enum ConfigurationValueType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  NULL = 'null',
  UNDEFINED = 'undefined',
}

export interface ConfigurationValidation {
  required?: boolean;
  type?: ConfigurationValueType;
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  enum?: unknown[];
  custom?: (value: unknown) => boolean | string;
}

// Plugin Configuration Schema
export interface PluginConfigurationSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type: 'object';
  properties: Record<string, ConfigurationProperty>;
  required?: string[];
  additionalProperties?: boolean;
  default?: Record<string, unknown>;
  examples?: Array<Record<string, unknown>>;
}

export interface ConfigurationProperty {
  type: ConfigurationValueType | ConfigurationValueType[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  items?: ConfigurationProperty;
  properties?: Record<string, ConfigurationProperty>;
  required?: string[];
  additionalProperties?: boolean;
  examples?: unknown[];
  const?: unknown;
  allOf?: ConfigurationProperty[];
  anyOf?: ConfigurationProperty[];
  oneOf?: ConfigurationProperty[];
  not?: ConfigurationProperty;
  if?: ConfigurationProperty;
  then?: ConfigurationProperty;
  else?: ConfigurationProperty;
}

// System Configuration
export interface SystemConfiguration {
  server: ServerConfiguration;
  database: DatabaseConfiguration;
  security: SecurityConfiguration;
  monitoring: MonitoringConfiguration;
  logging: LoggingConfiguration;
  plugins: PluginSystemConfiguration;
  performance: PerformanceConfiguration;
}

export interface ServerConfiguration {
  host: string;
  port: number;
  protocol: NetworkProtocol;
  cors: CorsConfiguration;
  compression: CompressionConfiguration;
  timeout: {
    request: number;
    keepAlive: number;
    header: number;
  };
  limits: {
    maxConnections: number;
    maxRequestSize: number;
    maxResponseSize: number;
  };
  ssl?: SslConfiguration;
}

export interface CorsConfiguration {
  enabled: boolean;
  origin: string | string[] | boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

export interface CompressionConfiguration {
  enabled: boolean;
  algorithm: 'gzip' | 'deflate' | 'br';
  level: number;
  threshold: number;
  mimeTypes: string[];
}

export interface SslConfiguration {
  enabled: boolean;
  cert: string;
  key: string;
  ca?: string;
  passphrase?: string;
  dhparam?: string;
  protocols: string[];
  ciphers: string[];
  honorCipherOrder: boolean;
  requestCert: boolean;
  rejectUnauthorized: boolean;
}

export interface DatabaseConfiguration {
  connections: Record<string, DatabaseConnectionConfig>;
  pool: DatabasePoolConfiguration;
  migrations: MigrationConfiguration;
  logging: DatabaseLoggingConfiguration;
}

export interface DatabaseConnectionConfig {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'sqlite';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  options?: Record<string, unknown>;
}

export interface DatabasePoolConfiguration {
  min: number;
  max: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
}

export interface MigrationConfiguration {
  directory: string;
  tableName: string;
  extension: string;
  loadExtensions: string[];
  disableTransactions: boolean;
}

export interface DatabaseLoggingConfiguration {
  enabled: boolean;
  level: 'query' | 'schema' | 'error' | 'warn' | 'info' | 'log';
  logQueries: boolean;
  logSlowQueries: boolean;
  slowQueryThreshold: number;
}

export interface SecurityConfiguration {
  authentication: AuthenticationConfiguration;
  authorization: AuthorizationConfiguration;
  encryption: EncryptionConfiguration;
  rateLimit: RateLimitConfiguration;
  cors: CorsConfiguration;
  csrf: CsrfConfiguration;
  headers: SecurityHeadersConfiguration;
}

export interface AuthenticationConfiguration {
  enabled: boolean;
  providers: AuthProviderConfiguration[];
  session: SessionConfiguration;
  jwt: JwtConfiguration;
  oauth: OAuthConfiguration;
}

export interface AuthProviderConfiguration {
  id: string;
  type: 'local' | 'ldap' | 'oauth' | 'saml' | 'custom';
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
}

export interface SessionConfiguration {
  secret: string;
  name: string;
  cookie: {
    maxAge: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    domain?: string;
    path: string;
  };
  store: 'memory' | 'redis' | 'database';
  storeConfig?: Record<string, unknown>;
}

export interface JwtConfiguration {
  secret: string;
  expiresIn: string;
  refreshTokenExpiresIn: string;
  algorithm: string;
  issuer: string;
  audience: string;
  subject: string;
}

export interface OAuthConfiguration {
  providers: Record<string, OAuthProviderConfig>;
}

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  scope: string[];
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  callbackUrl: string;
}

export interface AuthorizationConfiguration {
  enabled: boolean;
  defaultPolicy: string;
  policies: PolicyConfiguration[];
  rbac: RbacConfiguration;
  abac: AbacConfiguration;
}

export interface PolicyConfiguration {
  id: string;
  name: string;
  rules: PolicyRule[];
  effect: 'allow' | 'deny';
  priority: number;
}

export interface PolicyRule {
  resource: string;
  action: string;
  condition?: string;
  attributes?: Record<string, unknown>;
}

export interface RbacConfiguration {
  enabled: boolean;
  roles: RoleConfiguration[];
  permissions: PermissionConfiguration[];
}

export interface RoleConfiguration {
  id: string;
  name: string;
  permissions: string[];
  inherits?: string[];
}

export interface PermissionConfiguration {
  id: string;
  name: string;
  resource: string;
  action: string;
}

export interface AbacConfiguration {
  enabled: boolean;
  attributes: AttributeConfiguration[];
  policies: AbacPolicyConfiguration[];
}

export interface AttributeConfiguration {
  id: string;
  name: string;
  type: string;
  source: string;
  required: boolean;
}

export interface AbacPolicyConfiguration {
  id: string;
  name: string;
  rules: string;
  effect: 'permit' | 'deny';
}

export interface EncryptionConfiguration {
  algorithm: string;
  keySize: number;
  saltRounds: number;
  keys: EncryptionKeyConfiguration[];
  rotation: KeyRotationConfiguration;
}

export interface EncryptionKeyConfiguration {
  id: string;
  algorithm: string;
  key: string;
  active: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface KeyRotationConfiguration {
  enabled: boolean;
  interval: number;
  keyRetention: number;
  autoRotate: boolean;
}

export interface RateLimitConfiguration {
  enabled: boolean;
  global: GlobalRateLimitConfig;
  perUser: PerUserRateLimitConfig;
  perIP: PerIPRateLimitConfig;
  storage: 'memory' | 'redis';
  storageConfig?: Record<string, unknown>;
}

export interface GlobalRateLimitConfig {
  requests: number;
  window: number;
  burst?: number;
}

export interface PerUserRateLimitConfig {
  requests: number;
  window: number;
  burst?: number;
}

export interface PerIPRateLimitConfig {
  requests: number;
  window: number;
  burst?: number;
  whitelist?: string[];
  blacklist?: string[];
}

export interface CsrfConfiguration {
  enabled: boolean;
  secret: string;
  cookie: {
    name: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
}

export interface SecurityHeadersConfiguration {
  contentSecurityPolicy: string;
  strictTransportSecurity: string;
  xFrameOptions: string;
  xContentTypeOptions: boolean;
  xXssProtection: string;
  referrerPolicy: string;
}

export interface MonitoringConfiguration {
  enabled: boolean;
  metrics: MetricsConfiguration;
  tracing: TracingConfiguration;
  logging: LoggingConfiguration;
  health: HealthCheckConfiguration;
  alerts: AlertConfiguration;
}

export interface MetricsConfiguration {
  enabled: boolean;
  provider: 'prometheus' | 'statsd' | 'datadog' | 'custom';
  endpoint: string;
  interval: number;
  labels: Record<string, string>;
  buckets: number[];
}

export interface TracingConfiguration {
  enabled: boolean;
  provider: 'jaeger' | 'zipkin' | 'datadog' | 'custom';
  endpoint: string;
  samplingRate: number;
  serviceName: string;
  version: string;
}

export interface LoggingConfiguration {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text' | 'structured';
  transports: LogTransportConfiguration[];
  rotation: LogRotationConfiguration;
  correlation: LogCorrelationConfiguration;
}

export interface LogTransportConfiguration {
  type: 'console' | 'file' | 'http' | 'database' | 'elasticsearch';
  level: string;
  config: Record<string, unknown>;
}

export interface LogRotationConfiguration {
  enabled: boolean;
  maxFiles: number;
  maxSize: string;
  datePattern: string;
}

export interface LogCorrelationConfiguration {
  enabled: boolean;
  headerName: string;
  generateId: boolean;
}

export interface HealthCheckConfiguration {
  enabled: boolean;
  endpoint: string;
  interval: number;
  timeout: number;
  checks: HealthCheckDefinition[];
}

export interface HealthCheckDefinition {
  name: string;
  type: 'database' | 'redis' | 'http' | 'custom';
  config: Record<string, unknown>;
  timeout: number;
  retries: number;
}

export interface AlertConfiguration {
  enabled: boolean;
  channels: AlertChannelConfiguration[];
  rules: AlertRuleConfiguration[];
}

export interface AlertChannelConfiguration {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'sms';
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface AlertRuleConfiguration {
  id: string;
  name: string;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: string[];
  cooldown: number;
}

export interface PluginSystemConfiguration {
  enabled: boolean;
  directory: string;
  registry: PluginRegistryConfiguration;
  runtime: PluginRuntimeConfiguration;
  security: PluginSecurityConfiguration;
  store: PluginStoreConfiguration;
  development: PluginDevelopmentConfiguration;
}

export interface PluginRegistryConfiguration {
  local: boolean;
  remote: string[];
  cache: PluginCacheConfiguration;
  sync: PluginSyncConfiguration;
}

export interface PluginCacheConfiguration {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  storage: 'memory' | 'file' | 'redis';
}

export interface PluginSyncConfiguration {
  enabled: boolean;
  interval: number;
  retries: number;
  timeout: number;
}

export interface PluginRuntimeConfiguration {
  isolation: IsolationLevel;
  sandbox: SandboxConfiguration;
  resources: ResourceLimits;
  compilation: CompilationConfiguration;
  hotReload: boolean;
}

export interface SandboxConfiguration {
  enabled: boolean;
  type: 'vm' | 'worker' | 'container';
  timeout: number;
  memoryLimit: number;
  cpuLimit: number;
}

export interface CompilationConfiguration {
  enabled: boolean;
  cache: boolean;
  target: string;
  sourceMaps: boolean;
  minify: boolean;
  externals: string[];
}

export interface PluginSecurityConfiguration {
  signing: PluginSigningConfiguration;
  verification: PluginVerificationConfiguration;
  permissions: PluginPermissionsConfiguration;
}

export interface PluginSigningConfiguration {
  enabled: boolean;
  algorithm: string;
  keyFile: string;
  required: boolean;
}

export interface PluginVerificationConfiguration {
  enabled: boolean;
  trustedSources: string[];
  allowUnsigned: boolean;
  checkIntegrity: boolean;
}

export interface PluginPermissionsConfiguration {
  strict: boolean;
  defaultDeny: boolean;
  inheritance: boolean;
}

export interface PluginStoreConfiguration {
  enabled: boolean;
  stores: PluginStoreConnectionConfig[];
  defaultStore: string;
  cache: PluginStoreCacheConfiguration;
}

export interface PluginStoreConnectionConfig {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  trusted: boolean;
  priority: number;
}

export interface PluginStoreCacheConfiguration {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  refreshInterval: number;
}

export interface PluginDevelopmentConfiguration {
  enabled: boolean;
  hotReload: boolean;
  devServer: DevServerConfiguration;
  testing: TestingConfiguration;
  debugging: DebuggingConfiguration;
}

export interface DevServerConfiguration {
  enabled: boolean;
  port: number;
  watch: boolean;
  livereload: boolean;
}

export interface TestingConfiguration {
  framework: string;
  coverage: boolean;
  threshold: number;
  reports: string[];
}

export interface DebuggingConfiguration {
  enabled: boolean;
  port: number;
  sourceMaps: boolean;
  breakOnStart: boolean;
}

export interface PerformanceConfiguration {
  caching: CachingConfiguration;
  compression: CompressionConfiguration;
  clustering: ClusteringConfiguration;
  optimization: OptimizationConfiguration;
}

export interface CachingConfiguration {
  enabled: boolean;
  provider: 'memory' | 'redis' | 'memcached';
  ttl: number;
  maxSize: number;
  compression: boolean;
}

export interface ClusteringConfiguration {
  enabled: boolean;
  workers: number;
  mode: 'fork' | 'cluster';
  loadBalancer: 'round-robin' | 'least-connections' | 'ip-hash';
}

export interface OptimizationConfiguration {
  gzip: boolean;
  etag: boolean;
  lastModified: boolean;
  staticAssets: StaticAssetsConfiguration;
}

export interface StaticAssetsConfiguration {
  enabled: boolean;
  path: string;
  maxAge: number;
  index: string[];
  dotfiles: 'allow' | 'deny' | 'ignore';
}

// Configuration Management Interface
export interface ConfigurationManager {
  get<T = unknown>(key: string, defaultValue?: T): T;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  keys(): string[];
  values(): unknown[];
  entries(): Array<[string, unknown]>;
  getMetadata(key: string): ConfigurationMetadata | undefined;
  validate(key: string, value: unknown): boolean;
  reload(): Promise<void>;
  watch(key: string, callback: (value: unknown, oldValue: unknown) => void): () => void;
}

// Environment-specific Configuration
export interface EnvironmentConfiguration {
  environment: EnvironmentType;
  debug: boolean;
  version: string;
  build: string;
  features: Record<string, boolean>;
  overrides: Record<string, unknown>;
}

// Configuration Validation
export interface ConfigurationValidationResult {
  valid: boolean;
  errors: ConfigurationValidationError[];
  warnings: ConfigurationValidationWarning[];
}

export interface ConfigurationValidationError {
  key: string;
  message: string;
  value: unknown;
  expectedType?: string;
  constraint?: string;
}

export interface ConfigurationValidationWarning {
  key: string;
  message: string;
  value: unknown;
  suggestion?: string;
}

// Type Guards
export function isConfigurationEntry(obj: unknown): obj is ConfigurationEntry {
  return typeof obj === 'object' && obj !== null && 'key' in obj && 'value' in obj;
}

export function isSystemConfiguration(obj: unknown): obj is SystemConfiguration {
  return typeof obj === 'object' && obj !== null && 'server' in obj && 'database' in obj;
}

export function isPluginConfiguration(obj: unknown): obj is PluginSystemConfiguration {
  return typeof obj === 'object' && obj !== null && 'enabled' in obj && 'directory' in obj;
}
