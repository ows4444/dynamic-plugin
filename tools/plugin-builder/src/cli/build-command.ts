import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as webpack from 'webpack';
import { BundleAnalyzer } from '../builder/bundle-analyzer';
import { PluginWebpackConfigBuilder } from '../builder/webpack.config';
import { BundlePackager } from '../packager/bundle-packager';
import { DependencyChecker } from '../validators/dependency-checker';
import { ManifestValidator } from '../validators/manifest-validator';

export interface BuildOptions {
  pluginPath: string;
  outputPath?: string;
  mode?: 'development' | 'production';
  watch?: boolean;
  analyze?: boolean;
  package?: boolean;
  skipValidation?: boolean;
  verbose?: boolean;
  sourceMaps?: boolean;
  minify?: boolean;
}

export interface BuildResult {
  success: boolean;
  buildTime: number;
  outputPath: string;
  bundleSize: number;
  warnings: string[];
  errors: string[];
  analysis?: any;
  packagePath?: string;
}

@Injectable()
export class BuildCommand {
  private readonly logger = new Logger(BuildCommand.name);

  constructor(
    private readonly configBuilder: PluginWebpackConfigBuilder,
    private readonly bundleAnalyzer: BundleAnalyzer,
    private readonly manifestValidator: ManifestValidator,
    private readonly dependencyChecker: DependencyChecker,
    private readonly bundlePackager: BundlePackager,
  ) {}

  async execute(options: BuildOptions): Promise<BuildResult> {
    const startTime = Date.now();

    const result: BuildResult = {
      success: false,
      buildTime: 0,
      outputPath: '',
      bundleSize: 0,
      warnings: [],
      errors: [],
    };

    try {
      this.logger.log(`Building plugin at: ${options.pluginPath}`);

      if (options.verbose) {
        this.logger.log(`Build options: ${JSON.stringify(options, null, 2)}`);
      }

      // Pre-build validation
      if (!options.skipValidation) {
        await this.performValidation(options.pluginPath, result);

        if (result.errors.length > 0) {
          this.logger.error('Pre-build validation failed');
          return result;
        }
      }

      // Load manifest to get plugin info
      const manifest = await this.loadManifest(options.pluginPath);
      const outputPath =
        options.outputPath ?? path.join(options.pluginPath, 'dist');
      result.outputPath = outputPath;

      // Create webpack configuration
      const webpackConfig = this.configBuilder.createConfig({
        pluginName: manifest.name,
        pluginPath: options.pluginPath,
        outputPath,
        mode: options.mode ?? 'production',
        minify: options.minify !== false,
        sourceMaps: options.sourceMaps ?? false,
      });

      // Build the plugin
      if (options.watch) {
        await this.buildWithWatch(webpackConfig, result);
      } else {
        await this.buildOnce(webpackConfig, result);
      }

      if (!result.success) {
        return result;
      }

      // Post-build analysis
      if (options.analyze) {
        try {
          const analysis =
            await this.bundleAnalyzer.analyzeBuildOutput(outputPath);
          result.analysis = analysis;

          // Generate analysis report
          await this.bundleAnalyzer.generateReport(analysis, outputPath);

          this.logger.log(
            `Bundle analysis complete. Score: ${analysis.performance.score}/100`,
          );

          if (analysis.recommendations.length > 0) {
            this.logger.log('Recommendations:');
            analysis.recommendations.forEach((rec) => {
              this.logger.log(`  - ${rec}`);
            });
          }
        } catch (error) {
          result.warnings.push(`Bundle analysis failed: ${error.message}`);
        }
      }

      // Package the plugin
      if (options.package) {
        try {
          const packageResult = await this.bundlePackager.createPackage({
            pluginPath: options.pluginPath,
            outputPath,
            includeDocs: true,
          });

          result.packagePath = packageResult.packagePath;
          this.logger.log(`Plugin packaged: ${packageResult.packagePath}`);
        } catch (error) {
          result.warnings.push(`Packaging failed: ${error.message}`);
        }
      }

      result.buildTime = Date.now() - startTime;
      this.logger.log(`Build completed in ${result.buildTime}ms`);

      // Print summary
      this.printBuildSummary(result, manifest);
    } catch (error) {
      result.errors.push(error.message);
      result.buildTime = Date.now() - startTime;
      this.logger.error(`Build failed: ${error.message}`);
    }

    return result;
  }

