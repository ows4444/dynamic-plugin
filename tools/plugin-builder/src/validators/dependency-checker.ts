import { getErrorMessage } from '@lib/shared/common';
import { Injectable, Logger } from '@nestjs/common';
import * as semver from 'semver';

export interface DependencyCheckResult {
  valid: boolean;
  dependencies: DependencyAnalysis[];
  conflicts: ConflictAnalysis[];
  vulnerabilities: VulnerabilityAnalysis[];
  recommendations: string[];
  summary: {
    total: number;
    valid: number;
    conflicts: number;
    vulnerabilities: number;
    outdated: number;
  };
}

export interface DependencyAnalysis {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
  status: 'valid' | 'invalid' | 'outdated' | 'vulnerable' | 'conflict';
  issues: string[];
  latest?: string;
  deprecated?: boolean;
}

export interface ConflictAnalysis {
  dependency: string;
  conflicts: Array<{
    with: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

interface PackageJsonLike {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface VulnerabilityAnalysis {
  dependency: string;
  version: string;
  vulnerabilities: Array<{
    id: string;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    title: string;
    description: string;
    patched?: string[];
  }>;
}

@Injectable()
export class DependencyChecker {
  private readonly logger = new Logger(DependencyChecker.name);
  private readonly knownVulnerabilities = new Map<string, VulnerabilityAnalysis['vulnerabilities']>();
  private readonly deprecatedPackages = new Set<string>();

  constructor() {
    this.initializeKnownIssues();
  }

  async checkDependencies(packageJson: PackageJsonLike): Promise<DependencyCheckResult> {
    const result: DependencyCheckResult = {
      valid: true,
      dependencies: [],
      conflicts: [],
      vulnerabilities: [],
      recommendations: [],
      summary: {
        total: 0,
        valid: 0,
        conflicts: 0,
        vulnerabilities: 0,
        outdated: 0,
      },
    };

    try {
      const allDependencies = this.extractAllDependencies(packageJson);
      result.summary.total = allDependencies.length;

      // Analyze each dependency
      for (const dep of allDependencies) {
        const analysis = await this.analyzeDependency(dep);
        result.dependencies.push(analysis);

        if (analysis.status === 'valid') {
          result.summary.valid++;
        } else if (analysis.status === 'conflict') {
          result.summary.conflicts++;
        } else if (analysis.status === 'vulnerable') {
          result.summary.vulnerabilities++;
        } else if (analysis.status === 'outdated') {
          result.summary.outdated++;
        }

        if (analysis.status !== 'valid') {
          result.valid = false;
        }
      }

      // Check for conflicts between dependencies
      result.conflicts = await this.findConflicts(allDependencies);
      result.summary.conflicts = result.conflicts.length;

      // Check for vulnerabilities
      result.vulnerabilities = await this.findVulnerabilities(allDependencies);
      result.summary.vulnerabilities = result.vulnerabilities.length;

      // Generate recommendations
      result.recommendations = this.generateRecommendations(result);

    } catch (error) {
      this.logger.error(`Dependency check failed: ${getErrorMessage(error)}`);
      result.valid = false;
      result.recommendations.push(`Dependency analysis failed: ${getErrorMessage(error)}`);
    }

    return result;
  }

  async checkCompatibility(
    pluginDependencies: Record<string, string>,
    hostDependencies: Record<string, string>,
  ): Promise<{
    compatible: boolean;
    conflicts: Array<{
      dependency: string;
      pluginVersion: string;
      hostVersion: string;
      reason: string;
    }>;
  }> {
    const conflicts: Array<{
      dependency: string;
      pluginVersion: string;
      hostVersion: string;
      reason: string;
    }> = [];

    for (const [name, pluginVersion] of Object.entries(pluginDependencies)) {
      const hostVersion = hostDependencies[name];

      if (hostVersion) {
        const isCompatible = this.areVersionsCompatible(pluginVersion, hostVersion);

        if (!isCompatible) {
          conflicts.push({
            dependency: name,
            pluginVersion,
            hostVersion,
            reason: `Plugin requires ${pluginVersion} but host provides ${hostVersion}`,
          });
        }
      }
    }

    return {
      compatible: conflicts.length === 0,
      conflicts,
    };
  }

  async suggestUpdates(dependencies: Record<string, string>): Promise<Array<{
    name: string;
    current: string;
    latest: string;
    type: 'major' | 'minor' | 'patch';
    breaking: boolean;
  }>> {
    const suggestions: Array<{
      name: string;
      current: string;
      latest: string;
      type: 'major' | 'minor' | 'patch';
      breaking: boolean;
    }> = [];

    for (const [name, version] of Object.entries(dependencies)) {
      try {
        const latest = await this.getLatestVersion(name);
        
        if (latest && semver.gt(latest, version)) {
          const diff = semver.diff(version, latest);
          
          suggestions.push({
            name,
            current: version,
            latest,
            type: diff as 'major' | 'minor' | 'patch',
            breaking: diff === 'major',
          });
        }
      } catch (error) {
        this.logger.debug(`Could not check latest version for ${name}: ${getErrorMessage(error)}`);
      }
    }

    return suggestions.sort((a, b) => {
      if (a.breaking !== b.breaking) {
        return a.breaking ? 1 : -1; // Non-breaking first
      }
      return a.name.localeCompare(b.name);
    });
  }

  private extractAllDependencies(packageJson: PackageJsonLike): Array<{
    name: string;
    version: string;
    type: 'dependency' | 'devDependency' | 'peerDependency';
  }> {
    const dependencies: Array<{
      name: string;
      version: string;
      type: 'dependency' | 'devDependency' | 'peerDependency';
    }> = [];

    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        dependencies.push({ name, version: version as string, type: 'dependency' as const });
      }
    }

    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        dependencies.push({ name, version: version as string, type: 'devDependency' as const });
      }
    }

