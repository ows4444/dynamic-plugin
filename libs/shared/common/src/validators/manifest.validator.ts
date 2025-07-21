import { PluginType, PluginCategory } from '../enums/plugin-status.enum';
import { PluginPermission, SecurityLevel } from '../enums/permission.enum';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  type: PluginType;
  category: PluginCategory;
  main: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  permissions: PluginPermission[];
  securityLevel: SecurityLevel;
  supportedVersions: string[];
  minHostVersion: string;
  maxHostVersion?: string;
  routes?: string[];
  hooks?: string[];
  configuration?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class ManifestValidator {
  private static readonly REQUIRED_FIELDS = [
    'name',
    'version',
    'description',
    'author',
    'license',
    'type',
    'category',
    'main',
    'permissions',
    'securityLevel',
    'supportedVersions',
    'minHostVersion',
  ];

  private static readonly VERSION_REGEX =
    /^\d+\.\d+\.\d+(-[\w\d\-]+)?(\+[\w\d\-]+)?$/;
  private static readonly NAME_REGEX = /^[a-z]([a-z0-9\-])*[a-z0-9]$/;

  static validate(manifest: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifest || typeof manifest !== 'object') {
      return { valid: false, errors: ['Manifest must be a valid object'] };
    }

    this.validateRequiredFields(manifest, errors);
    this.validatePluginName(manifest.name, errors);
    this.validateVersion(manifest.version, errors);
    this.validateType(manifest.type, errors);
    this.validateCategory(manifest.category, errors);
    this.validatePermissions(manifest.permissions, errors);
    this.validateSecurityLevel(manifest.securityLevel, errors);
    this.validateSupportedVersions(manifest.supportedVersions, errors);
    this.validateDependencies(manifest.dependencies, errors);
    this.validatePeerDependencies(manifest.peerDependencies, errors);
    this.validateRoutes(manifest.routes, errors);
    this.validateHooks(manifest.hooks, errors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static validateRequiredFields(manifest: any, errors: string[]): void {
    for (const field of this.REQUIRED_FIELDS) {
      if (
        !(field in manifest) ||
        manifest[field] === null ||
        manifest[field] === undefined
      ) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  private static validatePluginName(name: any, errors: string[]): void {
    if (typeof name !== 'string') {
      errors.push('Plugin name must be a string');
      return;
    }

    if (!this.NAME_REGEX.test(name)) {
      errors.push(
        'Plugin name must be lowercase, alphanumeric with hyphens, and cannot start or end with a hyphen',
      );
    }

    if (name.length < 3 || name.length > 50) {
      errors.push('Plugin name must be between 3 and 50 characters');
    }
  }

  private static validateVersion(version: any, errors: string[]): void {
    if (typeof version !== 'string') {
      errors.push('Version must be a string');
      return;
    }

    if (!this.VERSION_REGEX.test(version)) {
      errors.push(
        'Version must follow semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)',
      );
    }
  }

  private static validateType(type: any, errors: string[]): void {
    if (!Object.values(PluginType).includes(type)) {
      errors.push(
        `Invalid plugin type. Must be one of: ${Object.values(PluginType).join(', ')}`,
      );
    }
  }

  private static validateCategory(category: any, errors: string[]): void {
    if (!Object.values(PluginCategory).includes(category)) {
      errors.push(
        `Invalid plugin category. Must be one of: ${Object.values(PluginCategory).join(', ')}`,
      );
    }
  }

  private static validatePermissions(permissions: any, errors: string[]): void {
    if (!Array.isArray(permissions)) {
      errors.push('Permissions must be an array');
      return;
    }

    for (const permission of permissions) {
      if (!Object.values(PluginPermission).includes(permission)) {
        errors.push(
          `Invalid permission: ${permission}. Must be one of: ${Object.values(PluginPermission).join(', ')}`,
        );
      }
    }
  }

  private static validateSecurityLevel(
    securityLevel: any,
    errors: string[],
  ): void {
    if (!Object.values(SecurityLevel).includes(securityLevel)) {
      errors.push(
        `Invalid security level. Must be one of: ${Object.values(SecurityLevel).join(', ')}`,
      );
    }
  }

  private static validateSupportedVersions(
    supportedVersions: any,
    errors: string[],
  ): void {
    if (!Array.isArray(supportedVersions)) {
      errors.push('Supported versions must be an array');
      return;
    }

    if (supportedVersions.length === 0) {
      errors.push('At least one supported version must be specified');
    }

    for (const version of supportedVersions) {
      if (typeof version !== 'string' || !this.VERSION_REGEX.test(version)) {
        errors.push(
          `Invalid supported version: ${version}. Must follow semantic versioning`,
        );
      }
    }
  }

  private static validateDependencies(
    dependencies: any,
    errors: string[],
  ): void {
    if (dependencies !== undefined && typeof dependencies !== 'object') {
      errors.push('Dependencies must be an object');
      return;
    }

    if (dependencies) {
      for (const [name, version] of Object.entries(dependencies)) {
        if (typeof name !== 'string' || typeof version !== 'string') {
          errors.push(`Invalid dependency: ${name}@${version}`);
        }
      }
    }
  }

  private static validatePeerDependencies(
    peerDependencies: any,
    errors: string[],
  ): void {
    if (
      peerDependencies !== undefined &&
      typeof peerDependencies !== 'object'
    ) {
      errors.push('Peer dependencies must be an object');
      return;
    }

    if (peerDependencies) {
      for (const [name, version] of Object.entries(peerDependencies)) {
        if (typeof name !== 'string' || typeof version !== 'string') {
          errors.push(`Invalid peer dependency: ${name}@${version}`);
        }
      }
    }
  }

  private static validateRoutes(routes: any, errors: string[]): void {
    if (routes !== undefined && !Array.isArray(routes)) {
      errors.push('Routes must be an array');
      return;
    }

    if (routes) {
      for (const route of routes) {
        if (typeof route !== 'string') {
          errors.push(`Invalid route: ${route}. Routes must be strings`);
        }
      }
    }
  }

  private static validateHooks(hooks: any, errors: string[]): void {
    if (hooks !== undefined && !Array.isArray(hooks)) {
      errors.push('Hooks must be an array');
      return;
    }

    if (hooks) {
      for (const hook of hooks) {
        if (typeof hook !== 'string') {
          errors.push(`Invalid hook: ${hook}. Hooks must be strings`);
        }
      }
    }
  }
}
