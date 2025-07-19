import { Injectable, Logger } from '@nestjs/common';
import * as semver from 'semver';
import type { CompatibilityResult, PluginEngines } from '@/types/plugin.types';
import { PluginMetadataRepository } from '../repositories/plugin-metadata.repository';

/**
 * Service for checking plugin compatibility
 */
@Injectable()
export class PluginCompatibilityService {
  private readonly logger = new Logger(PluginCompatibilityService.name);

  constructor(private readonly metadataRepository: PluginMetadataRepository) {}

  /**
   * Check compatibility for a specific plugin
   */
  checkCompatibility(pluginId: string): CompatibilityResult {
    try {
      const entry = this.metadataRepository.getPlugin(pluginId);
      if (!entry) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      const reasons: string[] = [];
      const suggestions: string[] = [];

      // Check Node.js compatibility
      this.checkNodeCompatibility(entry.engines.node, reasons, suggestions);

      // Check NestJS compatibility
      this.checkNestJSCompatibility(entry.engines.nestjs, reasons, suggestions);

      // Check npm dependencies
      this.checkNpmDependencies(entry.dependencies, reasons, suggestions);

      // Check plugin dependencies
      this.checkPluginDependencies(entry.pluginDependencies, reasons, suggestions);

      // Check engine compatibility
      this.checkEngineCompatibility(entry.engines, reasons, suggestions);

      const result: CompatibilityResult = {
        compatible: reasons.length === 0,
        reasons,
        suggestions,
      };

      this.logger.debug(`Compatibility check for ${pluginId}: ${result.compatible ? 'compatible' : 'incompatible'}`, {
        pluginId,
        reasonsCount: reasons.length,
        suggestionsCount: suggestions.length,
      });

      return result;
    } catch (error) {
      this.logger.error(`Compatibility check failed for ${pluginId}`, error);
      throw error;
    }
  }

  /**
   * Check Node.js version compatibility
   */
  private checkNodeCompatibility(nodeRequirement: string | undefined, reasons: string[], suggestions: string[]): void {
    if (!nodeRequirement) {
      return;
    }

    const nodeVersion = process.version;

    try {
      if (!semver.satisfies(nodeVersion, nodeRequirement)) {
        reasons.push(`Node.js version ${nodeVersion} does not satisfy requirement ${nodeRequirement}`);
        suggestions.push(`Upgrade Node.js to a version that satisfies ${nodeRequirement}`);
      }
    } catch (error) {
      this.logger.warn(`Invalid Node.js version requirement: ${nodeRequirement}`, error);
      reasons.push(`Invalid Node.js version requirement: ${nodeRequirement}`);
      suggestions.push('Fix the Node.js version requirement in plugin manifest');
    }
  }

  /**
   * Check NestJS version compatibility
   */
  private checkNestJSCompatibility(nestjsRequirement: string | undefined, reasons: string[], suggestions: string[]): void {
    if (!nestjsRequirement) {
      return;
    }

    try {
      // Try to get NestJS version from package.json
      const nestjsVersion = this.getNestJSVersion();

      if (nestjsVersion && !semver.satisfies(nestjsVersion, nestjsRequirement)) {
        reasons.push(`NestJS version ${nestjsVersion} does not satisfy requirement ${nestjsRequirement}`);
        suggestions.push(`Update NestJS to a version that satisfies ${nestjsRequirement}`);
      }
    } catch (error) {
      this.logger.warn(`Could not verify NestJS version compatibility for requirement: ${nestjsRequirement}`, error);
      // Don't add to reasons since this is a verification issue, not a compatibility issue
    }
  }

