import { getErrorMessage } from '@lib/shared/common';
import { Injectable, Logger } from '@nestjs/common';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExtractedFile {
  path: string;
  content: Buffer;
}

export interface PackageJsonData {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface PluginManifestData {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  pluginType?: string;
  apiVersion?: string;
  permissions?: string[];
  dependencies?: Record<string, string>;
  engines?: {
    host?: string;
    [key: string]: unknown;
  };
  config?: Record<string, unknown>;
  routes?: PluginRouteData[];
  hooks?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PluginRouteData {
  path?: string;
  method?: string;
  handler?: string;
  [key: string]: unknown;
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  async validateManifest(manifest: PluginManifestData): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Required fields
      const requiredFields = [
        'name',
        'version',
        'description',
        'main',
        'pluginType',
        'apiVersion',
      ];

      for (const field of requiredFields) {
        if (!(manifest[field])) {
          result.errors.push(`Missing required field: ${field}`);
          result.valid = false;
        }
      }

      // Validate name format
      if (manifest.name && !/^[a-z0-9\-_]+$/.test(String(manifest.name))) {
        result.errors.push(
          'Plugin name must contain only lowercase letters, numbers, hyphens, and underscores',
        );
        result.valid = false;
      }

      // Validate version format (semver)
      if (
        manifest.version &&
        !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(String(manifest.version))
      ) {
        result.errors.push(
          'Version must follow semantic versioning (e.g., 1.0.0)',
        );
        result.valid = false;
      }

      // Validate API version compatibility
      if (manifest.apiVersion) {
        const supportedVersions = ['1.0.0', '1.1.0'];
        if (!supportedVersions.includes(String(manifest.apiVersion))) {
          result.warnings.push(
            `API version ${manifest.apiVersion} may not be fully supported`,
          );
        }
      }

      // Validate plugin type
      if (manifest.pluginType) {
        const validTypes = ['service', 'middleware', 'integration', 'utility'];
        if (!validTypes.includes(String(manifest.pluginType))) {
          result.warnings.push(`Unknown plugin type: ${manifest.pluginType}`);
        }
      }

      // Validate permissions (if specified)
      if (manifest.permissions && Array.isArray(manifest.permissions)) {
        const validPermissions = [
          'network.request',
          'filesystem.read',
          'filesystem.write',
          'database.read',
          'database.write',
          'system.env',
        ];

        for (const permission of manifest.permissions) {
          if (!validPermissions.includes(String(permission))) {
            result.warnings.push(`Unknown permission: ${permission}`);
          }
        }
      }

      // Validate dependencies structure
      if (manifest.dependencies && typeof manifest.dependencies !== 'object') {
        result.errors.push('Dependencies must be an object');
        result.valid = false;
      }

      // Validate host requirements
      if ((manifest.engines?.host) != null) {
        if (!/^[><=~^]*\d+\.\d+\.\d+/.test(String(manifest.engines.host))) {
          result.warnings.push(
            'Host version requirement format may be invalid',
          );
        }
      }

      // Check for security-sensitive configurations
      if (manifest.config) {
        const sensitiveKeys = [
          'password',
          'secret',
          'key',
          'token',
          'credential',
        ];
        this.checkForSensitiveData(manifest.config, sensitiveKeys, result);
      }

      // Validate routes (if specified)
      if (manifest.routes && Array.isArray(manifest.routes)) {
        this.validateRoutes(manifest.routes, result);
      }

      // Validate hooks (if specified)
      if (manifest.hooks && typeof manifest.hooks === 'object') {
        this.validateHooks(manifest.hooks, result);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error,'Unknown manifest validation error'); ;
      result.errors.push(`Manifest validation failed: ${errorMessage}`);
      result.valid = false;
    }

    return Promise.resolve(result);
  }