    if (packageJson.peerDependencies) {
      for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
        dependencies.push({ name, version: version as string, type: 'peerDependency' as const });
      }
    }

    return dependencies;
  }

  private async analyzeDependency(dep: {
    name: string;
    version: string;
    type: string;
  }): Promise<DependencyAnalysis> {
    const analysis: DependencyAnalysis = {
      name: dep.name,
      version: dep.version,
      type: dep.type as 'dependency' | 'devDependency' | 'peerDependency',
      status: 'valid',
      issues: [],
    };

    try {
      // Check if version is valid semver
      if (!semver.validRange(dep.version)) {
        analysis.status = 'invalid';
        analysis.issues.push('Invalid version range');
      }

      // Check for deprecated packages
      if (this.deprecatedPackages.has(dep.name)) {
        analysis.deprecated = true;
        analysis.issues.push('Package is deprecated');
        analysis.status = 'outdated';
      }

      // Check for known vulnerabilities
      const vulnerabilities = this.knownVulnerabilities.get(dep.name);
      if (vulnerabilities && vulnerabilities.length > 0) {
        const affectsVersion = vulnerabilities.some(vuln => {
          return vuln.patched ? !vuln.patched.some(patch => semver.gte(dep.version, patch)) : true;
        });

        if (affectsVersion) {
          analysis.status = 'vulnerable';
          analysis.issues.push('Has known security vulnerabilities');
        }
      }

      // Check for suspicious packages
      if (this.isSuspiciousPackage(dep.name)) {
        analysis.issues.push('Package name is suspicious or typosquatting');
        analysis.status = 'invalid';
      }

      // Get latest version
      try {
        analysis.latest = await this.getLatestVersion(dep.name);
        
        if (analysis.latest && semver.lt(dep.version.replace(/[^0-9.]/g, ''), analysis.latest)) {
          analysis.issues.push(`Newer version available (${analysis.latest})`);
          if (analysis.status === 'valid') {
            analysis.status = 'outdated';
          }
        }
      } catch (error) {
        // Ignore errors when fetching latest version
      }

    } catch (error) {
      analysis.status = 'invalid';
      analysis.issues.push(`Analysis failed: ${getErrorMessage(error)}`);
    }

    return analysis;
  }

  private async findConflicts(
    dependencies: Array<{ name: string; version: string; type: string }>,
  ): Promise<ConflictAnalysis[]> {
    const conflicts: ConflictAnalysis[] = [];
    const dependencyMap = new Map<string, Array<{ version: string; type: string }>>();

    // Group dependencies by name
    for (const dep of dependencies) {
      if (!dependencyMap.has(dep.name)) {
        dependencyMap.set(dep.name, []);
      }
      dependencyMap.get(dep.name)!.push({ version: dep.version, type: dep.type });
    }

    // Check for version conflicts
    for (const [name, versions] of dependencyMap) {
      if (versions.length > 1) {
        const uniqueVersions = [...new Set(versions.map(v => v.version))];
        
        if (uniqueVersions.length > 1) {
          const conflictAnalysis: ConflictAnalysis = {
            dependency: name,
            conflicts: [],
          };

          for (let i = 0; i < uniqueVersions.length; i++) {
            for (let j = i + 1; j < uniqueVersions.length; j++) {
              const version1 = uniqueVersions[i];
              const version2 = uniqueVersions[j];

              if (!this.areVersionsCompatible(version1, version2)) {
                conflictAnalysis.conflicts.push({
                  with: version2,
                  reason: `Version ${version1} conflicts with ${version2}`,
                  severity: 'high',
                });
              }
            }
          }

          if (conflictAnalysis.conflicts.length > 0) {
            conflicts.push(conflictAnalysis);
          }
        }
      }
    }

    // Check for peer dependency conflicts
    const peerDeps = dependencies.filter(d => d.type === 'peerDependency');
    const regularDeps = dependencies.filter(d => d.type === 'dependency');

    for (const peerDep of peerDeps) {
      const regularDep = regularDeps.find(d => d.name === peerDep.name);
      
      if (regularDep && !this.areVersionsCompatible(peerDep.version, regularDep.version)) {
        conflicts.push({
          dependency: peerDep.name,
          conflicts: [{
            with: regularDep.version,
            reason: `Peer dependency ${peerDep.version} conflicts with regular dependency ${regularDep.version}`,
            severity: 'medium',
          }],
        });
      }
    }

    return conflicts;
  }

  private async findVulnerabilities(
    dependencies: Array<{ name: string; version: string; type: string }>,
  ): Promise<VulnerabilityAnalysis[]> {
    const vulnerabilities: VulnerabilityAnalysis[] = [];

    for (const dep of dependencies) {
      const knownVulns = this.knownVulnerabilities.get(dep.name);
      
      if (knownVulns) {
        const applicableVulns = knownVulns.filter(vuln => {
          if (!vuln.patched || vuln.patched.length === 0) {
            return true; // No patch available, vulnerability applies
          }
          
          // Check if current version is before any patched version
          return !vuln.patched.some(patchVersion => semver.gte(dep.version, patchVersion));
        });

        if (applicableVulns.length > 0) {
          vulnerabilities.push({
            dependency: dep.name,
            version: dep.version,
            vulnerabilities: applicableVulns,
          });
        }
      }
    }

    return vulnerabilities;
  }

  private generateRecommendations(result: DependencyCheckResult): string[] {
    const recommendations: string[] = [];

    if (result.summary.vulnerabilities > 0) {
      recommendations.push(`Found ${result.summary.vulnerabilities} vulnerable dependencies. Update to secure versions.`);
    }

    if (result.summary.conflicts > 0) {
      recommendations.push(`Found ${result.summary.conflicts} dependency conflicts. Resolve version mismatches.`);
    }

    if (result.summary.outdated > 5) {
      recommendations.push(`${result.summary.outdated} dependencies are outdated. Consider updating.`);
    }

    if (result.summary.total > 100) {
      recommendations.push('High number of dependencies may impact bundle size and security.');
    }

    // Check for duplicate functionality
    const duplicateFunctionality = this.findDuplicateFunctionality(result.dependencies);
    if (duplicateFunctionality.length > 0) {
      recommendations.push(`Consider consolidating similar packages: ${duplicateFunctionality.join(', ')}`);
    }

    // Check for unused dependencies
    recommendations.push('Review dependencies to ensure all are actually used.');

    return recommendations;
  }

  private findDuplicateFunctionality(dependencies: DependencyAnalysis[]): string[] {
    const duplicates: string[] = [];
    const functionalityGroups = {
      'http-clients': ['axios', 'node-fetch', 'superagent', 'got', 'request'],
      'lodash-alternatives': ['lodash', 'underscore', 'ramda'],
      'date-libraries': ['moment', 'dayjs', 'date-fns'],
      'testing': ['jest', 'mocha', 'jasmine', 'ava'],
      'linting': ['eslint', 'tslint', 'jshint'],
    };

    for (const [groupName, packages] of Object.entries(functionalityGroups)) {
      const found = packages.filter(pkg => 
        dependencies.some(dep => dep.name === pkg)
      );

      if (found.length > 1) {
        duplicates.push(`${groupName}: ${found.join(', ')}`);
      }
    }

    return duplicates;
  }

  private areVersionsCompatible(version1: string, version2: string): boolean {
    try {
      const range1 = semver.validRange(version1);
      const range2 = semver.validRange(version2);

      if (!range1 || !range2) {
        return false;
      }

      // Simple compatibility check - in practice, this would be more sophisticated
      return semver.intersects(range1, range2);
    } catch {
      return false;
    }
  }

  private async getLatestVersion(packageName: string): Promise<string | undefined> {
    // This is a mock implementation - in practice, you'd query npm registry
    // For now, return undefined to skip version checking
    return undefined;
  }

  private isSuspiciousPackage(name: string): boolean {
    // Check for common typosquatting patterns
    const suspiciousPatterns = [
      /^[a-z]+\d+$/, // packages ending with numbers
      /^[a-z]{1,3}$/, // very short names
      /[0O1lI]{2,}/, // confusing characters
    ];

    return suspiciousPatterns.some(pattern => pattern.test(name));
  }

  private initializeKnownIssues(): void {
    // Initialize with some known vulnerable packages
    this.knownVulnerabilities.set('event-stream', [{
      id: 'CVE-2018-3728',
      severity: 'critical',
      title: 'Malicious code injection',
      description: 'Package contained malicious code',
      patched: [],
    }]);

    this.knownVulnerabilities.set('eslint-scope', [{
      id: 'CVE-2018-7408',
      severity: 'critical',
      title: 'Malicious package',
      description: 'Package was compromised with malicious code',
      patched: ['3.7.2'],
    }]);

    // Known deprecated packages
    this.deprecatedPackages.add('request');
    this.deprecatedPackages.add('node-uuid');
    this.deprecatedPackages.add('bower');
  }
}