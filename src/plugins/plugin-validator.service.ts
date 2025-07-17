import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SecurityManager } from './security-manager.service';
import { PluginManifest } from '../common/interfaces/plugin.interface';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'performance' | 'compatibility' | 'structure';
  validator: (context: ValidationContext) => Promise<ValidationResult>;
  enabled: boolean;
}

export interface ValidationContext {
  pluginId: string;
  pluginPath: string;
  manifest: PluginManifest;
  sourceCode: string[];
  dependencies: string[];
  size: number;
}

export interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
  suggestions?: string[];
}

export interface ValidationReport {
  pluginId: string;
  timestamp: Date;
  passed: boolean;
  score: number;
  results: Array<{
    rule: ValidationRule;
    result: ValidationResult;
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    errors: number;
    critical: number;
  };
}

export interface ScanResult {
  pluginId: string;
  timestamp: Date;
  vulnerabilities: Vulnerability[];
  malwareDetected: boolean;
  riskScore: number;
  recommendations: string[];
}

export interface Vulnerability {
  id: string;
  type: 'dependency' | 'code' | 'configuration' | 'permission';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  cve?: string;
  fixVersion?: string;
  location?: string;
}

@Injectable()
export class PluginValidatorService {
  private readonly logger = new Logger(PluginValidatorService.name);
  private readonly validationRules = new Map<string, ValidationRule>();
  private readonly scanHistory = new Map<string, ScanResult[]>();
  private readonly validationHistory = new Map<string, ValidationReport[]>();

  constructor(
    private readonly securityManager: SecurityManager,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.initializeDefaultRules();
  }

  async validatePlugin(pluginId: string): Promise<ValidationReport> {
    this.logger.log(`Validating plugin: ${pluginId}`);

    const context = await this.buildValidationContext(pluginId);
    const results = [];
    let totalScore = 0;
    let maxScore = 0;

    const summary = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: 0,
      critical: 0
    };

    // Run all enabled validation rules
    const enabledRules = Array.from(this.validationRules.values())
      .filter(rule => rule.enabled);

    for (const rule of enabledRules) {
      try {
        const result = await rule.validator(context);
        results.push({ rule, result });

        summary.total++;
        
        if (result.passed) {
          summary.passed++;
          totalScore += this.getRuleScore(rule.severity);
        } else {
          summary.failed++;
          
          switch (rule.severity) {
            case 'low':
              summary.warnings++;
              break;
            case 'medium':
              summary.errors++;
              break;
            case 'high':
            case 'critical':
              summary.critical++;
              break;
          }
        }

        maxScore += this.getRuleScore(rule.severity);
      } catch (error) {
        this.logger.error(`Validation rule ${rule.id} failed:`, error);
        
        results.push({
          rule,
          result: {
            passed: false,
            message: `Validation rule failed: ${error.message}`
          }
        });
        
        summary.total++;
        summary.failed++;
        summary.errors++;
      }
    }

    const score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const passed = summary.critical === 0 && summary.errors < 3;

    const report: ValidationReport = {
      pluginId,
      timestamp: new Date(),
      passed,
      score,
      results,
      summary
    };

    // Store in history
    this.storeValidationReport(report);

    // Emit validation event
    this.eventEmitter.emit('plugin.validation.completed', {
      pluginId,
      report,
      timestamp: new Date()
    });