  private async performValidation(
    pluginPath: string,
    result: BuildResult,
  ): Promise<void> {
    try {
      // Validate manifest
      const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
      const manifestValidation =
        await this.manifestValidator.validateManifestFile(manifestPath);

      if (!manifestValidation.valid) {
        result.errors.push(
          ...manifestValidation.errors.map((e) => `Manifest: ${e.message}`),
        );
      }

      result.warnings.push(
        ...manifestValidation.warnings.map((w) => `Manifest: ${w.message}`),
      );

      // Validate dependencies
      try {
        const packageJsonPath = path.join(pluginPath, 'package.json');
        const packageJson = JSON.parse(
          await require('fs').promises.readFile(packageJsonPath, 'utf-8'),
        );

        const dependencyCheck =
          await this.dependencyChecker.checkDependencies(packageJson);

        if (!dependencyCheck.valid) {
          result.warnings.push(
            `Found ${dependencyCheck.summary.vulnerabilities} vulnerable dependencies`,
          );
          result.warnings.push(
            `Found ${dependencyCheck.summary.conflicts} dependency conflicts`,
          );
        }

        result.warnings.push(...dependencyCheck.recommendations);
      } catch (error) {
        result.warnings.push(`Dependency validation failed: ${error.message}`);
      }
    } catch (error) {
      result.warnings.push(`Validation failed: ${error.message}`);
    }
  }

  private async loadManifest(pluginPath: string): Promise<any> {
    const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
    const content = await require('fs').promises.readFile(
      manifestPath,
      'utf-8',
    );
    return JSON.parse(content);
  }

  private async buildOnce(
    webpackConfig: webpack.Configuration,
    result: BuildResult,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const compiler = webpack(webpackConfig);

      compiler.run((error, stats) => {
        if (error) {
          result.errors.push(error.message);
          reject(error);
          return;
        }

        if (!stats) {
          result.errors.push('No build statistics available');
          reject(new Error('No build statistics'));
          return;
        }

        const info = stats.toJson();

        if (stats.hasErrors()) {
          result.errors.push(...(info.errors?.map((e) => e.message) || []));
          result.success = false;
        } else {
          result.success = true;
        }

        if (stats.hasWarnings()) {
          result.warnings.push(...(info.warnings?.map((w) => w.message) || []));
        }

        // Get bundle size
        if (info.assets && info.assets.length > 0) {
          result.bundleSize = info.assets.reduce(
            (total, asset) => total + (asset.size || 0),
            0,
          );
        }

        resolve();
      });
    });
  }

  private async buildWithWatch(
    webpackConfig: webpack.Configuration,
    result: BuildResult,
  ): Promise<void> {
    return new Promise((resolve) => {
      const compiler = webpack(webpackConfig);

      const watchOptions = {
        aggregateTimeout: 300,
        poll: undefined,
        ignored: /node_modules/,
      };

      compiler.watch(watchOptions, (error, stats) => {
        if (error) {
          this.logger.error(`Watch build error: ${error.message}`);
          return;
        }

        if (!stats) {
          this.logger.error('No build statistics available');
          return;
        }

        const info = stats.toJson();

        if (stats.hasErrors()) {
          this.logger.error('Build errors:');
          info.errors?.forEach((error) => {
            this.logger.error(`  ${error.message}`);
          });
          result.success = false;
        } else {
          result.success = true;
          this.logger.log('Build succeeded');
        }

        if (stats.hasWarnings()) {
          this.logger.warn('Build warnings:');
          info.warnings?.forEach((warning) => {
            this.logger.warn(`  ${warning.message}`);
          });
        }

        // Update bundle size
        if (info.assets && info.assets.length > 0) {
          result.bundleSize = info.assets.reduce(
            (total, asset) => total + (asset.size || 0),
            0,
          );
        }

        this.logger.log(`Bundle size: ${this.formatBytes(result.bundleSize)}`);
      });

      // Watch mode doesn't resolve - it keeps watching
      this.logger.log('Watching for file changes...');
      this.logger.log('Press Ctrl+C to stop watching');
    });
  }

  private printBuildSummary(result: BuildResult, manifest: any): void {
    this.logger.log('\n=== Build Summary ===');
    this.logger.log(`Plugin: ${manifest.name}@${manifest.version}`);
    this.logger.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    this.logger.log(`Build Time: ${result.buildTime}ms`);
    this.logger.log(`Bundle Size: ${this.formatBytes(result.bundleSize)}`);
    this.logger.log(`Output: ${result.outputPath}`);

    if (result.packagePath) {
      this.logger.log(`Package: ${result.packagePath}`);
    }

    if (result.analysis) {
      this.logger.log(
        `Performance Score: ${result.analysis.performance.score}/100`,
      );
    }

    if (result.warnings.length > 0) {
      this.logger.log(`\n⚠️ Warnings (${result.warnings.length}):`);
      result.warnings.forEach((warning) => {
        this.logger.warn(`  ${warning}`);
      });
    }

    if (result.errors.length > 0) {
      this.logger.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.forEach((error) => {
        this.logger.error(`  ${error}`);
      });
    }

    this.logger.log('=====================\n');
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