  async validateSecurity(files: ExtractedFile[]): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      for (const file of files) {
        const content = file.content.toString();
        const filename = file.path;

        // Check for dangerous patterns
        this.checkDangerousPatterns(content, filename, result);

        // Check for hardcoded secrets
        this.checkHardcodedSecrets(content, filename, result);

        // Check for suspicious imports
        this.checkSuspiciousImports(content, filename, result);

        // Check file permissions and structure
        this.checkFileStructure(filename, result);
      }

      // Check for required security files
      this.checkSecurityFiles(files, result);
      
      return Promise.resolve(result);
    } catch (error) {
      const errorMessage = getErrorMessage( error , 'Unknown security validation error')
      result.errors.push(`Security validation failed: ${errorMessage}`);
      result.valid = false;
    }

    return result;
  }

  async validateDependencies(packageJson: PackageJsonData): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      const dependencies: Record<string, string> = {
        ...(packageJson.dependencies ?? {}),
        ...(packageJson.devDependencies ?? {}),
        ...(packageJson.peerDependencies ?? {}),
      };

      // Check for known vulnerable packages
      const vulnerablePackages = [
        'event-stream',
        'eslint-scope',
        'flatmap-stream',
      ];

      for (const [pkg, version] of Object.entries(dependencies as Record<string, unknown>)) {
        if (vulnerablePackages.includes(pkg)) {
          result.errors.push(`Vulnerable package detected: ${pkg}`);
          result.valid = false;
        }

        // Check for suspicious version patterns
        if (typeof version === 'string') {
          if (version.includes('git+') || version.includes('http://')) {
            result.warnings.push(
              `Suspicious dependency source: ${pkg}@${version}`,
            );
          }
        }
      }

      // Check for excessive dependencies
      const depCount = Object.keys(dependencies as Record<string, unknown>).length;
      if (depCount > 50) {
        result.warnings.push(
          `High number of dependencies (${depCount}). Consider reducing.`,
        );
      }

      // Check for conflicting versions
      this.checkVersionConflicts(dependencies, result);
    } catch (error) {
      const errorMessage =getErrorMessage( error , 'Unknown dependency validation error')
      result.warnings.push(`Dependency validation failed: ${errorMessage}`);
    }

    return Promise.resolve(result);
  }

  private checkDangerousPatterns(
    content: string,
    filename: string,
    result: ValidationResult,
  ): void {
    const dangerousPatterns = [
      /eval\s*\(/g,
      /Function\s*\(/g,
      /require\s*\(\s*['"`][^'"`]*['"`]\s*\)/g,
      /child_process/g,
      /vm\.runInNewContext/g,
      /vm\.runInThisContext/g,
      /\.exec\s*\(/g,
      /\.spawn\s*\(/g,
      /process\.exit/g,
    ];

    const patternNames = [
      'eval() usage',
      'Function constructor',
      'Dynamic require',
      'Child process',
      'VM context manipulation',
      'VM context execution',
      'Process execution',
      'Process spawning',
      'Process termination',
    ];

    dangerousPatterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        result.warnings.push(
          `Potentially dangerous pattern in ${filename}: ${patternNames[index]}`,
        );
      }
    });
  }

  private checkHardcodedSecrets(
    content: string,
    filename: string,
    result: ValidationResult,
  ): void {
    const secretPatterns = [
      /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      /(?:secret|key)\s*[:=]\s*['"][^'"]{16,}['"]/gi,
      /(?:token|auth)\s*[:=]\s*['"][^'"]{20,}['"]/gi,
      /[A-Za-z0-9+/]{40,}={0,2}/g, // Base64 patterns
      /[0-9a-fA-F]{32,}/g, // Hex patterns
    ];

    secretPatterns.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        result.warnings.push(`Potential hardcoded secret in ${filename}`);
      }
    });
  }

  private checkSuspiciousImports(
    content: string,
    filename: string,
    result: ValidationResult,
  ): void {
    const suspiciousImports = [
      'fs',
      'path',
      'os',
      'crypto',
      'net',
      'http',
      'https',
      'url',
      'querystring',
      'cluster',
      'worker_threads',
    ];

    const importPattern = /(?:import|require)\s*\(?['"`]([^'"`)]+)['"`]\)?/g;
    let match;

    while ((match = importPattern.exec(content)) !== null) {
      const moduleName = (match[1] != null) ? String(match[1]) : '';
      if (
        suspiciousImports.includes(moduleName) ||
        moduleName.startsWith('.')
      ) {
        result.warnings.push(
          `Potentially sensitive import in ${filename}: ${moduleName}`,
        );
      }
    }
  }

  private checkFileStructure(filename: string, result: ValidationResult): void {
    // Check for files outside expected directories
    const allowedPaths = [
      /^src\//,
      /^dist\//,
      /^lib\//,
      /^config\//,
      /^assets\//,
      /^docs\//,
      /^tests?\//,
      /^package\.json$/,
      /^plugin\.manifest\.json$/,
      /^README\.md$/,
      /^LICENSE$/,
      /^\.gitignore$/,
    ];

    const isAllowed = allowedPaths.some((pattern) => pattern.test(filename));

    if (!isAllowed) {
      result.warnings.push(`Unexpected file location: ${filename}`);
    }

    // Check for executable files
    if (
      filename.endsWith('.sh') ||
      filename.endsWith('.exe') ||
      filename.endsWith('.bat')
    ) {
      result.errors.push(`Executable files not allowed: ${filename}`);
    }
  }

  private checkSecurityFiles(
    files: ExtractedFile[],
    result: ValidationResult,
  ): void {
    const filenames = files.map((f) => f.path);

    // Recommend security-related files
    if (!filenames.includes('README.md')) {
      result.warnings.push('Missing README.md file');
    }

    if (!filenames.includes('LICENSE')) {
      result.warnings.push('Missing LICENSE file');
    }
  }

  private validateRoutes(routes: PluginRouteData[], result: ValidationResult): void {
    for (const route of routes) {
      if ((route.path == null) || (route.method == null)) {
        result.errors.push('Route must have path and method');
        continue;
      }

      // Validate HTTP methods
      const validMethods = [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'HEAD',
        'OPTIONS',
      ];
      if (!validMethods.includes(String(route.method).toUpperCase())) {
        result.warnings.push(`Invalid HTTP method: ${route.method}`);
      }

      // Validate path format
      if (!route.path.startsWith('/')) {
        result.warnings.push(`Route path should start with '/': ${route.path}`);
      }
    }
  }

  private validateHooks(hooks: Record<string, unknown>, result: ValidationResult): void {
    const validHooks = [
      'onLoad',
      'onUnload',
      'onRequest',
      'onResponse',
      'onError',
    ];

    for (const hookName of Object.keys(hooks)) {
      if (!validHooks.includes(hookName)) {
        result.warnings.push(`Unknown hook: ${hookName}`);
      }
    }
  }

  private checkForSensitiveData(
    obj: Record<string, unknown>,
    sensitiveKeys: string[],
    result: ValidationResult,
  ): void {
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();

      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        if (typeof obj[key] === 'string' && String(obj[key]).length > 0) {
          result.warnings.push(`Potential sensitive data in config: ${key}`);
        }
      }

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.checkForSensitiveData(obj[key] as Record<string, unknown>, sensitiveKeys, result);
      }
    }
  }

  private checkVersionConflicts(
    dependencies: Record<string, string>,
    result: ValidationResult,
  ): void {
    // This is a simplified version conflict check
    // In practice, you'd want to use a more sophisticated dependency resolver
    const versions = new Map<string, string[]>();

    for (const [pkg, version] of Object.entries(dependencies)) {
      const basePackage = pkg.split('@')[0];

      if (!versions.has(basePackage)) {
        versions.set(basePackage, []);
      }

      versions.get(basePackage)!.push(version);
    }

    for (const [pkg, versionList] of versions) {
      if (versionList.length > 1) {
        const uniqueVersions = [...new Set(versionList)];
        if (uniqueVersions.length > 1) {
          result.warnings.push(
            `Potential version conflict for ${pkg}: ${uniqueVersions.join(', ')}`,
          );
        }
      }
    }
  }
}
