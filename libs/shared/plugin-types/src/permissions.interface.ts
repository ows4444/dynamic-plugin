export interface IPermissionSystem {
  checkPermission(
    pluginId: string,
    permission: string,
    context?: PermissionContext,
  ): Promise<PermissionResult>;
  checkPermissions(
    pluginId: string,
    permissions: string[],
    context?: PermissionContext,
  ): Promise<PermissionResult[]>;
  grantPermission(
    pluginId: string,
    permission: string,
    context?: PermissionContext,
  ): Promise<void>;
  revokePermission(
    pluginId: string,
    permission: string,
    context?: PermissionContext,
  ): Promise<void>;
  getPermissions(pluginId: string): Promise<PluginPermissions>;
  hasPermission(
    pluginId: string,
    permission: string,
    context?: PermissionContext,
  ): Promise<boolean>;
  createRole(role: PermissionRole): Promise<void>;
  deleteRole(roleId: string): Promise<void>;
  assignRole(pluginId: string, roleId: string): Promise<void>;
  unassignRole(pluginId: string, roleId: string): Promise<void>;
  getRoles(pluginId?: string): Promise<PermissionRole[]>;
  createPolicy(policy: PermissionPolicy): Promise<void>;
  deletePolicy(policyId: string): Promise<void>;
  evaluatePolicy(
    pluginId: string,
    action: string,
    resource: string,
    context?: PermissionContext,
  ): Promise<PolicyResult>;
  getAuditLog(
    pluginId?: string,
    limit?: number,
  ): Promise<PermissionAuditEntry[]>;
}

export interface PermissionResult {
  granted: boolean;
  permission: string;
  reason?: string;
  context?: PermissionContext;
  policy?: string;
  timestamp: Date;
  conditions?: PermissionCondition[];
}

