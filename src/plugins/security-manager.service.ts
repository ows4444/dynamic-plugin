import { Injectable, Logger } from '@nestjs/common';
import { IPlugin, Permission } from '../common/interfaces/plugin.interface';
import { PluginSecurityException } from '../common/exceptions/plugin.exceptions';
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface SecurityResult {
  isSecure: boolean;
  violations: string[];
  warnings: string[];
}

export interface SandboxOptions {
  memoryLimit: string;
  cpuLimit: string;
  networkAccess: 'none' | 'restricted' | 'full';
  fileSystemAccess: 'none' | 'read-only' | 'read-write';
  allowedModules: string[];
  timeoutMs: number;
  allowedPaths: string[];
  allowedNetworkHosts: string[];
  maxFileSize: number;
  maxNetworkRequests: number;
  restrictedAPIs: string[];
}

export interface PluginSandbox {
  id: string;
  options: SandboxOptions;
  resourceUsage: ResourceUsage;
  createdAt: Date;
  lastActivity: Date;
}

export interface ResourceUsage {
  memoryUsed: number;
  cpuUsed: number;
  networkBytesOut: number;
  networkBytesIn: number;
  fileSystemReads: number;
  fileSystemWrites: number;
  networkRequests: number;
  executionTime: number;
  diskUsage: number;
}

@Injectable()
export class SecurityManager {
  private readonly logger = new Logger(SecurityManager.name);
  private readonly sandboxes = new Map<string, PluginSandbox>();
  private readonly trustedPublicKeys = new Set<string>();
  private readonly resourceMonitors = new Map<string, NodeJS.Timeout>();
  private readonly violationHistory = new Map<string, string[]>();
  private readonly blacklistedPatterns = [
    'eval\\(',
    'Function\\(',
    'new Function',
    'process\\.exit',
    'process\\.kill',
    'require\\([\'"]child_process[\'"]\\)',
    'require\\([\'"]fs[\'"]\\)',
    'require\\([\'"]path[\'"]\\)',
    '\\.__proto__',
    '\\.constructor',
    'global\\.',
    'window\\.',
    'document\\.',
    'XMLHttpRequest',
    'fetch\\(',
    'import\\(',
    'require\\.cache',
    'module\\.exports',
    'exports\\.',
    'Buffer\\.from',
    'Buffer\\.alloc'
  ];

  constructor() {
    this.initializeTrustedKeys();
  }

  async validatePlugin(plugin: IPlugin, requiredPermissions: Permission[]): Promise<SecurityResult> {
    this.logger.log(`Validating plugin security: ${plugin.name}`);

    const result: SecurityResult = {
      isSecure: true,
      violations: [],
      warnings: []
    };

    // Check plugin permissions
    const permissionCheck = this.validatePermissions(plugin, requiredPermissions);
    result.violations.push(...permissionCheck.violations);
    result.warnings.push(...permissionCheck.warnings);

    // Scan for malicious patterns
    const codeCheck = await this.scanPluginCode(plugin);
    result.violations.push(...codeCheck.violations);
    result.warnings.push(...codeCheck.warnings);

    // Validate dependencies
    const dependencyCheck = await this.validateDependencies(plugin);
    result.violations.push(...dependencyCheck.violations);
    result.warnings.push(...dependencyCheck.warnings);

    result.isSecure = result.violations.length === 0;

    if (!result.isSecure) {
      this.logger.warn(`Plugin ${plugin.name} failed security validation:`, result.violations);
    } else if (result.warnings.length > 0) {
      this.logger.warn(`Plugin ${plugin.name} has security warnings:`, result.warnings);
    }

    return result;
  }

  async verifyPluginSignature(pluginPath: string): Promise<boolean> {
    try {
      const signaturePath = path.join(pluginPath, 'signature.sig');
      const manifestPath = path.join(pluginPath, 'plugin.manifest.json');

      if (!await fs.pathExists(signaturePath)) {
        this.logger.warn(`No signature found for plugin at ${pluginPath}`);
        return false;
      }

      const signature = await fs.readFile(signaturePath, 'utf-8');
      const manifest = await fs.readFile(manifestPath, 'utf-8');

      return this.verifySignature(manifest, signature);
    } catch (error) {
      this.logger.error(`Failed to verify plugin signature:`, error);
      return false;
    }
  }

  async createSandbox(pluginId: string, options: SandboxOptions): Promise<PluginSandbox> {
    this.logger.log(`Creating sandbox for plugin: ${pluginId}`);

    const sandbox: PluginSandbox = {
      id: pluginId,
      options,
      resourceUsage: {
        memoryUsed: 0,
        cpuUsed: 0,
        networkBytesOut: 0,
        networkBytesIn: 0,
        fileSystemReads: 0,
        fileSystemWrites: 0,
        networkRequests: 0,
        executionTime: 0,
        diskUsage: 0
      },
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sandboxes.set(pluginId, sandbox);
    this.startResourceMonitoring(pluginId);
    return sandbox;
  }

  async destroySandbox(pluginId: string): Promise<void> {
    this.logger.log(`Destroying sandbox for plugin: ${pluginId}`);
    
    // Stop resource monitoring
    const monitor = this.resourceMonitors.get(pluginId);
    if (monitor) {
      clearInterval(monitor);
      this.resourceMonitors.delete(pluginId);
    }
    
    this.sandboxes.delete(pluginId);
    this.violationHistory.delete(pluginId);
  }

  getSandbox(pluginId: string): PluginSandbox | undefined {
    return this.sandboxes.get(pluginId);
  }

  async monitorResourceUsage(pluginId: string): Promise<ResourceUsage> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      throw new Error(`Sandbox not found for plugin: ${pluginId}`);
    }

