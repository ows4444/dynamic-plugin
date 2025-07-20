/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * Plugin Development Types - Types for plugin development tools and utilities
 */

import type { BaseCompilationCache, BaseCompilationDiagnostic, BaseCompilationResult, BaseCompiledAsset } from './common.types';

export interface PluginTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  category: 'starter' | 'enterprise' | 'utility' | 'integration';
  files: string[];
  variables: string[];
  dependencies: string[];
  features: string[];
  author?: string;
  license?: string;
  documentation?: string;
  preview?: string;
}

export interface PluginScaffoldConfig {
  pluginName: string;
  template: string;
  description?: string;
  author?: string;
  version?: string;
  license?: string;
  repository?: string;
  category?: string;
  tags?: string[];
  features?: string[];
  outputPath?: string;
  generateTests?: boolean;
  generateDocs?: boolean;
  typescript?: boolean;
  eslint?: boolean;
  prettier?: boolean;
  husky?: boolean;
  commitlint?: boolean;
}

export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  score: number;
  metrics: {
    codeQuality: number;
    documentation: number;
    testing: number;
    security: number;
    performance: number;
  };
  details?: {
    requiredFiles: Array<{ file: string; exists: boolean; required: boolean }>;
    manifest: { valid: boolean; errors: string[]; warnings: string[] };
    dependencies: { resolved: boolean; conflicts: string[]; missing: string[] };
    security: { issues: string[]; recommendations: string[] };
    tests: { coverage: number; testFiles: string[]; missingTests: string[] };
  };
}

export interface PluginTestResult {
  success: boolean;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  duration: number;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  failures: Array<{
    test: string;
    error: string;
    stack?: string;
  }>;
  output: string;
  performance?: {
    slowTests: Array<{ name: string; duration: number }>;
    memoryUsage: number;
  };
}

export interface PluginDocumentationConfig {
  includeApi?: boolean;
  includeReadme?: boolean;
  includeConfig?: boolean;
  includeExamples?: boolean;
  format?: 'markdown' | 'html' | 'json';
  outputPath?: string;
  theme?: string;
  customSections?: Array<{
    title: string;
    content: string;
    order: number;
  }>;
}

export interface PluginDevServer {
  pluginName: string;
  pluginPath: string;
  port: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  hotReload: boolean;
  watchFiles: boolean;
  startTime: Date;
  url: string;
  pid: number;
  logs?: string[];
  errors?: string[];
  performance?: {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

export interface PluginCompileRequest {
  pluginId: string;
  sourcePath: string;
  options?: CompilationOptions;
}

export interface CompilationOptions {
  target?: string;
  outputPath?: string;
  generateSourceMaps?: boolean;
  minify?: boolean;
  bundle?: boolean;
  bundleExternals?: boolean;
  generateDeclarations?: boolean;
  force?: boolean;
  watch?: boolean;
  optimization?: {
    treeshake?: boolean;
    mangling?: boolean;
    compression?: boolean;
  };
  externals?: string[];
  alias?: Record<string, string>;
}

// Development-specific compilation result with additional fields
export interface CompilationResult extends BaseCompilationResult {
  warnings?: string[];
  performance?: {
    bundleSize: number;
    chunkCount: number;
    compressionRatio: number;
  };
}

// Development-specific compilation diagnostic (same as base)
export interface CompilationDiagnostic extends BaseCompilationDiagnostic {}

// Development-specific compiled asset with additional fields
export interface CompiledAsset extends BaseCompiledAsset {
  compressed?: boolean;
  sourceMap?: string;
}

export interface PluginBuildConfig {
  sourcePath: string;
  outputPath?: string;
  target?: string;
  generateSourceMaps?: boolean;
  minify?: boolean;
  bundleExternals?: boolean;
  generateDeclarations?: boolean;
  compilerOptions?: CompilationOptions;
  postBuildSteps?: string[];
  validation?: {
    strict?: boolean;
    checkDependencies?: boolean;
    runTests?: boolean;
  };
}

// Development-specific compilation cache with additional metadata
export interface CompilationCache extends BaseCompilationCache {
  sourceMapPath?: string;
  outputSize: number;
  metadata?: {
    compilerVersion: string;
    options: CompilationOptions;
    environmentHash: string;
  };
}

export interface PluginDevelopmentMetrics {
  totalPlugins: number;
  templatesUsed: Record<string, number>;
  averageScaffoldTime: number;
  compilationSuccessRate: number;
  testCoverage: number;
  activeDevServers: number;
  popularFeatures: string[];
  commonErrors: Array<{
    error: string;
    count: number;
    solutions: string[];
  }>;
}

export interface PluginGenerator {
  generateController(name: string, options: GeneratorOptions): Promise<string>;
  generateService(name: string, options: GeneratorOptions): Promise<string>;
  generateModule(name: string, options: GeneratorOptions): Promise<string>;
  generateEntity(name: string, options: GeneratorOptions): Promise<string>;
  generateRepository(name: string, options: GeneratorOptions): Promise<string>;
  generateGuard(name: string, options: GeneratorOptions): Promise<string>;
  generatePipe(name: string, options: GeneratorOptions): Promise<string>;
  generateFilter(name: string, options: GeneratorOptions): Promise<string>;
  generateInterceptor(name: string, options: GeneratorOptions): Promise<string>;
  generateDecorator(name: string, options: GeneratorOptions): Promise<string>;
}

export interface GeneratorOptions {
  path?: string;
  template?: string;
  dryRun?: boolean;
  overwrite?: boolean;
  addToModule?: boolean;
  addTests?: boolean;
  addDocs?: boolean;
  typescript?: boolean;
  decorators?: string[];
  metadata?: Record<string, unknown>;
}

export interface PluginCliCommand {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
    type: 'string' | 'number' | 'boolean';
  }>;
  options?: Array<{
    name: string;
    alias?: string;
    description: string;
    type: 'string' | 'number' | 'boolean';
    default?: unknown;
  }>;
  handler: (args: Record<string, unknown>) => Promise<void>;
}

export interface PluginDevelopmentWorkspace {
  name: string;
  path: string;
  plugins: string[];
  configuration: {
    typescript?: boolean;
    linting?: boolean;
    testing?: boolean;
    bundling?: boolean;
  };
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export type PluginDevelopmentPhase = 'scaffolding' | 'development' | 'testing' | 'building' | 'validation' | 'documentation' | 'publishing';

export interface PluginDevelopmentStatus {
  phase: PluginDevelopmentPhase;
  progress: number;
  currentTask?: string;
  completedTasks: string[];
  pendingTasks: string[];
  errors?: string[];
  warnings?: string[];
  estimatedTimeRemaining?: number;
}

// Re-export development-related common types for convenience
export type { BaseCompilationResult, BaseCompilationDiagnostic, BaseCompiledAsset, BaseCompilationCache, BuildTarget } from './common.types';