export interface PermissionContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  environment?: string;
  tenant?: string;
  requestId?: string;
  resource?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface PluginPermissions {
  pluginId: string;
  permissions: string[];
  roles: string[];
  policies: string[];
  restrictions: PermissionRestriction[];
  lastUpdated: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface PermissionRole {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  inherits?: string[];
  conditions?: PermissionCondition[];
  restrictions?: PermissionRestriction[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface PermissionPolicy {
  id: string;
  name: string;
  description?: string;
  version: string;
  effect: 'allow' | 'deny';
  principals: PolicyPrincipal[];
  actions: string[];
  resources: string[];
  conditions?: PermissionCondition[];
  priority?: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface PolicyPrincipal {
  type: 'plugin' | 'user' | 'role' | 'group' | 'service';
  id: string;
  properties?: Record<string, any>;
}

export interface PolicyResult {
  effect: 'allow' | 'deny' | 'indeterminate';
  policy?: string;
  reason?: string;
  conditions?: PermissionCondition[];
  obligations?: PolicyObligation[];
  advice?: PolicyAdvice[];
}

export interface PolicyObligation {
  id: string;
  type: string;
  parameters: Record<string, any>;
  fulfilled: boolean;
}

export interface PolicyAdvice {
  id: string;
  type: string;
  message: string;
  parameters?: Record<string, any>;
}

export interface PermissionCondition {
  type: 'time' | 'ip' | 'environment' | 'resource' | 'attribute' | 'custom';
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'greater_than'
    | 'less_than'
    | 'between'
    | 'in'
    | 'not_in'
    | 'exists'
    | 'not_exists'
    | 'matches'
    | 'not_matches';
  key: string;
  value?: any;
  values?: any[];
  handler?: string;
  metadata?: Record<string, any>;
}

export interface PermissionRestriction {
  type:
    | 'rate_limit'
    | 'time_window'
    | 'resource_quota'
    | 'ip_whitelist'
    | 'ip_blacklist'
    | 'custom';
  parameters: Record<string, any>;
  enabled: boolean;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface PermissionAuditEntry {
  id: string;
  pluginId: string;
  userId?: string;
  action: string;
  resource?: string;
  permission: string;
  result: 'granted' | 'denied';
  reason?: string;
  context?: PermissionContext;
  timestamp: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ISecurityManager {
  validatePlugin(
    pluginId: string,
    manifest: any,
  ): Promise<SecurityValidationResult>;
  createSecurityContext(pluginId: string): Promise<SecurityContext>;
  destroySecurityContext(pluginId: string): Promise<void>;
  getSecurityContext(pluginId: string): Promise<SecurityContext | null>;
  scanForVulnerabilities(pluginId: string): Promise<VulnerabilityReport>;
  enforceSecurityPolicy(
    pluginId: string,
    action: string,
    resource: string,
  ): Promise<SecurityEnforcementResult>;
  getSecurityMetrics(pluginId?: string): Promise<SecurityMetrics>;
  reportSecurityIncident(incident: SecurityIncident): Promise<void>;
  getSecurityIncidents(
    pluginId?: string,
    limit?: number,
  ): Promise<SecurityIncident[]>;
}

export interface SecurityValidationResult {
  valid: boolean;
  securityLevel: string;
  vulnerabilities: SecurityVulnerability[];
  warnings: SecurityWarning[];
  recommendations: SecurityRecommendation[];
  score: number;
  maxScore: number;
  details?: Record<string, any>;
}

export interface SecurityContext {
  pluginId: string;
  securityLevel: string;
  sandbox: SandboxConfig;
  permissions: string[];
  restrictions: SecurityRestriction[];
  policies: string[];
  certificates: SecurityCertificate[];
  keys: SecurityKey[];
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface SandboxConfig {
  enabled: boolean;
  isolation: 'none' | 'process' | 'container' | 'vm';
  limits: ResourceLimits;
  allowedOperations: string[];
  blockedOperations: string[];
  networkAccess: NetworkAccessConfig;
  fileSystemAccess: FileSystemAccessConfig;
  metadata?: Record<string, any>;
}

export interface ResourceLimits {
  maxMemory?: number;
  maxCpu?: number;
  maxFileDescriptors?: number;
  maxProcesses?: number;
  maxNetworkConnections?: number;
  maxExecutionTime?: number;
  maxFileSize?: number;
  maxTotalFiles?: number;
}

export interface NetworkAccessConfig {
  enabled: boolean;
  allowedHosts?: string[];
  blockedHosts?: string[];
  allowedPorts?: number[];
  blockedPorts?: number[];
  protocols?: string[];
  proxy?: ProxyConfig;
}

export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
}

export interface FileSystemAccessConfig {
  enabled: boolean;
  readOnlyPaths?: string[];
  writablePaths?: string[];
  blockedPaths?: string[];
  maxFileSize?: number;
  allowedExtensions?: string[];
  blockedExtensions?: string[];
}

export interface SecurityRestriction {
  type: 'network' | 'filesystem' | 'resource' | 'api' | 'custom';
  action: 'allow' | 'deny' | 'limit';
  parameters: Record<string, any>;
  enabled: boolean;
  priority: number;
  metadata?: Record<string, any>;
}

export interface SecurityCertificate {
  id: string;
  type: 'x509' | 'jwt' | 'pgp' | 'custom';
  data: string;
  issuer: string;
  subject: string;
  validFrom: Date;
  validTo: Date;
  fingerprint: string;
  purposes: string[];
  revoked: boolean;
  metadata?: Record<string, any>;
}

export interface SecurityKey {
  id: string;
  type: 'rsa' | 'ecdsa' | 'ed25519' | 'symmetric' | 'custom';
  algorithm: string;
  keySize: number;
  publicKey?: string;
  fingerprint: string;
  purposes: string[];
  expiresAt?: Date;
  revoked: boolean;
  metadata?: Record<string, any>;
}

export interface VulnerabilityReport {
  pluginId: string;
  scanDate: Date;
  scannerVersion: string;
  vulnerabilities: SecurityVulnerability[];
  summary: VulnerabilitySummary;
  recommendations: SecurityRecommendation[];
  metadata?: Record<string, any>;
}

export interface SecurityVulnerability {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location?: string;
  cwe?: string;
  cve?: string;
  cvss?: number;
  impact: string;
  likelihood: string;
  mitigation?: string;
  references?: string[];
  metadata?: Record<string, any>;
}

export interface VulnerabilitySummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  fixed: number;
  suppressed: number;
}

export interface SecurityWarning {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  location?: string;
  recommendation?: string;
  metadata?: Record<string, any>;
}

export interface SecurityRecommendation {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action: string;
  impact: string;
  effort: string;
  references?: string[];
  metadata?: Record<string, any>;
}

export interface SecurityEnforcementResult {
  allowed: boolean;
  action: string;
  resource: string;
  policy?: string;
  reason?: string;
  violations: SecurityViolation[];
  obligations: SecurityObligation[];
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SecurityViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  policy?: string;
  action: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SecurityObligation {
  type: string;
  description: string;
  parameters: Record<string, any>;
  deadline?: Date;
  fulfilled: boolean;
  metadata?: Record<string, any>;
}

export interface SecurityMetrics {
  pluginId?: string;
  validationAttempts: number;
  validationFailures: number;
  vulnerabilitiesDetected: number;
  securityViolations: number;
  policiesEvaluated: number;
  averageValidationTime: number;
  lastSecurityScan?: Date;
  lastViolation?: Date;
  riskScore: number;
  complianceScore: number;
  metadata?: Record<string, any>;
}

export interface SecurityIncident {
  id: string;
  pluginId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  reporter?: string;
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  impact: string;
  response: SecurityIncidentResponse[];
  artifacts: SecurityArtifact[];
  metadata?: Record<string, any>;
}

export interface SecurityIncidentResponse {
  id: string;
  timestamp: Date;
  action: string;
  description: string;
  actor: string;
  result?: string;
  metadata?: Record<string, any>;
}

export interface SecurityArtifact {
  id: string;
  type:
    | 'log'
    | 'file'
    | 'network_trace'
    | 'memory_dump'
    | 'screenshot'
    | 'other';
  name: string;
  path?: string;
  hash?: string;
  size: number;
  createdAt: Date;
  metadata?: Record<string, any>;
}
