/**
 * Security Types - Security-related types for authentication, authorization, and auditing
 */

import type { Activity, ActivityMetadata, IsolationLevel, NetworkProtocol, PluginSeverity, ResourceLimits, ResourceUsage } from './common.types';

// Security Resource and Action Types
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

// Permission and Access Control Types
export interface SecurityPermission {
  resource: SecurityResourceType;
  actions: SecurityAction[];
  conditions?: SecurityCondition[];
}

export interface SecurityCondition {
  type: 'time' | 'ip' | 'user' | 'role' | 'custom';
  value: unknown;
  operator: 'eq' | 'ne' | 'in' | 'not_in' | 'gt' | 'lt' | 'contains';
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  permissions: SecurityPermission[];
  priority: number;
  enabled: boolean;
  conditions?: SecurityCondition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityRole {
  id: string;
  name: string;
  description: string;
  permissions: SecurityPermission[];
  policies: string[];
  inherits?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityPrincipal {
  id: string;
  type: 'user' | 'plugin' | 'service' | 'system';
  name: string;
  roles: string[];
  permissions: SecurityPermission[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  lastActivity?: Date;
}

// Authentication Types
export interface AuthenticationToken {
  id: string;
  type: 'jwt' | 'api_key' | 'oauth' | 'custom';
  principalId: string;
  expiresAt?: Date;
  scope?: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AuthenticationResult {
  success: boolean;
  principal?: SecurityPrincipal;
  token?: AuthenticationToken;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthenticationProvider {
  id: string;
  name: string;
  type: 'jwt' | 'api_key' | 'oauth' | 'ldap' | 'custom';
  config: Record<string, unknown>;
  enabled: boolean;
  priority: number;
}

// Authorization Types
export interface AuthorizationRequest {
  principalId: string;
  resource: SecurityResourceType;
  action: SecurityAction;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AuthorizationResult {
  granted: boolean;
  reason?: string;
  conditions?: SecurityCondition[];
  metadata?: Record<string, unknown>;
}

// Rate Limiting Types
export type RateLimitOperation = Map<string, number>;
export type PluginRateLimits = Map<string, RateLimitOperation>;

export interface RateLimitRule {
  operation: string;
  limit: number;
  window: number; // in milliseconds
  burst?: number;
  skipSuccessful?: boolean;
}

export interface RateLimitViolation {
  pluginId: string;
  operation: string;
  currentCount: number;
  limit: number;
  timestamp: Date;
  windowStart: Date;
  windowEnd: Date;
}

export interface RateLimitStatus {
  operation: string;
  currentCount: number;
  limit: number;
  remaining: number;
  resetTime: Date;
}

// Network Security Types
export interface NetworkRule {
  protocol: NetworkProtocol;
  host?: string;
  port?: number | number[];
  path?: string;
  headers?: Record<string, string>;
  allowed: boolean;
}

export interface NetworkPermissions {
  outbound: NetworkRule[];
  inbound: NetworkRule[];
}

export interface FilesystemPermissions {
  read: string[];
  write: string[];
  execute: string[];
  delete: string[];
  allowSymlinks?: boolean;
  allowHidden?: boolean;
}

export interface SystemPermissions {
  processes: boolean;
  environment: boolean;
  filesystem: boolean;
  network: boolean;
  scheduling?: boolean;
  ipc?: boolean;
}

export interface DatabasePermissions {
  read: string[];
  write: string[];
  schema: string[];
  admin?: boolean;
}

export interface RuntimePermissions {
  filesystem: FilesystemPermissions;
  network: NetworkPermissions;
  system: SystemPermissions;
  database: DatabasePermissions;
  plugins: Record<string, string[]>;
}

// Security Context and Isolation Types
export interface SecurityContext {
  pluginId: string;
  principal: SecurityPrincipal;
  permissions: RuntimePermissions;
  isolation: IsolationLevel;
  resourceLimits: ResourceLimits;
  rateLimits: RateLimitRule[];
  policies: string[];
  sessionId?: string;
  createdAt: Date;
  lastValidated: Date;
}

export interface IsolationOptions {
  level?: IsolationLevel;
  resourceLimits?: Partial<ResourceLimits>;
  networkRestrictions?: NetworkRule[];
  filesystemRestrictions?: string[];
  allowedModules?: string[];
  deniedModules?: string[];
  timeout?: number;
  memoryLimit?: number;
  cpuLimit?: number;
  enableResourceMonitoring?: boolean;
}

export interface IsolationResult {
  success: boolean;
  pluginId?: string;
  sandboxId?: string;
  isolated: boolean;
  resourceUsage: ResourceUsage;
  violations: string[];
  error?: string;
}

// Audit and Activity Types
export interface SecurityActivity extends Activity {
  pluginId: string;
  principalId: string;
  action: SecurityAction;
  resource: SecurityResourceType;
  result: 'allowed' | 'denied' | 'error';
  risk: PluginSeverity;
  details?: {
    ip?: string;
    userAgent?: string;
    location?: string;
    method?: string;
    path?: string;
    statusCode?: number;
    responseSize?: number;
  };
}

export interface SecurityViolationEvent {
  id: string;
  type: 'authentication' | 'authorization' | 'rate_limit' | 'policy_violation' | 'intrusion_attempt';
  severity: PluginSeverity;
  pluginId?: string;
  principalId?: string;
  message: string;
  details: Record<string, unknown>;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface ActivitySummary {
  pluginId: string;
  action: string;
  timestamp: Date;
  metadata?: ActivityMetadata;
}

export interface PluginSecurityInfo {
  pluginId: string;
  permissions: RuntimePermissions;
  isolation: boolean;
  resourceLimits: ResourceLimits;
  rateLimits: RateLimitRule[];
  violations: SecurityViolation[];
  riskScore: number;
  lastAudit: Date;
}

export interface SecurityViolation {
  id: string;
  pluginId: string;
  type: 'permission_denied' | 'rate_limit_exceeded' | 'resource_limit_exceeded' | 'policy_violation';
  severity: PluginSeverity;
  description: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, unknown>;
}

export interface SecurityReport {
  timestamp: Date;
  timeframe: {
    start: Date;
    end: Date;
  };
  summary: {
    totalPlugins: number;
    totalActivities: number;
    securityEvents: number;
    violations: number;
    riskScore: number;
  };
  activities: ActivitySummary[];
  events: SecurityViolationEvent[];
  violations: SecurityViolation[];
  rateLimitViolations: RateLimitViolation[];
  plugins: PluginSecurityInfo[];
  recommendations: SecurityRecommendation[];
}

export interface SecurityRecommendation {
  id: string;
  type: 'policy' | 'permission' | 'isolation' | 'monitoring';
  severity: PluginSeverity;
  title: string;
  description: string;
  action: string;
  pluginId?: string;
  metadata?: Record<string, unknown>;
}

// Security Configuration Types
export interface SecurityConfig {
  authentication: {
    providers: AuthenticationProvider[];
    defaultProvider: string;
    tokenExpiry: number;
    allowMultipleSessions: boolean;
  };
  authorization: {
    defaultPolicy: string;
    strictMode: boolean;
    cachePermissions: boolean;
    cacheTtl: number;
  };
  rateLimiting: {
    enabled: boolean;
    global: RateLimitRule[];
    perPlugin: Record<string, RateLimitRule[]>;
  };
  isolation: {
    defaultLevel: IsolationLevel;
    resourceLimits: ResourceLimits;
    allowEscalation: boolean;
  };
  audit: {
    enabled: boolean;
    logLevel: 'minimal' | 'standard' | 'detailed';
    retentionDays: number;
    realTimeAlerts: boolean;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: Record<string, number>;
  };
}

// Cryptography and Signing Types
export interface CryptoConfig {
  algorithm: 'RSA' | 'ECDSA' | 'EdDSA';
  keySize: number;
  hashAlgorithm: 'SHA256' | 'SHA384' | 'SHA512';
  encoding: 'base64' | 'hex' | 'utf8';
}

export interface SignatureInfo {
  algorithm: string;
  keyId: string;
  signature: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface IntegrityCheck {
  checksum: string;
  algorithm: 'SHA256' | 'SHA512' | 'MD5';
  size: number;
  signature?: SignatureInfo;
}

// Type Guards
export function isSecurityEvent(obj: unknown): obj is SecurityViolationEvent {
  return typeof obj === 'object' && obj !== null && 'type' in obj && 'severity' in obj;
}

export function isSecurityViolation(obj: unknown): obj is SecurityViolation {
  return typeof obj === 'object' && obj !== null && 'type' in obj && 'pluginId' in obj;
}

export function isAuthenticationResult(obj: unknown): obj is AuthenticationResult {
  return typeof obj === 'object' && obj !== null && 'success' in obj;
}

export function isAuthorizationResult(obj: unknown): obj is AuthorizationResult {
  return typeof obj === 'object' && obj !== null && 'granted' in obj;
}
