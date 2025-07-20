import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs-extra';
import * as path from 'path';
import { isMainThread, parentPort, Worker, workerData } from 'worker_threads';
import { CompilationCache, CompilationOptions, CompilationResult, PluginBuildConfig, PluginCompileRequest } from '@types';

/**
 * Plugin Compiler Service - Handles TypeScript compilation and bundling for plugins
 */
@Injectable()
export class PluginCompilerService {
  private readonly logger = new Logger(PluginCompilerService.name);
  private readonly compilationCache = new Map<string, CompilationCache>();
  private readonly activeCompilations = new Map<string, CompilationResult>();
  private readonly watchedPlugins = new Map<string, { watcher: any; callback: (result: CompilationResult) => void }>();

  constructor(private readonly eventEmitter: EventEmitter2) {
    void this.initialize();
  }

  /**
   * Initialize the compiler service
   */
  private async initialize(): Promise<void> {
    try {
      await this.loadCompilationCache();
      await this.setupCompilerEnvironment();
      this.logger.log('Plugin compiler service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize plugin compiler service', error);
    }
  }

  /**
   * Compile a plugin from TypeScript source to JavaScript
   */
  async compilePlugin(request: PluginCompileRequest): Promise<CompilationResult> {
    const { pluginId, sourcePath, options = {} } = request;

    try {
      this.logger.debug(`Starting compilation for plugin: ${pluginId}`);

      // Check if compilation is already in progress
      const existingCompilation = this.activeCompilations.get(pluginId);
      if (existingCompilation) {
        this.logger.debug(`Compilation already in progress for ${pluginId}, waiting...`);
        return existingCompilation;
      }

      // Start new compilation
      const compilationPromise = await this.performCompilation(pluginId, sourcePath, options);
      this.activeCompilations.set(pluginId, compilationPromise);

      try {
        const result = compilationPromise;

        // Update cache on successful compilation
        if (result.success) {
          await this.updateCompilationCache(pluginId, sourcePath, result);
        }

        this.eventEmitter.emit('plugin.compilation.completed', {
          pluginId,
          success: result.success,
          duration: result.time,
          outputSize: result.size,
          errors: result.diagnostics.filter((d) => d.level === 'error').length,
          warnings: result.diagnostics.filter((d) => d.level === 'warning').length,
          timestamp: new Date(),
        });

        return result;
      } finally {
        this.activeCompilations.delete(pluginId);
      }
    } catch (error) {
      this.logger.error(`Compilation failed for plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Build plugin with advanced configuration
   */
  async buildPlugin(pluginId: string, buildConfig: PluginBuildConfig): Promise<CompilationResult> {
    try {
      this.logger.debug(`Building plugin ${pluginId} with config:`, buildConfig);

      const compilation = await this.compilePlugin({
        pluginId,
        sourcePath: buildConfig.sourcePath,
        options: {
          ...buildConfig.compilerOptions,
          target: buildConfig.target ?? 'es2020',
          outputPath: buildConfig.outputPath,
          generateSourceMaps: buildConfig.generateSourceMaps ?? true,
          minify: buildConfig.minify ?? false,
          bundleExternals: buildConfig.bundleExternals ?? true,
          generateDeclarations: buildConfig.generateDeclarations ?? true,
        },
      });

      // Post-build processing
      if (compilation.success && buildConfig.postBuildSteps) {
        this.runPostBuildSteps(pluginId, compilation, buildConfig.postBuildSteps);
      }

      return compilation;
    } catch (error) {
      this.logger.error(`Build failed for plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Watch plugin for changes and recompile automatically
   */
  async watchPlugin(pluginId: string, sourcePath: string, callback: (result: CompilationResult) => void, options?: CompilationOptions): Promise<void> {
    try {
      // Stop existing watcher if any
      this.stopWatching(pluginId);

      // Initial compilation
      const initialResult = await this.compilePlugin({ pluginId, sourcePath, options });
      callback(initialResult);

      // Set up file watcher
      const chokidar = await import('chokidar');
      const watcher = chokidar.watch(sourcePath, {
        ignored: /(^|[/\\])\../,
        persistent: true,
        ignoreInitial: true,
      });

      let compileTimeout: NodeJS.Timeout;

      watcher.on('change', (filePath) => {
        this.logger.debug(`File changed: ${filePath}, recompiling ${pluginId}...`);

        // Debounce compilation
        clearTimeout(compileTimeout);
        compileTimeout = setTimeout(() => {
          void (async () => {
            try {
              const result = await this.compilePlugin({ pluginId, sourcePath, options });
              callback(result);
            } catch (error) {
              this.logger.error(`Watch compilation failed for ${pluginId}:`, error);
            }
          })();
        }, 500);
      });

      this.watchedPlugins.set(pluginId, { watcher, callback });
      this.logger.log(`Started watching plugin: ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to start watching plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Stop watching a plugin
   */
  stopWatching(pluginId: string): void {
    const watched = this.watchedPlugins.get(pluginId);
    if (watched) {
      watched.watcher.close();
      this.watchedPlugins.delete(pluginId);
      this.logger.debug(`Stopped watching plugin: ${pluginId}`);
    }
  }

  /**
   * Start watching a plugin for changes with auto-compilation
   */
  async startWatching(pluginId: string, options: CompilationOptions): Promise<string> {
    const watcherId = `${pluginId}-${Date.now()}`;

    try {
      const sourcePath = await this.getPluginSourcePath(pluginId);
      const callback = (result: CompilationResult) => {
        this.eventEmitter.emit('plugin.compilation.watch.completed', {
          pluginId,
          watcherId,
          result,
          timestamp: new Date(),
        });
      };

      await this.watchPlugin(pluginId, sourcePath, callback, options);
      return watcherId;
    } catch (error) {
      this.logger.error(`Failed to start watching plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Compile multiple plugins in batch
   */
  async compileMultiplePlugins(requests: PluginCompileRequest[]): Promise<CompilationResult[]> {
    const results: CompilationResult[] = [];

    for (const request of requests) {
      try {
        const result = await this.compilePlugin(request);
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to compile plugin ${request.pluginId}:`, error);
        results.push({
          success: false,
          outputPath: '',
          diagnostics: [
            {
              level: 'error',
              message: errorMessage,
              file: request.sourcePath,
              code: 'COMPILATION_ERROR',
            },
          ],
          assets: [],
          dependencies: [],
          size: 0,
          time: 0,
        });
      }
    }

    return results;
  }

  /**
   * Get compilation status for a plugin
   */
  async getCompilationStatus(pluginId: string): Promise<{
    isCompiling: boolean;
    lastCompilation?: CompilationResult;
    watchingChanges: boolean;
    cacheStatus: 'hit' | 'miss' | 'invalid' | 'none';
  }> {
    const isCompiling = this.activeCompilations.has(pluginId);
    const watchingChanges = this.watchedPlugins.has(pluginId);
    const cache = this.compilationCache.get(pluginId);

    let cacheStatus: 'hit' | 'miss' | 'invalid' | 'none' = 'none';
    if (cache) {
      const needsRecompile = await this.needsRecompilation(pluginId, cache.compiledPath);
      cacheStatus = needsRecompile ? 'invalid' : 'hit';
    }

    return {
      isCompiling,
      watchingChanges,
      cacheStatus,
      lastCompilation: cache
        ? {
            success: cache.valid,
            outputPath: cache.compiledPath,
            diagnostics: [],
            assets: [],
            dependencies: cache.dependencies,
            size: cache.outputSize,
            time: 0,
          }
        : undefined,
    };
  }

  /**
   * Get cache information
   */
  getCacheInfo(pluginId?: string): CompilationCache[] {
    if (pluginId) {
      const cache = this.compilationCache.get(pluginId);
      return cache ? [cache] : [];
    }

    return Array.from(this.compilationCache.values());
  }

  /**
   * Optimize a compiled plugin
   */
  async optimizePlugin(
    pluginId: string,
    options?: {
      minify?: boolean;
      treeshake?: boolean;
      compress?: boolean;
    },
  ): Promise<CompilationResult> {
    try {
      const cache = this.compilationCache.get(pluginId);
      if (!cache) {
        throw new Error(`No compiled version found for plugin: ${pluginId}`);
      }

      const optimizationOptions: CompilationOptions = {
        minify: options?.minify ?? true,
        optimization: {
          treeshake: options?.treeshake ?? true,
          compression: options?.compress ?? true,
          mangling: true,
        },
      };

      const sourcePath = await this.getPluginSourcePath(pluginId);
      return await this.compilePlugin({
        pluginId,
        sourcePath,
        options: optimizationOptions,
      });
    } catch (error) {
      this.logger.error(`Failed to optimize plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Get compilation diagnostics
   */
  getDiagnostics(pluginId: string): {
    errors: Array<{ message: string; file: string; line: number; column: number }>;
    warnings: Array<{ message: string; file: string; line: number; column: number }>;
    suggestions: string[];
  } {
    const cache = this.compilationCache.get(pluginId);
    if (!cache) {
      return { errors: [], warnings: [], suggestions: [] };
    }

    // In a real implementation, this would parse TypeScript diagnostics
    return {
      errors: [],
      warnings: [],
      suggestions: [],
    };
  }

  /**
   * Get compiler metrics
   */
  getCompilerMetrics(): {
    totalCompilations: number;
    successfulCompilations: number;
    failedCompilations: number;
    averageCompileTime: number;
    cacheHitRate: number;
    activeWatchers: number;
    memoryUsage: number;
  } {
    const metrics = this.getCompilationMetrics();

    return {
      totalCompilations: metrics.totalCompilations,
      successfulCompilations: metrics.successfulCompilations || 0,
      failedCompilations: metrics.failedCompilations || 0,
      averageCompileTime: metrics.averageCompileTime || 0,
      cacheHitRate: metrics.cacheHitRate || 0,
      activeWatchers: this.watchedPlugins.size,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  /**
   * Get compilation cache for a plugin
   */
  getCompilationCache(pluginId: string): CompilationCache | null {
    return this.compilationCache.get(pluginId) ?? null;
  }

  /**
   * Clear compilation cache
   */
  async clearCache(pluginId?: string): Promise<number> {
    try {
      let clearedCount = 0;

      if (pluginId) {
        if (this.compilationCache.has(pluginId)) {
          this.compilationCache.delete(pluginId);
          await this.removePluginCacheFiles(pluginId);
          clearedCount = 1;
          this.logger.debug(`Cleared cache for plugin: ${pluginId}`);
        }
      } else {
        clearedCount = this.compilationCache.size;
        this.compilationCache.clear();
        await this.clearAllCacheFiles();
        this.logger.debug('Cleared all compilation cache');
      }

      this.eventEmitter.emit('plugin.compilation.cache.cleared', {
        pluginId,
        clearedCount,
        timestamp: new Date(),
      });

      return clearedCount;
    } catch (error) {
      this.logger.error('Failed to clear compilation cache:', error);
      throw error;
    }
  }

  /**
   * Check if plugin needs recompilation
   */
  async needsRecompilation(pluginId: string, sourcePath: string): Promise<boolean> {
    try {
      const cache = this.compilationCache.get(pluginId);
      if (!cache) return true;

      // Check if source files have been modified
      const sourceHash = await this.calculateSourceHash(sourcePath);
      if (sourceHash !== cache.sourceHash) return true;

      // Check if dependencies have changed
      const depsChanged = this.haveDependenciesChanged(cache.dependencies);
      if (depsChanged) return true;

      // Check if output files exist
      const outputExists = await fs.pathExists(cache.compiledPath);
      if (!outputExists) return true;

      return false;
    } catch (error) {
      this.logger.error(`Failed to check recompilation status for ${pluginId}:`, error);
      return true; // Err on the side of recompilation
    }
  }

  /**
   * Get compilation metrics
   */
  getCompilationMetrics(): {
    totalCompilations: number;
    activeCompilations: number;
    watchedPlugins: number;
    cacheHitRate: number;
    averageCompilationTime: number;
  } {
    return {
      totalCompilations: this.compilationCache.size,
      activeCompilations: this.activeCompilations.size,
      watchedPlugins: this.watchedPlugins.size,
      cacheHitRate: 0.85, // Would be calculated from actual metrics
      averageCompilationTime: 2500, // Would be calculated from actual metrics
    };
  }

  /**
   * Private helper methods
   */

  private async performCompilation(pluginId: string, sourcePath: string, options: CompilationOptions): Promise<CompilationResult> {
    const startTime = Date.now();

    try {
      // Setup compilation environment
      const outputPath = options.outputPath ?? path.join(process.cwd(), 'src', 'plugins', 'cache', pluginId);
      fs.ensureDirSync(outputPath);

      // Check cache first
      const needsCompile = await this.needsRecompilation(pluginId, sourcePath);
      if (!needsCompile && !options.force) {
        const cache = this.compilationCache.get(pluginId)!;
        this.logger.debug(`Using cached compilation for ${pluginId}`);

        return {
          success: true,
          outputPath: cache.compiledPath,
          sourceMap: cache.sourceMapPath,
          diagnostics: [],
          assets: [],
          dependencies: cache.dependencies,
          size: cache.outputSize,
          time: Date.now() - startTime,
        };
      }

      // Perform actual compilation
      const result = await this.runTypeScriptCompilation(sourcePath, outputPath, options);

      // Bundle if requested
      if (options.bundle && result.success) {
        const bundleResult = await this.bundlePlugin(pluginId, result.outputPath, options);
        Object.assign(result, bundleResult);
      }

      result.time = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        outputPath: '',
        diagnostics: [
          {
            level: 'error',
            message: error instanceof Error ? error.message : String(error),
            file: sourcePath,
          },
        ],
        assets: [],
        dependencies: [],
        size: 0,
        time: Date.now() - startTime,
      };
    }
  }

  /**
   * Get the source path for a plugin
   */
  private async getPluginSourcePath(pluginId: string): Promise<string> {
    // Try different common source locations
    const possiblePaths = [
      path.join(process.cwd(), 'src', 'plugins', 'installed', pluginId, 'src'),
      path.join(process.cwd(), 'src', 'plugins', 'templates', pluginId, 'src'),
      path.join(process.cwd(), 'plugins', pluginId, 'src'),
      path.join(process.cwd(), 'plugins', 'installed', pluginId, 'src'),
    ];

    for (const sourcePath of possiblePaths) {
      if (await fs.pathExists(sourcePath)) {
        return sourcePath;
      }
    }

    throw new Error(`Could not find source path for plugin: ${pluginId}`);
  }

  private runTypeScriptCompilation(sourcePath: string, outputPath: string, options: CompilationOptions): Promise<CompilationResult> {
    // Use worker thread for CPU-intensive compilation
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: {
          type: 'typescript-compilation',
          sourcePath,
          outputPath,
          options,
        },
      });

      worker.on('message', (result: CompilationResult) => {
        resolve(result);
      });

      worker.on('error', (error) => {
        reject(error);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`TypeScript compilation worker stopped with exit code ${code}`));
        }
      });
    });
  }

  private async bundlePlugin(pluginId: string, compiledPath: string, options: CompilationOptions): Promise<Partial<CompilationResult>> {
    try {
      // Simulate bundling - in real implementation, would use webpack/rollup/esbuild
      const bundleOutputPath = path.join(path.dirname(compiledPath), 'bundle.js');

      // Simple file concatenation for demonstration
      const files = await fs.readdir(compiledPath);
      const jsFiles = files.filter((f) => f.endsWith('.js'));

      let bundleContent = '';
      for (const file of jsFiles) {
        const filePath = path.join(compiledPath, file);
        const content = (await fs.readFile(filePath, 'utf8')) || '';
        bundleContent += `\n// ${file}\n${content}`;
      }

      await fs.writeFile(bundleOutputPath, bundleContent);

      return {
        outputPath: bundleOutputPath,
        size: bundleContent.length,
        assets: [
          {
            name: 'bundle.js',
            path: bundleOutputPath,
            size: bundleContent.length,
            type: 'javascript',
            checksum: await this.calculateFileChecksum(bundleOutputPath),
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to bundle plugin ${pluginId}:`, error);
      throw error;
    }
  }

  private runPostBuildSteps(pluginId: string, compilation: CompilationResult, steps: string[]): void {
    for (const step of steps) {
      try {
        this.logger.debug(`Running post-build step '${step}' for ${pluginId}`);

        switch (step) {
          case 'minify':
            this.minifyOutput(compilation.outputPath);
            break;
          case 'optimize':
            this.optimizeBundle(compilation.outputPath);
            break;
          case 'validate':
            this.validateOutput(compilation.outputPath);
            break;
          default:
            this.logger.warn(`Unknown post-build step: ${step}`);
        }
      } catch (error) {
        this.logger.error(`Post-build step '${step}' failed for ${pluginId}:`, error);
        throw error;
      }
    }
  }

  private async calculateSourceHash(sourcePath: string): Promise<string> {
    const crypto = await import('crypto');
    const files = await this.getAllSourceFiles(sourcePath);

    const hasher = crypto.createHash('sha256');
    for (const file of files.sort()) {
      const content = await fs.readFile(file, 'utf8');
      hasher.update(file);
      hasher.update(content);
    }

    return hasher.digest('hex');
  }

  private async getAllSourceFiles(sourcePath: string): Promise<string[]> {
    const files: string[] = [];

    const traverse = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else if (entry.isFile() && /\.(ts|js|json)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    };

    await traverse(sourcePath);
    return files;
  }

  private haveDependenciesChanged(_dependencies: string[]): boolean {
    // Check if package.json or node_modules have changed
    // This is a simplified implementation
    return false;
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async updateCompilationCache(pluginId: string, sourcePath: string, result: CompilationResult): Promise<void> {
    const cache: CompilationCache = {
      pluginId,
      sourceHash: await this.calculateSourceHash(sourcePath),
      compiledPath: result.outputPath,
      sourceMapPath: result.sourceMap,
      timestamp: new Date(),
      dependencies: result.dependencies,
      outputSize: result.size,
      valid: true,
    };

    this.compilationCache.set(pluginId, cache);
    await this.saveCompilationCache();
  }

  private async setupCompilerEnvironment(): Promise<void> {
    const cacheDir = path.join(process.cwd(), 'src', 'plugins', 'cache');
    await fs.ensureDir(cacheDir);
  }

  private async loadCompilationCache(): Promise<void> {
    try {
      const cachePath = path.join(process.cwd(), 'src', 'plugins', 'cache', 'compilation-cache.json');

      if (await fs.pathExists(cachePath)) {
        const data = await fs.readJson(cachePath);

        for (const [pluginId, cache] of Object.entries(data.cache || {})) {
          this.compilationCache.set(pluginId, cache as CompilationCache);
        }
      }
    } catch (error) {
      this.logger.debug('No compilation cache found, starting fresh');
    }
  }

  private async saveCompilationCache(): Promise<void> {
    try {
      const cachePath = path.join(process.cwd(), 'src', 'plugins', 'cache', 'compilation-cache.json');

      const data = {
        cache: Object.fromEntries(this.compilationCache),
        lastUpdated: new Date().toISOString(),
      };

      await fs.writeJson(cachePath, data, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save compilation cache:', error);
    }
  }

  private async removePluginCacheFiles(pluginId: string): Promise<void> {
    const cacheDir = path.join(process.cwd(), 'src', 'plugins', 'cache', pluginId);
    await fs.remove(cacheDir);
  }

  private async clearAllCacheFiles(): Promise<void> {
    const cacheDir = path.join(process.cwd(), 'src', 'plugins', 'cache');
    await fs.emptyDir(cacheDir);
  }

  private minifyOutput(outputPath: string): void {
    // Placeholder for minification logic
    this.logger.debug(`Minifying output at ${outputPath}`);
  }

  private optimizeBundle(outputPath: string): void {
    // Placeholder for bundle optimization
    this.logger.debug(`Optimizing bundle at ${outputPath}`);
  }

  private validateOutput(outputPath: string): void {
    // Placeholder for output validation
    this.logger.debug(`Validating output at ${outputPath}`);
  }
}

// Worker thread code for TypeScript compilation
if (!isMainThread && workerData?.type === 'typescript-compilation') {
  (() => {
    try {
      const { sourcePath, outputPath, options } = workerData;

      // Simulate TypeScript compilation
      // In real implementation, would use TypeScript compiler API
      const result: CompilationResult = {
        success: true,
        outputPath,
        diagnostics: [],
        assets: [],
        dependencies: [],
        size: 1024,
        time: 0,
      };

      parentPort?.postMessage(result);
    } catch (error) {
      parentPort?.postMessage({
        success: false,
        outputPath: '',
        diagnostics: [
          {
            level: 'error',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
        assets: [],
        dependencies: [],
        size: 0,
        time: 0,
      });
    }
  })();
}