  /**
   * Check npm dependencies compatibility
   */
  private checkNpmDependencies(dependencies: { name: string; version: string; required: boolean }[], reasons: string[], suggestions: string[]): void {
    for (const dep of dependencies) {
      if (!dep.required) {
        continue;
      }

      try {
        // In a real implementation, this would check if the dependency is installed
        // and verify version compatibility. For now, we'll just validate the version format
        if (!semver.validRange(dep.version)) {
          reasons.push(`Invalid version range for dependency ${dep.name}: ${dep.version}`);
          suggestions.push(`Fix the version range for dependency ${dep.name}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to check dependency ${dep.name}@${dep.version}`, error);
        reasons.push(`Could not verify dependency: ${dep.name}@${dep.version}`);
        suggestions.push(`Ensure dependency ${dep.name} is properly specified`);
      }
    }
  }

  /**
   * Check plugin dependencies compatibility
   */
  private checkPluginDependencies(pluginDependencies: Record<string, string>, reasons: string[], suggestions: string[]): void {
    for (const [depName, depVersion] of Object.entries(pluginDependencies)) {
      try {
        const depPlugin = this.findPluginByName(depName);

        if (!depPlugin) {
          reasons.push(`Required plugin dependency not found: ${depName}`);
          suggestions.push(`Install plugin dependency: ${depName}@${depVersion}`);
        } else if (!semver.satisfies(depPlugin.version, depVersion)) {
          reasons.push(`Plugin dependency version mismatch: ${depName}@${depPlugin.version} does not satisfy ${depVersion}`);
          suggestions.push(`Update plugin dependency: ${depName} to version ${depVersion}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to check plugin dependency ${depName}@${depVersion}`, error);
        reasons.push(`Could not verify plugin dependency: ${depName}@${depVersion}`);
        suggestions.push(`Ensure plugin dependency ${depName} is properly installed`);
      }
    }
  }

  /**
   * Check engine compatibility (general engine requirements)
   */
  private checkEngineCompatibility(engines: PluginEngines, reasons: string[], suggestions: string[]): void {
    for (const [engine, requirement] of Object.entries(engines)) {
      // Skip known engines that are handled elsewhere
      if (engine === 'node' || engine === 'nestjs') {
        continue;
      }

      try {
        // For unknown engines, we can only validate the version format
        if (!semver.validRange(requirement)) {
          reasons.push(`Invalid version range for engine ${engine}: ${requirement}`);
          suggestions.push(`Fix the version range for engine ${engine}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to check engine ${engine}@${requirement}`, error);
        reasons.push(`Could not verify engine requirement: ${engine}@${requirement}`);
        suggestions.push(`Ensure engine ${engine} requirement is properly specified`);
      }
    }
  }

  /**
   * Get the current NestJS version
   */
  private getNestJSVersion(): string | null {
    try {
      // In a real implementation, this would read from package.json or require('@nestjs/core/package.json')
      // For now, we'll return a mock version
      return '10.0.0';
    } catch (error) {
      this.logger.debug('Could not determine NestJS version', error);
      return null;
    }
  }

  /**
   * Find a plugin by name
   */
  private findPluginByName(pluginName: string) {
    const allPlugins = this.metadataRepository.getAllPlugins();
    return allPlugins.find((plugin) => plugin.name === pluginName);
  }

  /**
   * Check compatibility for multiple plugins
   */
  checkMultipleCompatibility(pluginIds: string[]): Record<string, CompatibilityResult> {
    const results: Record<string, CompatibilityResult> = {};

    for (const pluginId of pluginIds) {
      try {
        results[pluginId] = this.checkCompatibility(pluginId);
      } catch (error) {
        this.logger.error(`Failed to check compatibility for ${pluginId}`, error);
        results[pluginId] = {
          compatible: false,
          reasons: ['Compatibility check failed'],
          suggestions: ['Please check plugin configuration'],
        };
      }
    }

    return results;
  }

  /**
   * Get compatibility summary for all plugins
   */
  getCompatibilitySummary() {
    const allPlugins = this.metadataRepository.getAllPlugins();
    const results = this.checkMultipleCompatibility(allPlugins.map((p) => p.id));

    const compatible = Object.values(results).filter((r) => r.compatible).length;
    const incompatible = Object.values(results).filter((r) => !r.compatible).length;

    return {
      total: allPlugins.length,
      compatible,
      incompatible,
      compatibilityRate: allPlugins.length > 0 ? (compatible / allPlugins.length) * 100 : 0,
      results,
    };
  }
}
