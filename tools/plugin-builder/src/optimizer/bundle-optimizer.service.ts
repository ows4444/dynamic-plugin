import { Injectable, Logger } from '@nestjs/common';
import * as webpack from 'webpack';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

export interface BundleOptimizationResult {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  warnings: string[];
  recommendations: string[];
  performance: {
    buildTime: number;
    bundleSize: number;
    chunkCount: number;
    assetCount: number;
  };
}

export interface OptimizationOptions {
  analyze?: boolean;
  minify?: boolean;
  treeshake?: boolean;
  splitChunks?: boolean;
  compression?: boolean;
  target?: 'lightweight' | 'featureRich' | 'development';
}

@Injectable()
export class BundleOptimizerService {
  private readonly logger = new Logger(BundleOptimizerService.name);

  /**
   * Optimize plugin bundle with advanced techniques
   */
  async optimizeBundle(
    entryPath: string,
    outputPath: string,
    options: OptimizationOptions = {},
  ): Promise<BundleOptimizationResult> {
    const startTime = Date.now();
    
    this.logger.log('Starting bundle optimization');

    try {
      // Get original bundle size
      const originalSize = await this.getBundleSize(entryPath);

      // Create optimized webpack configuration
      const webpackConfig = await this.createOptimizedConfig(entryPath, outputPath, options);

      // Run webpack compilation
      const stats = await this.runWebpackCompilation(webpackConfig);

      // Analyze results
      const optimizedSize = await this.getBundleSize(outputPath);
      const buildTime = Date.now() - startTime;

      const result: BundleOptimizationResult = {
        originalSize,
        optimizedSize,
        compressionRatio: ((originalSize - optimizedSize) / originalSize) * 100,
        warnings: this.extractWarnings(stats),
        recommendations: await this.generateRecommendations(stats, options),
        performance: {
          buildTime,
          bundleSize: optimizedSize,
          chunkCount: stats.compilation.chunks.size,
          assetCount: Object.keys(stats.compilation.assets).length,
        },
      };

      this.logger.log(`Bundle optimization completed in ${buildTime}ms`);
      this.logger.log(`Size reduction: ${result.compressionRatio.toFixed(1)}%`);

      return result;
    } catch (error) {
      this.logger.error('Bundle optimization failed', error);
      throw error;
    }
  }

  /**
   * Analyze bundle composition and dependencies
   */
  async analyzeBundleComposition(bundlePath: string): Promise<{
    modules: Array<{ name: string; size: number; percentage: number }>;
    duplicates: string[];
    unusedExports: string[];
    heavyDependencies: string[];
  }> {
    // Implementation would use webpack-bundle-analyzer programmatically
    // This is a simplified version
    const stats = await this.getBundleStats(bundlePath);
    
    return {
      modules: this.extractModuleInfo(stats),
      duplicates: this.findDuplicateModules(stats),
      unusedExports: this.findUnusedExports(stats),
      heavyDependencies: this.findHeavyDependencies(stats),
    };
  }

  /**
   * Optimize for specific performance targets
   */
  async optimizeForTarget(
    entryPath: string,
    outputPath: string,
    target: 'size' | 'speed' | 'balanced',
  ): Promise<BundleOptimizationResult> {
    let options: OptimizationOptions;

    switch (target) {
      case 'size':
        options = {
          minify: true,
          treeshake: true,
          compression: true,
          splitChunks: false, // Single bundle for minimal size
          target: 'lightweight',
        };
        break;
      case 'speed':
        options = {
          minify: false,
          treeshake: false,
          compression: false,
          splitChunks: true,
          target: 'development',
        };
        break;
      case 'balanced':
      default:
        options = {
          minify: true,
          treeshake: true,
          compression: true,
          splitChunks: true,
          target: 'featureRich',
        };
        break;
    }

    return this.optimizeBundle(entryPath, outputPath, options);
  }