    // Monitor memory usage
    const memoryUsage = process.memoryUsage();
    sandbox.resourceUsage.memoryUsed = memoryUsage.heapUsed;

    // Monitor CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    sandbox.resourceUsage.cpuUsed = cpuUsage.user + cpuUsage.system;

    sandbox.lastActivity = new Date();
    return sandbox.resourceUsage;
  }

  checkPermission(pluginId: string, permission: string): boolean {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      return false;
    }

    // Check if plugin has the required permission
    // This would typically check against a permission matrix
    return true; // Simplified for now
  }

  async enforceResourceLimits(pluginId: string): Promise<boolean> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      return false;
    }

    const usage = sandbox.resourceUsage;
    const limits = sandbox.options;

    // Check memory limit
    const memoryLimitBytes = this.parseMemoryLimit(limits.memoryLimit);
    if (usage.memoryUsed > memoryLimitBytes) {
      this.recordViolation(pluginId, `Memory limit exceeded: ${usage.memoryUsed} > ${memoryLimitBytes}`);
      return false;
    }

    // Check CPU limit
    const cpuLimitPercent = parseInt(limits.cpuLimit.replace('%', ''));
    if (usage.cpuUsed > cpuLimitPercent) {
      this.recordViolation(pluginId, `CPU limit exceeded: ${usage.cpuUsed}% > ${cpuLimitPercent}%`);
      return false;
    }

    // Check network requests
    if (usage.networkRequests > limits.maxNetworkRequests) {
      this.recordViolation(pluginId, `Network requests exceeded: ${usage.networkRequests} > ${limits.maxNetworkRequests}`);
      return false;
    }

    // Check execution time
    if (usage.executionTime > limits.timeoutMs) {
      this.recordViolation(pluginId, `Execution time exceeded: ${usage.executionTime}ms > ${limits.timeoutMs}ms`);
      return false;
    }

    return true;
  }

  async validateNetworkAccess(pluginId: string, host: string): Promise<boolean> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      return false;
    }

    const { networkAccess, allowedNetworkHosts } = sandbox.options;

    if (networkAccess === 'none') {
      this.recordViolation(pluginId, `Network access denied: ${host}`);
      return false;
    }

    if (networkAccess === 'restricted') {
      if (!allowedNetworkHosts.includes(host)) {
        this.recordViolation(pluginId, `Network host not allowed: ${host}`);
        return false;
      }
    }

    return true;
  }

  async validateFileSystemAccess(pluginId: string, filePath: string, operation: 'read' | 'write'): Promise<boolean> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      return false;
    }

    const { fileSystemAccess, allowedPaths } = sandbox.options;

    if (fileSystemAccess === 'none') {
      this.recordViolation(pluginId, `File system access denied: ${filePath}`);
      return false;
    }

    if (fileSystemAccess === 'read-only' && operation === 'write') {
      this.recordViolation(pluginId, `Write access denied: ${filePath}`);
      return false;
    }

    // Check if path is allowed
    const isAllowed = allowedPaths.some(allowedPath => 
      filePath.startsWith(allowedPath)
    );

    if (!isAllowed) {
      this.recordViolation(pluginId, `File path not allowed: ${filePath}`);
      return false;
    }

    return true;
  }

  async createSecureRequire(pluginId: string): Promise<NodeRequire> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      throw new Error(`Sandbox not found for plugin: ${pluginId}`);
    }

    const { allowedModules, restrictedAPIs } = sandbox.options;

    return new Proxy(require, {
      apply: (target, thisArg, args) => {
        const moduleName = args[0];
        
        // Check if module is allowed
        if (!allowedModules.includes(moduleName)) {
          throw new Error(`Module not allowed: ${moduleName}`);
        }

        // Check for restricted APIs
        const moduleExports = target.apply(thisArg, args);
        
        return new Proxy(moduleExports, {
          get: (target, prop) => {
            if (restrictedAPIs.includes(`${moduleName}.${String(prop)}`)) {
              throw new Error(`API not allowed: ${moduleName}.${String(prop)}`);
            }
            return target[prop];
          }
        });
      }
    });
  }

  getViolationHistory(pluginId: string): string[] {
    return this.violationHistory.get(pluginId) || [];
  }

  private startResourceMonitoring(pluginId: string): void {
    const monitor = setInterval(async () => {
      try {
        await this.monitorResourceUsage(pluginId);
        await this.enforceResourceLimits(pluginId);
      } catch (error) {
        this.logger.error(`Resource monitoring failed for plugin ${pluginId}:`, error);
      }
    }, 5000); // Monitor every 5 seconds

    this.resourceMonitors.set(pluginId, monitor);
  }

  private recordViolation(pluginId: string, violation: string): void {
    if (!this.violationHistory.has(pluginId)) {
      this.violationHistory.set(pluginId, []);
    }
    
    const violations = this.violationHistory.get(pluginId);
    violations.push(`${new Date().toISOString()}: ${violation}`);
    
    // Keep only last 100 violations
    if (violations.length > 100) {
      violations.shift();
    }
    
    this.logger.warn(`Security violation for plugin ${pluginId}: ${violation}`);
  }

  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/(\d+)(MB|GB|KB)/);
    if (!match) {
      return 128 * 1024 * 1024; // Default 128MB
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'KB':
        return value * 1024;
      case 'MB':
        return value * 1024 * 1024;
      case 'GB':
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  private validatePermissions(plugin: IPlugin, requiredPermissions: Permission[]): SecurityResult {
    const result: SecurityResult = {
      isSecure: true,
      violations: [],
      warnings: []
    };

    const pluginPermissions = plugin.requiredPermissions || [];

    // Check for excessive permissions
    const dangerousPermissions = ['system:admin', 'network:unrestricted', 'file:write'];
    for (const permission of pluginPermissions) {
      if (dangerousPermissions.includes(permission.name)) {
        result.warnings.push(`Plugin requests dangerous permission: ${permission.name}`);
      }
    }

    // Check for missing required permissions
    for (const required of requiredPermissions) {
      const hasPermission = pluginPermissions.some(p => 
        p.name === required.name && p.level === required.level
      );
      
      if (!hasPermission) {
        result.violations.push(`Plugin missing required permission: ${required.name}`);
      }
    }

    return result;
  }

  private async scanPluginCode(plugin: IPlugin): Promise<SecurityResult> {
    const result: SecurityResult = {
      isSecure: true,
      violations: [],
      warnings: []
    };

    try {
      const pluginCode = plugin.toString();
      
      for (const pattern of this.blacklistedPatterns) {
        const regex = new RegExp(pattern, 'g');
        if (regex.test(pluginCode)) {
          result.violations.push(`Detected potentially malicious pattern: ${pattern}`);
        }
      }

      // Check for suspicious imports
      const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(pluginCode)) !== null) {
        const importPath = match[1];
        if (this.isSuspiciousImport(importPath)) {
          result.warnings.push(`Suspicious import detected: ${importPath}`);
        }
      }

      // Check for dynamic require statements
      const dynamicRequireRegex = /require\s*\(\s*[^'"]/g;
      if (dynamicRequireRegex.test(pluginCode)) {
        result.violations.push('Dynamic require statements are not allowed');
      }

    } catch (error) {
      result.violations.push(`Failed to scan plugin code: ${error.message}`);
    }

    return result;
  }

  private async validateDependencies(plugin: IPlugin): Promise<SecurityResult> {
    const result: SecurityResult = {
      isSecure: true,
      violations: [],
      warnings: []
    };

    const dependencies = plugin.dependencies || [];
    const knownVulnerabilities = [
      'lodash@4.17.20',
      'moment@2.29.1',
      'axios@0.21.0'
    ];

    for (const dependency of dependencies) {
      const dependencyString = `${dependency.name}@${dependency.version}`;
      
      if (knownVulnerabilities.includes(dependencyString)) {
        result.violations.push(`Dependency has known vulnerabilities: ${dependencyString}`);
      }

      // Check for suspicious package names
      if (this.isSuspiciousPackage(dependency.name)) {
        result.warnings.push(`Suspicious package name: ${dependency.name}`);
      }
    }

    return result;
  }

  private isSuspiciousImport(importPath: string): boolean {
    const suspiciousPatterns = [
      'child_process',
      'fs',
      'path',
      'os',
      'cluster',
      'worker_threads',
      'vm',
      'isolated-vm',
      'repl',
      'readline',
      'dgram',
      'net',
      'tls',
      'crypto',
      'https',
      'http'
    ];

    return suspiciousPatterns.some(pattern => importPath.includes(pattern));
  }

  private isSuspiciousPackage(packageName: string): boolean {
    const suspiciousPatterns = [
      /^[0-9]+$/,
      /^[a-z]{1,3}$/,
      /discord/i,
      /bitcoin/i,
      /crypto/i,
      /wallet/i,
      /miner/i,
      /keylogger/i,
      /backdoor/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(packageName));
  }

  private verifySignature(content: string, signature: string): boolean {
    try {
      for (const publicKey of this.trustedPublicKeys) {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(content);
        
        if (verifier.verify(publicKey, signature, 'base64')) {
          return true;
        }
      }
      return false;
    } catch (error) {
      this.logger.error('Failed to verify signature:', error);
      return false;
    }
  }

  private initializeTrustedKeys(): void {
    // Load trusted public keys for plugin verification
    // This would typically be loaded from a secure configuration
    const examplePublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----`;
    
    this.trustedPublicKeys.add(examplePublicKey);
  }
}