import type { PluginPermissions, ValidationResult } from './plugin.types';

export interface RuntimeContext {
  pluginId: string;
  workingDirectory: string;
  environment: RuntimeEnvironment;
  isolation: IsolationLevel;
  resourceLimits: ResourceLimits;
  permissions: RuntimePermissions;
  hooks: RuntimeHooks;
  dependencies: RuntimeDependency[];
}

export interface RuntimeEnvironment {
  nodeVersion: string;
  nestjsVersion: string;
  platform: string;
  architecture: string;
  environmentType: 'development' | 'staging' | 'production';
  variables: Record<string, string>;
}

export interface RuntimePermissions {
  filesystem: FilesystemPermissions;
  network: NetworkPermissions;
  system: SystemPermissions;
  database: DatabasePermissions;
  plugins: PluginPermissions;
}

export interface FilesystemPermissions {
  read: string[];
  write: string[];
  execute: string[];
  delete: string[];
}

export interface NetworkPermissions {
  outbound: NetworkRule[];
  inbound: NetworkRule[];
}

export interface NetworkRule {
  protocol: 'http' | 'https' | 'tcp' | 'udp';
  host?: string;
  port?: number | number[];
  path?: string;
}

export interface SystemPermissions {
  processes: boolean;
  environment: boolean;
  filesystem: boolean;
  network: boolean;
}

export interface DatabasePermissions {
  read: string[];
  write: string[];
  schema: string[];
}

export interface RuntimeHooks {
  beforeLoad?: string;
  afterLoad?: string;
  beforeUnload?: string;
  afterUnload?: string;
  onError?: string;
  onHealthCheck?: string;
}

export interface RuntimeDependency {
  name: string;
  version: string;
  type: 'npm' | 'plugin' | 'system';
  resolved: boolean;
  path?: string;
}

export interface PluginLoader {
  loadPlugin(pluginPath: string, context: RuntimeContext): Promise<PluginModule>;
  unloadPlugin(pluginId: string): Promise<void>;
  reloadPlugin(pluginId: string): Promise<PluginModule>;
  validatePlugin(pluginPath: string): Promise<ValidationResult>;
  getPluginModule(pluginId: string): PluginModule | null;
}

export interface PluginModule {
  id: string;
  name: string;
  version: string;
  instance: any;
  exports: PluginExports;
  metadata: ModuleMetadata;
  status: ModuleStatus;
  loadTime: number;
  lastActivity: Date;
}

export interface PluginExports {
  controllers?: any[];
  providers?: any[];
  imports?: any[];
  exports?: any[];
  module: any;
}

export interface ModuleMetadata {
  decorators: string[];
  imports: string[];
  providers: string[];
  controllers: string[];
  exports: string[];
  global: boolean;
}

export interface ModuleStatus {
  loaded: boolean;
  initialized: boolean;
  healthy: boolean;
  lastHealthCheck: Date;
  errorCount: number;
  lastError?: Error;
}

export interface PluginCompiler {
  compile(sourcePath: string, outputPath: string): Promise<CompilationResult>;
  watch(sourcePath: string, callback: (result: CompilationResult) => void): Promise<void>;
  stopWatching(sourcePath: string): Promise<void>;
  getCompilationCache(pluginId: string): CompilationCache | null;
  clearCache(pluginId?: string): Promise<void>;
}

export interface CompilationResult {
  success: boolean;
  outputPath: string;
  sourceMap?: string;
  diagnostics: CompilationDiagnostic[];
  assets: CompiledAsset[];
  dependencies: string[];
  size: number;
  time: number;
}

export interface CompilationDiagnostic {
  level: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
}

export interface CompiledAsset {
  name: string;
  path: string;
  size: number;
  type: string;
  checksum: string;
}

export interface CompilationCache {
  pluginId: string;
  sourceHash: string;
  compiledPath: string;
  timestamp: Date;
  dependencies: string[];
  valid: boolean;
}

export interface PluginSandbox {
  createSandbox(context: RuntimeContext): Promise<SandboxInstance>;
  destroySandbox(sandboxId: string): Promise<void>;
  executeSandboxed(sandboxId: string, code: string): Promise<any>;
  getSandboxStatus(sandboxId: string): SandboxStatus;
  listSandboxes(): SandboxInstance[];
}

export interface SandboxInstance {
  id: string;
  pluginId: string;
  context: RuntimeContext;
  vm: any;
  status: SandboxStatus;
  createdAt: Date;
  lastActivity: Date;
  resourceUsage: ResourceUsage;
}

export interface SandboxStatus {
  running: boolean;
  healthy: boolean;
  isolated: boolean;
  resourceLimited: boolean;
  lastError?: Error;
}

export interface ResourceUsage {
  memory: number;
  cpu: number;
  network: number;
  filesystem: number;
  processes: number;
}

export interface PluginProfiler {
  startProfiling(pluginId: string): Promise<void>;
  stopProfiling(pluginId: string): Promise<ProfileResult>;
  getProfile(pluginId: string): ProfileResult | null;
  clearProfiles(pluginId?: string): Promise<void>;
}

export interface ProfileResult {
  pluginId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  memoryUsage: MemoryProfile;
  cpuUsage: CpuProfile;
  networkActivity: NetworkProfile;
  filesystemActivity: FilesystemProfile;
}

export interface MemoryProfile {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  peak: number;
  leaks: MemoryLeak[];
}

export interface MemoryLeak {
  type: string;
  size: number;
  count: number;
  location: string;
}

export interface CpuProfile {
  totalTime: number;
  userTime: number;
  systemTime: number;
  idleTime: number;
  samples: CpuSample[];
}

export interface CpuSample {
  timestamp: number;
  usage: number;
  function: string;
}

export interface NetworkProfile {
  bytesIn: number;
  bytesOut: number;
  connections: number;
  requests: NetworkRequest[];
}

export interface NetworkRequest {
  method: string;
  url: string;
  duration: number;
  bytesIn: number;
  bytesOut: number;
  timestamp: Date;
}

export interface FilesystemProfile {
  bytesRead: number;
  bytesWritten: number;
  filesOpened: number;
  operations: FilesystemOperation[];
}

export interface FilesystemOperation {
  type: 'read' | 'write' | 'open' | 'close' | 'delete';
  path: string;
  size: number;
  duration: number;
  timestamp: Date;
}

export enum IsolationLevel {
  NONE = 'none',
  PROCESS = 'process',
  CONTAINER = 'container',
  VM = 'vm',
}

export interface ResourceLimits {
  memory: number;
  cpu: number;
  network: number;
  filesystem: number;
  processes: number;
  timeouts: {
    startup: number;
    shutdown: number;
    idle: number;
  };
}

export { ValidationResult } from './plugin.types';