  /**
   * Generate optimization recommendations
   */
  async generateOptimizationReport(bundlePath: string): Promise<{
    currentMetrics: {
      size: number;
      loadTime: number;
      parseTime: number;
    };
    recommendations: Array<{
      type: 'critical' | 'warning' | 'info';
      category: string;
      message: string;
      impact: 'high' | 'medium' | 'low';
      solution: string;
    }>;
    potentialSavings: number;
  }> {
    const composition = await this.analyzeBundleComposition(bundlePath);
    const currentSize = await this.getBundleSize(bundlePath);
    
    const recommendations = [];
    let potentialSavings = 0;

    // Check for heavy dependencies
    if (composition.heavyDependencies.length > 0) {
      recommendations.push({
        type: 'warning' as const,
        category: 'Dependencies',
        message: `Found ${composition.heavyDependencies.length} heavy dependencies`,
        impact: 'high' as const,
        solution: 'Consider using lighter alternatives or lazy loading',
      });
      potentialSavings += currentSize * 0.3; // Estimate 30% reduction
    }

    // Check for duplicates
    if (composition.duplicates.length > 0) {
      recommendations.push({
        type: 'critical' as const,
        category: 'Code Duplication',
        message: `Found ${composition.duplicates.length} duplicate modules`,
        impact: 'high' as const,
        solution: 'Enable proper tree shaking and dedupe modules',
      });
      potentialSavings += currentSize * 0.15; // Estimate 15% reduction
    }

    // Check for unused exports
    if (composition.unusedExports.length > 0) {
      recommendations.push({
        type: 'warning' as const,
        category: 'Dead Code',
        message: `Found ${composition.unusedExports.length} unused exports`,
        impact: 'medium' as const,
        solution: 'Remove unused exports and enable tree shaking',
      });
      potentialSavings += currentSize * 0.1; // Estimate 10% reduction
    }

    // Check bundle size
    if (currentSize > 512000) { // 500KB
      recommendations.push({
        type: 'critical' as const,
        category: 'Bundle Size',
        message: 'Bundle size exceeds recommended limit',
        impact: 'high' as const,
        solution: 'Enable compression and code splitting',
      });
    }

    return {
      currentMetrics: {
        size: currentSize,
        loadTime: this.estimateLoadTime(currentSize),
        parseTime: this.estimateParseTime(currentSize),
      },
      recommendations,
      potentialSavings,
    };
  }

  private async createOptimizedConfig(
    entryPath: string,
    outputPath: string,
    options: OptimizationOptions,
  ): Promise<webpack.Configuration> {
    const webpackOptimizerConfig = require('../configs/webpack.optimization.config.js');
    
    const preset = options.target || 'featureRich';
    const baseConfig = webpackOptimizerConfig.presets[preset]({
      entry: entryPath,
      outputPath,
      analyze: options.analyze,
      compression: options.compression,
    });

    // Apply custom optimizations
    if (options.treeshake !== undefined) {
      baseConfig.optimization.usedExports = options.treeshake;
      baseConfig.optimization.sideEffects = !options.treeshake;
    }

    if (options.minify !== undefined) {
      baseConfig.optimization.minimize = options.minify;
    }

    if (options.splitChunks !== undefined && !options.splitChunks) {
      baseConfig.optimization.splitChunks = false;
    }

    return baseConfig;
  }

  private async runWebpackCompilation(config: webpack.Configuration): Promise<webpack.Stats> {
    return new Promise((resolve, reject) => {
      webpack(config, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }

        if (!stats) {
          reject(new Error('No webpack stats generated'));
          return;
        }

        if (stats.hasErrors()) {
          reject(new Error(stats.toString('errors-only')));
          return;
        }

        resolve(stats);
      });
    });
  }

  private async getBundleSize(bundlePath: string): Promise<number> {
    try {
      const stats = await fs.stat(bundlePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  private async getBundleStats(bundlePath: string): Promise<any> {
    // This would typically parse webpack stats.json
    // Simplified implementation
    return {};
  }

  private extractWarnings(stats: webpack.Stats): string[] {
    const warnings = [];
    
    if (stats.hasWarnings()) {
      const info = stats.toJson({ warnings: true });
      warnings.push(...(info.warnings || []).map(w => w.message || w.toString()));
    }

    return warnings;
  }

  private async generateRecommendations(
    stats: webpack.Stats,
    options: OptimizationOptions,
  ): Promise<string[]> {
    const recommendations = [];
    const info = stats.toJson({ all: false, assets: true, chunks: true });

    // Check for large assets
    const largeAssets = (info.assets || []).filter(asset => asset.size > 100000); // 100KB
    if (largeAssets.length > 0) {
      recommendations.push(`Consider splitting large assets: ${largeAssets.map(a => a.name).join(', ')}`);
    }

    // Check for too many chunks
    if ((info.chunks || []).length > 10) {
      recommendations.push('Consider reducing chunk count for better performance');
    }

    // Check if tree shaking is disabled
    if (!options.treeshake) {
      recommendations.push('Enable tree shaking to reduce bundle size');
    }

    // Check if compression is disabled
    if (!options.compression) {
      recommendations.push('Enable gzip compression for production builds');
    }

    return recommendations;
  }

  private extractModuleInfo(stats: any): Array<{ name: string; size: number; percentage: number }> {
    // Implementation would extract module information from webpack stats
    return [];
  }

  private findDuplicateModules(stats: any): string[] {
    // Implementation would find duplicate modules
    return [];
  }

  private findUnusedExports(stats: any): string[] {
    // Implementation would find unused exports
    return [];
  }

  private findHeavyDependencies(stats: any): string[] {
    // Implementation would identify heavy dependencies
    return [];
  }

  private estimateLoadTime(size: number): number {
    // Estimate load time based on bundle size
    // Assuming 3G connection speed (~1.6 Mbps)
    const bitsPerSecond = 1600000;
    const bytesPerSecond = bitsPerSecond / 8;
    return (size / bytesPerSecond) * 1000; // Convert to milliseconds
  }

  private estimateParseTime(size: number): number {
    // Estimate JavaScript parse time
    // Rough estimate: 1MB takes ~100ms on average device
    return (size / 1024 / 1024) * 100;
  }
}