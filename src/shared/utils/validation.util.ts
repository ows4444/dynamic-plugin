import * as semver from 'semver';
import type { PluginManifest, ValidationResult } from '@/types/plugin.types';
import { PluginErrorCodes, PluginErrorHandler } from './error-handler.util';

/**
 * Comprehensive validation utilities for the plugin system
 */
export class PluginValidationUtil {
  /**
   * Validates a plugin manifest thoroughly
   */
  static validateManifest(manifest: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest || typeof manifest !== 'object') {
      return {
        valid: false,
        errors: ['Manifest must be a valid object'],
        warnings: [],
      };
    }

    const manifestObj = manifest as Partial<PluginManifest>;

    // Required fields validation
    this.validateRequiredField(manifestObj.name, 'name', errors);
    this.validateRequiredField(manifestObj.version, 'version', errors);
    this.validateRequiredField(manifestObj.description, 'description', errors);
    this.validateRequiredField(manifestObj.author, 'author', errors);
    this.validateRequiredField(manifestObj.license, 'license', errors);
    this.validateRequiredField(manifestObj.main, 'main', errors);

    // Version validation
    if (manifestObj.version && !semver.valid(manifestObj.version)) {
      errors.push('Version must be a valid semantic version (e.g., 1.0.0)');
    }

    // Engine validation
    if (manifestObj.engines) {
      this.validateEngines(manifestObj.engines, errors, warnings);
    } else {
      warnings.push('No engine requirements specified');
    }

    // Dependencies validation
    if (manifestObj.dependencies) {
      this.validateDependencies(manifestObj.dependencies, 'dependencies', errors);
    }

    if (manifestObj.pluginDependencies) {
      this.validateDependencies(manifestObj.pluginDependencies, 'pluginDependencies', errors);
    }

    // Permissions validation
    if (manifestObj.permissions) {
      this.validatePermissions(manifestObj.permissions, errors, warnings);
    }

    // Capabilities validation
    if (manifestObj.capabilities) {
      this.validateCapabilities(manifestObj.capabilities, warnings);
    }