    this.logger.log(`Validation completed for ${pluginId}: ${passed ? 'PASSED' : 'FAILED'} (Score: ${score})`);
    return report;
  }

  async scanForVulnerabilities(pluginId: string): Promise<ScanResult> {
    this.logger.log(`Scanning for vulnerabilities: ${pluginId}`);

    const context = await this.buildValidationContext(pluginId);
    const vulnerabilities: Vulnerability[] = [];
    let malwareDetected = false;
    const recommendations: string[] = [];

    try {
      // Scan dependencies for known vulnerabilities
      const depVulns = await this.scanDependencies(context);
      vulnerabilities.push(...depVulns);

      // Scan source code for security issues
      const codeVulns = await this.scanSourceCode(context);
      vulnerabilities.push(...codeVulns);

      // Scan for malware patterns
      malwareDetected = await this.scanForMalware(context);

      // Scan permissions
      const permVulns = await this.scanPermissions(context);
      vulnerabilities.push(...permVulns);

      // Generate recommendations
      recommendations.push(...this.generateRecommendations(vulnerabilities));

      // Calculate risk score
      const riskScore = this.calculateRiskScore(vulnerabilities, malwareDetected);

      const result: ScanResult = {
        pluginId,
        timestamp: new Date(),
        vulnerabilities,
        malwareDetected,
        riskScore,
        recommendations
      };

      // Store in history
      this.storeScanResult(result);

      // Emit scan event
      this.eventEmitter.emit('plugin.security.scanned', {
        pluginId,
        result,
        timestamp: new Date()
      });

      this.logger.log(`Security scan completed for ${pluginId}: ${vulnerabilities.length} vulnerabilities found`);
      return result;
    } catch (error) {
      this.logger.error(`Security scan failed for ${pluginId}:`, error);
      throw error;
    }
  }

  registerValidationRule(rule: ValidationRule): void {
    this.validationRules.set(rule.id, rule);
    this.logger.log(`Registered validation rule: ${rule.id}`);
  }

  enableRule(ruleId: string): void {
    const rule = this.validationRules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      this.logger.log(`Enabled validation rule: ${ruleId}`);
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.validationRules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      this.logger.log(`Disabled validation rule: ${ruleId}`);
    }
  }

  getValidationHistory(pluginId: string): ValidationReport[] {
    return this.validationHistory.get(pluginId) || [];
  }

  getScanHistory(pluginId: string): ScanResult[] {
    return this.scanHistory.get(pluginId) || [];
  }

  getValidationRules(): ValidationRule[] {
    return Array.from(this.validationRules.values());
  }

  private async buildValidationContext(pluginId: string): Promise<ValidationContext> {
    const pluginPath = path.join(process.cwd(), 'plugins', pluginId);
    
    if (!await fs.pathExists(pluginPath)) {
      throw new Error(`Plugin path not found: ${pluginPath}`);
    }

    // Read manifest
    const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
    const manifest = await fs.readJson(manifestPath);

    // Read source code files
    const sourceCode = await this.readSourceFiles(pluginPath);

    // Get dependencies
    const dependencies = await this.extractDependencies(pluginPath);

    // Calculate size
    const size = await this.calculatePluginSize(pluginPath);

    return {
      pluginId,
      pluginPath,
      manifest,
      sourceCode,
      dependencies,
      size
    };
  }

  private async readSourceFiles(pluginPath: string): Promise<string[]> {
    const sourceFiles = [];
    const extensions = ['.js', '.ts', '.mjs', '.json'];

    const readDir = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await readDir(fullPath);
        } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
          const content = await fs.readFile(fullPath, 'utf-8');
          sourceFiles.push(content);
        }
      }
    };

    await readDir(pluginPath);
    return sourceFiles;
  }

  private async extractDependencies(pluginPath: string): Promise<string[]> {
    const packagePath = path.join(pluginPath, 'package.json');
    
    if (await fs.pathExists(packagePath)) {
      const packageJson = await fs.readJson(packagePath);
      return Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      });
    }

    return [];
  }

  private async calculatePluginSize(pluginPath: string): Promise<number> {
    let totalSize = 0;

    const calculateSize = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await calculateSize(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    };

    await calculateSize(pluginPath);
    return totalSize;
  }

  private async scanDependencies(context: ValidationContext): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    
    // This would integrate with vulnerability databases like CVE, NPM audit, etc.
    // For now, we'll use a simple check against known vulnerable packages
    const knownVulnerable = [
      { name: 'lodash', version: '4.17.20', cve: 'CVE-2021-23337' },
      { name: 'axios', version: '0.21.0', cve: 'CVE-2021-3749' },
      { name: 'moment', version: '2.29.1', cve: 'CVE-2022-24785' }
    ];

    for (const dep of context.dependencies) {
      for (const vuln of knownVulnerable) {
        if (dep.includes(vuln.name)) {
          vulnerabilities.push({
            id: `dep-${vuln.name}`,
            type: 'dependency',
            severity: 'high',
            description: `Vulnerable dependency: ${vuln.name}`,
            cve: vuln.cve,
            fixVersion: 'latest',
            location: 'package.json'
          });
        }
      }
    }

    return vulnerabilities;
  }

  private async scanSourceCode(context: ValidationContext): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    
    // Scan for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/g, severity: 'critical' as const, desc: 'Use of eval() function' },
      { pattern: /innerHTML\s*=/g, severity: 'high' as const, desc: 'Potential XSS vulnerability' },
      { pattern: /document\.write\s*\(/g, severity: 'medium' as const, desc: 'Use of document.write()' },
      { pattern: /process\.exit\s*\(/g, severity: 'medium' as const, desc: 'Process exit call' }
    ];

    for (const code of context.sourceCode) {
      for (const dangerous of dangerousPatterns) {
        const matches = code.match(dangerous.pattern);
        if (matches) {
          vulnerabilities.push({
            id: `code-${dangerous.desc.toLowerCase().replace(/\s+/g, '-')}`,
            type: 'code',
            severity: dangerous.severity,
            description: dangerous.desc,
            location: 'source code'
          });
        }
      }
    }

    return vulnerabilities;
  }

  private async scanForMalware(context: ValidationContext): Promise<boolean> {
    // Simple malware detection based on suspicious patterns
    const malwarePatterns = [
      /bitcoin/i,
      /cryptocurrency/i,
      /keylogger/i,
      /backdoor/i,
      /trojan/i,
      /ransomware/i
    ];

    for (const code of context.sourceCode) {
      for (const pattern of malwarePatterns) {
        if (pattern.test(code)) {
          return true;
        }
      }
    }

    return false;
  }

  private async scanPermissions(context: ValidationContext): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    const dangerousPerms = ['system:admin', 'file:write', 'network:unrestricted'];

    if (context.manifest.requiredPermissions) {
      for (const perm of context.manifest.requiredPermissions) {
        if (dangerousPerms.includes(perm.name)) {
          vulnerabilities.push({
            id: `perm-${perm.name}`,
            type: 'permission',
            severity: 'high',
            description: `Dangerous permission requested: ${perm.name}`,
            location: 'manifest'
          });
        }
      }
    }

    return vulnerabilities;
  }

  private generateRecommendations(vulnerabilities: Vulnerability[]): string[] {
    const recommendations = [];

    if (vulnerabilities.some(v => v.type === 'dependency')) {
      recommendations.push('Update dependencies to latest versions');
    }

    if (vulnerabilities.some(v => v.type === 'code')) {
      recommendations.push('Review code for security issues');
    }

    if (vulnerabilities.some(v => v.type === 'permission')) {
      recommendations.push('Review required permissions');
    }

    return recommendations;
  }

  private calculateRiskScore(vulnerabilities: Vulnerability[], malwareDetected: boolean): number {
    let score = 0;

    if (malwareDetected) {
      score += 50;
    }

    for (const vuln of vulnerabilities) {
      switch (vuln.severity) {
        case 'critical':
          score += 25;
          break;
        case 'high':
          score += 15;
          break;
        case 'medium':
          score += 8;
          break;
        case 'low':
          score += 3;
          break;
      }
    }

    return Math.min(100, score);
  }

  private getRuleScore(severity: string): number {
    switch (severity) {
      case 'critical':
        return 25;
      case 'high':
        return 15;
      case 'medium':
        return 8;
      case 'low':
        return 3;
      default:
        return 1;
    }
  }

  private storeValidationReport(report: ValidationReport): void {
    if (!this.validationHistory.has(report.pluginId)) {
      this.validationHistory.set(report.pluginId, []);
    }

    const history = this.validationHistory.get(report.pluginId);
    history.push(report);

    // Keep only last 50 reports
    if (history.length > 50) {
      history.shift();
    }
  }

  private storeScanResult(result: ScanResult): void {
    if (!this.scanHistory.has(result.pluginId)) {
      this.scanHistory.set(result.pluginId, []);
    }

    const history = this.scanHistory.get(result.pluginId);
    history.push(result);

    // Keep only last 50 scans
    if (history.length > 50) {
      history.shift();
    }
  }

  private initializeDefaultRules(): void {
    // Manifest validation rules
    this.registerValidationRule({
      id: 'manifest-required-fields',
      name: 'Manifest Required Fields',
      description: 'Validates that all required fields are present in the manifest',
      severity: 'critical',
      category: 'structure',
      enabled: true,
      validator: async (context) => {
        const required = ['name', 'version', 'description', 'main'];
        const missing = required.filter(field => !context.manifest[field]);
        
        return {
          passed: missing.length === 0,
          message: missing.length > 0 
            ? `Missing required fields: ${missing.join(', ')}`
            : 'All required fields present',
          suggestions: missing.length > 0 
            ? [`Add missing fields: ${missing.join(', ')}`]
            : []
        };
      }
    });

    // Security validation rules
    this.registerValidationRule({
      id: 'security-dangerous-permissions',
      name: 'Dangerous Permissions',
      description: 'Checks for dangerous permission requests',
      severity: 'high',
      category: 'security',
      enabled: true,
      validator: async (context) => {
        const dangerous = ['system:admin', 'file:write', 'network:unrestricted'];
        const requested = context.manifest.requiredPermissions || [];
        const found = requested.filter(p => dangerous.includes(p.name));
        
        return {
          passed: found.length === 0,
          message: found.length > 0 
            ? `Dangerous permissions requested: ${found.map(p => p.name).join(', ')}`
            : 'No dangerous permissions requested',
          suggestions: found.length > 0 
            ? ['Review if these permissions are necessary']
            : []
        };
      }
    });

    // Size validation rule
    this.registerValidationRule({
      id: 'plugin-size-limit',
      name: 'Plugin Size Limit',
      description: 'Validates that plugin size is within acceptable limits',
      severity: 'medium',
      category: 'performance',
      enabled: true,
      validator: async (context) => {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const passed = context.size <= maxSize;
        
        return {
          passed,
          message: passed 
            ? `Plugin size is acceptable: ${(context.size / 1024 / 1024).toFixed(2)}MB`
            : `Plugin size exceeds limit: ${(context.size / 1024 / 1024).toFixed(2)}MB > ${maxSize / 1024 / 1024}MB`,
          suggestions: passed ? [] : ['Consider reducing plugin size by removing unnecessary files']
        };
      }
    });

    this.logger.log('Initialized default validation rules');
  }
}