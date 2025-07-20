/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * Runtime Types - Plugin runtime and execution environment types
 */

import type { Type } from '@nestjs/common';

import type {
  BaseCompilationCache,
  BaseCompilationDiagnostic,
  BaseCompilationResult,
  BaseCompiledAsset,
  EnvironmentType,
  IsolationLevel,
  ModuleState,
  ResourceLimits,
  ResourceUsage,
  ValidationResult,
} from './common.types';

import type { RuntimePermissions } from './security.types';

// Re-export runtime-related common types
export type {
  EnvironmentType,
  IsolationLevel,
  ModuleState,
  NetworkProtocol,
  ResourceLimits,
  ResourceUsage,
  ValidationResult,
  BaseCompilationResult,
  BaseCompilationDiagnostic,
  BaseCompiledAsset,
  BaseCompilationCache,
} from './common.types';

export interface ModuleStatus {
  state: ModuleState;
  loaded: boolean;
  initialized: boolean;
  healthy: boolean;
  lastHealthCheck?: Date;
  errorCount: number;
  lastError?: Error;
  version?: string;
}

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
  environmentType: EnvironmentType;
  variables: Record<string, string>;
  timezone?: string;
  locale?: string;
}

// Import permission types from security.types to avoid duplication
export type { RuntimePermissions, FilesystemPermissions, NetworkPermissions, NetworkRule, SystemPermissions, DatabasePermissions } from './security.types';

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

export interface PluginModuleInstance {
  onModuleInit?(): Promise<void>;
  onModuleDestroy?(): Promise<void>;
  onApplicationBootstrap?(): Promise<void>;
  onApplicationShutdown?(signal?: string): Promise<void>;
}

export type PluginModuleInstanceWithMethods = PluginModuleInstance & Record<string, unknown>;

export interface PluginModule {
  id: string;
  name: string;
  version: string;
  instance: PluginModuleInstanceWithMethods | null;
  exports: PluginExports;
  metadata: ModuleMetadata;
  status: ModuleStatus;
  loadTime: number;
  lastActivity: Date;
}

export interface PluginExports {
  controllers?: Array<Type<unknown>>;
  providers?: Array<Type<unknown>>;
  imports?: Array<Type<unknown> | DynamicModule>;
  exports?: Array<Type<unknown> | string>;
  module: Type<unknown>;
}

export interface DynamicModule {
  module: Type<unknown>;
  imports?: Array<Type<unknown> | DynamicModule>;
  controllers?: Array<Type<unknown>>;
  providers?: Array<Type<unknown>>;
  exports?: Array<Type<unknown> | string>;
  global?: boolean;
}

export interface DynamicModuleImport {
  default?: unknown;
  [key: string]: unknown;
}

export type PluginInstanceMethods = Record<string, (...args: unknown[]) => Promise<unknown>>;

export interface ModuleMetadata {
  decorators: string[];
  imports: string[];
  providers: string[];
  controllers: string[];
  exports: string[];
  global: boolean;
}

export interface PluginCompiler {
  compile(sourcePath: string, outputPath: string): Promise<RuntimeCompilationResult>;
  watch(sourcePath: string, callback: (result: RuntimeCompilationResult) => void): Promise<void>;
  stopWatching(sourcePath: string): Promise<void>;
  getCompilationCache(pluginId: string): RuntimeCompilationCache | null;
  clearCache(pluginId?: string): Promise<void>;
}

// Runtime compilation types (use base types directly)
export interface RuntimeCompilationResult extends BaseCompilationResult {}
export interface RuntimeCompilationDiagnostic extends BaseCompilationDiagnostic {}
export interface RuntimeCompiledAsset extends BaseCompiledAsset {}
export interface RuntimeCompilationCache extends BaseCompilationCache {}

export interface PluginSandbox {
  createSandbox(context: RuntimeContext): Promise<SandboxInstance>;
  destroySandbox(sandboxId: string): Promise<void>;
  executeSandboxed(sandboxId: string, code: string): Promise<unknown>;
  getSandboxStatus(sandboxId: string): SandboxStatus;
  listSandboxes(): SandboxInstance[];
}

export interface SandboxInstance {
  id: string;
  pluginId: string;
  context: RuntimeContext;
  vm: unknown;
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

// Import isolation types from security.types to avoid duplication
export type { IsolationOptions, IsolationResult } from './security.types';