    // Hooks validation
    if (manifestObj.hooks) {
      this.validateHooks(manifestObj.hooks, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates required fields
   */
  private static validateRequiredField(value: unknown, fieldName: string, errors: string[]): void {
    if (!value || (typeof value === 'string' && !value.trim())) {
      errors.push(`${fieldName} is required and cannot be empty`);
    }
  }

  /**
   * Validates engine requirements
   */
  private static validateEngines(engines: unknown, errors: string[], warnings: string[]): void {
    if (typeof engines !== 'object' || !engines) {
      errors.push('Engines must be an object');
      return;
    }

    const enginesObj = engines as Record<string, unknown>;

    if (enginesObj.node) {
      if (typeof enginesObj.node !== 'string' || !semver.validRange(enginesObj.node)) {
        errors.push('Node.js engine version must be a valid semver range');
      }
    } else {
      warnings.push('No Node.js engine requirement specified');
    }

    if (enginesObj.nestjs) {
      if (typeof enginesObj.nestjs !== 'string' || !semver.validRange(enginesObj.nestjs)) {
        errors.push('NestJS engine version must be a valid semver range');
      }
    } else {
      warnings.push('No NestJS engine requirement specified');
    }
  }

  /**
   * Validates dependency objects
   */
  private static validateDependencies(dependencies: unknown, type: string, errors: string[]): void {
    if (typeof dependencies !== 'object' || !dependencies) {
      errors.push(`${type} must be an object`);
      return;
    }

    const depsObj = dependencies as Record<string, unknown>;

    for (const [name, version] of Object.entries(depsObj)) {
      if (!name || typeof name !== 'string') {
        errors.push(`Invalid dependency name in ${type}`);
        continue;
      }

      if (!version || typeof version !== 'string' || !semver.validRange(version)) {
        errors.push(`Invalid version range for ${type} dependency '${name}': ${String(version)}`);
      }
    }
  }

  /**
   * Validates permissions object
   */
  private static validatePermissions(permissions: unknown, errors: string[], warnings: string[]): void {
    if (typeof permissions !== 'object' || !permissions) {
      errors.push('Permissions must be an object');
      return;
    }

    const permsObj = permissions as Record<string, unknown>;
    const validPermissionTypes = ['database', 'network', 'filesystem', 'system', 'config', 'logs', 'plugins'];

    for (const [type, perms] of Object.entries(permsObj)) {
      if (!validPermissionTypes.includes(type)) {
        warnings.push(`Unknown permission type: ${type}`);
      }

      if (!Array.isArray(perms)) {
        errors.push(`Permissions for '${type}' must be an array`);
        continue;
      }

      for (const perm of perms) {
        if (typeof perm !== 'string') {
          errors.push(`All permissions in '${type}' must be strings`);
        }
      }
    }
  }

  /**
   * Validates capabilities array
   */
  private static validateCapabilities(capabilities: unknown, warnings: string[]): void {
    if (!Array.isArray(capabilities)) {
      warnings.push('Capabilities should be an array');
      return;
    }

    const validCapabilities = ['database', 'rest-api', 'graphql', 'events', 'websocket', 'grpc', 'file-upload', 'authentication', 'authorization', 'caching', 'logging', 'monitoring'];

    for (const capability of capabilities) {
      if (typeof capability !== 'string') {
        warnings.push('All capabilities must be strings');
      } else if (!validCapabilities.includes(capability)) {
        warnings.push(`Unknown capability: ${capability}`);
      }
    }
  }

  /**
   * Validates hooks object
   */
  private static validateHooks(hooks: unknown, warnings: string[]): void {
    if (typeof hooks !== 'object' || !hooks) {
      warnings.push('Hooks should be an object');
      return;
    }

    const hooksObj = hooks as Record<string, unknown>;
    const validHooks = ['onInstall', 'onUninstall', 'onStart', 'onStop'];

    for (const [hookName, hookPath] of Object.entries(hooksObj)) {
      if (!validHooks.includes(hookName)) {
        warnings.push(`Unknown hook: ${hookName}`);
      }

      if (typeof hookPath !== 'string') {
        warnings.push(`Hook '${hookName}' path must be a string`);
      }
    }
  }

  /**
   * Validates plugin ID format
   */
  static validatePluginId(pluginId: string): boolean {
    if (!pluginId || typeof pluginId !== 'string') {
      return false;
    }

    // Plugin ID should be in format: name@version
    const parts = pluginId.split('@');
    if (parts.length !== 2) {
      return false;
    }

    const [name, version] = parts;

    // Validate name (basic npm package name rules)
    if (!name || !/^[a-z0-9]([a-z0-9\-_])*$/i.test(name)) {
      return false;
    }

    // Validate version
    return semver.valid(version) !== null;
  }

  /**
   * Validates plugin configuration against schema
   */
  static validateConfiguration(config: unknown, schema: unknown, pluginId: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic type validation
      if (config !== null && config !== undefined && typeof config !== 'object') {
        errors.push('Configuration must be an object');
        return { valid: false, errors, warnings };
      }

      // If no schema provided, basic validation only
      if (!schema || typeof schema !== 'object') {
        warnings.push('No configuration schema provided for validation');
        return { valid: errors.length === 0, errors, warnings };
      }

      // TODO: Implement JSON Schema validation here
      // For now, we'll do basic validation

      const configObj = (config as Record<string, unknown>) || {};
      const schemaObj = schema as Record<string, unknown>;

      // Check required fields if specified
      if (schemaObj.required && Array.isArray(schemaObj.required)) {
        for (const field of schemaObj.required) {
          if (typeof field === 'string' && !(field in configObj)) {
            errors.push(`Required configuration field missing: ${field}`);
          }
        }
      }

      return { valid: errors.length === 0, errors, warnings };
    } catch (error) {
      const pluginError = PluginErrorHandler.createPluginError(
        pluginId,
        PluginErrorCodes.CONFIGURATION_VALIDATION_FAILED,
        `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      errors.push(pluginError.message);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Sanitizes plugin input to prevent injection attacks
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove potential script tags and dangerous characters
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/[<>]/g, '')
      .trim();
  }

  /**
   * Validates file paths to prevent directory traversal
   */
  static validateFilePath(filePath: string, allowedBasePaths: string[] = []): boolean {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    // Check for directory traversal attempts
    if (filePath.includes('..') || filePath.includes('~')) {
      return false;
    }

    // Check against allowed base paths if provided
    if (allowedBasePaths.length > 0) {
      const normalizedPath = filePath.replace(/\\/g, '/');
      return allowedBasePaths.some((basePath) => normalizedPath.startsWith(basePath.replace(/\\/g, '/')));
    }

    return true;
  }

  /**
   * Validates network URLs for security
   */
  static validateNetworkUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      const urlObj = new URL(url);

      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }

      // Block localhost/private IPs in production
      const hostname = urlObj.hostname.toLowerCase();
      const privateNetworks = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

      // In production, you might want to block private networks
      if (process.env.NODE_ENV === 'production' && privateNetworks.some((ip) => hostname.includes(ip))) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}
