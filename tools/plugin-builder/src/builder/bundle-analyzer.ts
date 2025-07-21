import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { gzipSize } from 'gzip-size';

export interface BundleAnalysis {
  bundlePath: string;
  size: {
    raw: number;
    gzipped: number;
    formatted: {
      raw: string;
      gzipped: string;
    };
  };
  dependencies: DependencyAnalysis;
  performance: PerformanceAnalysis;
  recommendations: string[];
}

export interface DependencyAnalysis {
  total: number;
  external: string[];
  bundled: string[];
  duplicates: Array<{
    name: string;
    versions: string[];
    instances: number;
  }>;
}

export interface PerformanceAnalysis {
  score: number; // 0-100
  metrics: {
    bundleSize: 'excellent' | 'good' | 'warning' | 'critical';
    dependencyCount: 'excellent' | 'good' | 'warning' | 'critical';
    duplicateDependencies: 'excellent' | 'good' | 'warning' | 'critical';
  };
  suggestions: string[];
}

@Injectable()
export class BundleAnalyzer {
  private readonly logger = new Logger(BundleAnalyzer.name);

  async analyzeBuildOutput(outputPath: string): Promise<BundleAnalysis> {
    try {
      const bundlePath = await this.findMainBundle(outputPath);
      
      if (!bundlePath) {
        throw new Error('Bundle file not found in output directory');
      }

      const [sizeAnalysis, dependencyAnalysis] = await Promise.all([
        this.analyzeBundleSize(bundlePath),
        this.analyzeDependencies(outputPath),
      ]);

      const performanceAnalysis = this.analyzePerformance(sizeAnalysis, dependencyAnalysis);
      const recommendations = this.generateRecommendations(sizeAnalysis, dependencyAnalysis, performanceAnalysis);

      return {
        bundlePath,
        size: sizeAnalysis,
        dependencies: dependencyAnalysis,
        performance: performanceAnalysis,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Bundle analysis failed: ${error.message}`);
      throw error;
    }
  }

  async compareBuilds(
    currentPath: string,
    previousPath: string,
  ): Promise<{
    current: BundleAnalysis;
    previous: BundleAnalysis;
    comparison: {
      sizeChange: number;
      sizeChangeFormatted: string;
      dependencyChange: number;
      scoreChange: number;
      improved: boolean;
    };
  }> {
    const [current, previous] = await Promise.all([
      this.analyzeBuildOutput(currentPath),
      this.analyzeBuildOutput(previousPath),
    ]);

    const sizeChange = current.size.raw - previous.size.raw;
    const sizeChangePercent = (sizeChange / previous.size.raw) * 100;
    const dependencyChange = current.dependencies.total - previous.dependencies.total;
    const scoreChange = current.performance.score - previous.performance.score;

    const comparison = {
      sizeChange,
      sizeChangeFormatted: this.formatSizeChange(sizeChange, sizeChangePercent),
      dependencyChange,
      scoreChange,
      improved: scoreChange > 0 && sizeChange <= 0,
    };

    return { current, previous, comparison };
  }

  async generateReport(analysis: BundleAnalysis, outputPath: string): Promise<void> {
    const report = this.createTextReport(analysis);
    const reportPath = path.join(outputPath, 'bundle-analysis.txt');
    
    await fs.writeFile(reportPath, report);
    this.logger.log(`Bundle analysis report saved to: ${reportPath}`);

    // Also create a JSON report for programmatic consumption
    const jsonReportPath = path.join(outputPath, 'bundle-analysis.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(analysis, null, 2));
  }

  private async findMainBundle(outputPath: string): Promise<string | null> {
    try {
      const files = await fs.readdir(outputPath);
      const bundleFile = files.find(file => 
        file.endsWith('.bundle.js') || 
        (file.endsWith('.js') && !file.includes('.map'))
      );

      return bundleFile ? path.join(outputPath, bundleFile) : null;
    } catch (error) {
      this.logger.error(`Failed to find bundle file: ${error.message}`);
      return null;
    }
  }

  private async analyzeBundleSize(bundlePath: string): Promise<BundleAnalysis['size']> {
    const stats = await fs.stat(bundlePath);
    const content = await fs.readFile(bundlePath);
    const gzippedSize = await gzipSize(content);

    return {
      raw: stats.size,
      gzipped: gzippedSize,
      formatted: {
        raw: this.formatBytes(stats.size),
        gzipped: this.formatBytes(gzippedSize),
      },
    };
  }

  private async analyzeDependencies(outputPath: string): Promise<DependencyAnalysis> {
    try {
      const packageJsonPath = path.join(outputPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const external: string[] = [];
      const bundled: string[] = [];
      const duplicates: Array<{ name: string; versions: string[]; instances: number }> = [];

      // This is a simplified analysis - in practice, you'd analyze the actual bundle content
      for (const [name, version] of Object.entries(dependencies)) {
        if (this.isExternalDependency(name)) {
          external.push(name);
        } else {
          bundled.push(name);
        }
      }

      return {
        total: Object.keys(dependencies).length,
        external,
        bundled,
        duplicates,
      };
    } catch (error) {
      this.logger.warn(`Dependency analysis failed: ${error.message}`);
      return {
        total: 0,
        external: [],
        bundled: [],
        duplicates: [],
      };
    }
  }

  private analyzePerformance(
    sizeAnalysis: BundleAnalysis['size'],
    dependencyAnalysis: DependencyAnalysis,
  ): PerformanceAnalysis {
    const bundleSizeScore = this.evaluateBundleSize(sizeAnalysis.gzipped);
    const dependencyScore = this.evaluateDependencyCount(dependencyAnalysis.total);
    const duplicateScore = this.evaluateDuplicates(dependencyAnalysis.duplicates);

    const overallScore = Math.round((bundleSizeScore + dependencyScore + duplicateScore) / 3);

    const suggestions: string[] = [];

    if (bundleSizeScore < 70) {
      suggestions.push('Consider code splitting to reduce bundle size');
      suggestions.push('Review and remove unused dependencies');
    }

    if (dependencyScore < 70) {
      suggestions.push('High dependency count may impact loading time');
    }

    if (duplicateScore < 70) {
      suggestions.push('Duplicate dependencies found - consider deduplication');
    }

    return {
      score: overallScore,
      metrics: {
        bundleSize: this.scoreToCategory(bundleSizeScore),
        dependencyCount: this.scoreToCategory(dependencyScore),
        duplicateDependencies: this.scoreToCategory(duplicateScore),
      },
      suggestions,
    };
  }

  private generateRecommendations(
    sizeAnalysis: BundleAnalysis['size'],
    dependencyAnalysis: DependencyAnalysis,
    performanceAnalysis: PerformanceAnalysis,
  ): string[] {
    const recommendations: string[] = [];

    // Size-based recommendations
    if (sizeAnalysis.gzipped > 500 * 1024) { // > 500KB
      recommendations.push('Bundle is large (>500KB gzipped). Consider implementing lazy loading.');
    }

    if (sizeAnalysis.gzipped > 1024 * 1024) { // > 1MB
      recommendations.push('Bundle exceeds 1MB gzipped. This may significantly impact load times.');
    }

    // Dependency recommendations
    if (dependencyAnalysis.total > 50) {
      recommendations.push('High number of dependencies. Review if all are necessary.');
    }

    if (dependencyAnalysis.duplicates.length > 0) {
      recommendations.push(`Found ${dependencyAnalysis.duplicates.length} duplicate dependencies.`);
    }

    // Performance recommendations
    if (performanceAnalysis.score < 50) {
      recommendations.push('Overall bundle performance is poor. Consider optimization.');
    }

    recommendations.push(...performanceAnalysis.suggestions);

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private evaluateBundleSize(sizeInBytes: number): number {
    if (sizeInBytes < 100 * 1024) return 100; // < 100KB
    if (sizeInBytes < 250 * 1024) return 90;  // < 250KB
    if (sizeInBytes < 500 * 1024) return 75;  // < 500KB
    if (sizeInBytes < 1024 * 1024) return 50; // < 1MB
    return 25; // >= 1MB
  }

  private evaluateDependencyCount(count: number): number {
    if (count < 10) return 100;
    if (count < 25) return 80;
    if (count < 50) return 60;
    if (count < 100) return 40;
    return 20;
  }

  private evaluateDuplicates(duplicates: Array<{ name: string; versions: string[]; instances: number }>): number {
    if (duplicates.length === 0) return 100;
    if (duplicates.length < 3) return 80;
    if (duplicates.length < 5) return 60;
    return 40;
  }

  private scoreToCategory(score: number): 'excellent' | 'good' | 'warning' | 'critical' {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'warning';
    return 'critical';
  }

  private isExternalDependency(name: string): boolean {
    const externalPatterns = [
      '@nestjs/',
      'express',
      'typeorm',
      'mongoose',
      'redis',
      'mysql',
      'pg',
      'sqlite3',
    ];

    return externalPatterns.some(pattern => name.startsWith(pattern));
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private formatSizeChange(sizeChange: number, percentChange: number): string {
    const sign = sizeChange > 0 ? '+' : '';
    const sizeFormatted = this.formatBytes(Math.abs(sizeChange));
    return `${sign}${sizeFormatted} (${sign}${percentChange.toFixed(1)}%)`;
  }

  private createTextReport(analysis: BundleAnalysis): string {
    const lines = [
      '# Bundle Analysis Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Bundle Size',
      `Raw Size: ${analysis.size.formatted.raw}`,
      `Gzipped: ${analysis.size.formatted.gzipped}`,
      '',
      '## Dependencies',
      `Total: ${analysis.dependencies.total}`,
      `External: ${analysis.dependencies.external.length}`,
      `Bundled: ${analysis.dependencies.bundled.length}`,
      `Duplicates: ${analysis.dependencies.duplicates.length}`,
      '',
      '## Performance Score',
      `Overall: ${analysis.performance.score}/100`,
      `Bundle Size: ${analysis.performance.metrics.bundleSize}`,
      `Dependencies: ${analysis.performance.metrics.dependencyCount}`,
      `Duplicates: ${analysis.performance.metrics.duplicateDependencies}`,
      '',
      '## Recommendations',
      ...analysis.recommendations.map(rec => `- ${rec}`),
    ];

    return lines.join('\n');
  }
}