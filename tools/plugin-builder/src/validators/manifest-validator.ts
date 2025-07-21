import { Injectable, Logger } from '@nestjs/common';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export interface ManifestValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
  manifest?: any;
}

@Injectable()
export class ManifestValidator {
  private readonly logger = new Logger(ManifestValidator.name);
  private readonly ajv: Ajv;
  private readonly manifestSchema: object;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
    this.manifestSchema = this.createManifestSchema();
  }

  async validateManifest(
    manifestContent: string | object,
  ): Promise<ManifestValidationResult> {
    const result: ManifestValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      let manifest: any;

      if (typeof manifestContent === 'string') {
        try {
          manifest = JSON.parse(manifestContent);
        } catch (parseError) {
          result.valid = false;
          result.errors.push({
            field: 'root',
            message: 'Invalid JSON format',
            value: parseError.message,
          });
          return result;
        }
      } else {
        manifest = manifestContent;
      }

      result.manifest = manifest;

      // Schema validation
      const schemaValid = this.ajv.validate(this.manifestSchema, manifest);

      if (!schemaValid && this.ajv.errors) {
        result.valid = false;
        for (const error of this.ajv.errors) {
          result.errors.push({
            field: error.instancePath || error.schemaPath,
            message: error.message ?? 'Validation failed',
            value: error.data,
          });
        }
      }

      // Custom validation rules
      await this.performCustomValidation(manifest, result);

      // Generate warnings for best practices
      this.generateWarnings(manifest, result);
    } catch (error) {
      this.logger.error(`Manifest validation failed: ${error.message}`);
      result.valid = false;
      result.errors.push({
        field: 'root',
        message: `Validation error: ${error.message}`,
      });
    }

    return result;
  }

  async validateManifestFile(
    filePath: string,
  ): Promise<ManifestValidationResult> {
    try {
      const fs = require('fs').promises;
      const content = await fs.readFile(filePath, 'utf-8');
      return this.validateManifest(content);
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            field: 'file',
            message: `Cannot read manifest file: ${error.message}`,
          },
        ],
        warnings: [],
      };
    }
  }

  private async performCustomValidation(
    manifest: any,
    result: ManifestValidationResult,
  ): Promise<void> {
    // Validate name format
    if (manifest.name) {
      if (!/^[a-z0-9\-_]{3,50}$/.test(manifest.name)) {
        result.errors.push({
          field: 'name',
          message:
            'Name must be 3-50 characters, lowercase letters, numbers, hyphens, and underscores only',
          value: manifest.name,
        });
        result.valid = false;
      }

      // Reserved names
      const reservedNames = [
        'system',
        'core',
        'admin',
        'api',
        'host',
        'registry',
      ];
      if (reservedNames.includes(manifest.name)) {
        result.errors.push({
          field: 'name',
          message: `Name '${manifest.name}' is reserved`,
          value: manifest.name,
        });
        result.valid = false;
      }
    }

    // Validate version format (semantic versioning)
    if (manifest.version) {
      const semverRegex =
        /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

      if (!semverRegex.test(manifest.version)) {
        result.errors.push({
          field: 'version',
          message:
            'Version must follow semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)',
          value: manifest.version,
        });
        result.valid = false;
      }
    }

    // Validate API version compatibility
    if (manifest.apiVersion) {
      const supportedVersions = ['1.0.0', '1.1.0', '2.0.0'];
      if (!supportedVersions.includes(manifest.apiVersion)) {
        result.errors.push({
          field: 'apiVersion',
          message: `Unsupported API version. Supported versions: ${supportedVersions.join(', ')}`,
          value: manifest.apiVersion,
        });
        result.valid = false;
      }
    }

    // Validate entry point exists
    if (manifest.main) {
      try {
        const path = require('path');
        const fs = require('fs').promises;
        const manifestDir = process.cwd(); // This would be the plugin directory in real usage
        const mainPath = path.resolve(manifestDir, manifest.main);

        try {
          await fs.access(mainPath);
        } catch {
          result.warnings.push({
            field: 'main',
            message: 'Main entry point file not found',
            value: manifest.main,
          });
        }
      } catch (error) {
        // Skip file existence check if we can't determine the path
      }
    }

    // Validate permissions
    if (manifest.permissions && Array.isArray(manifest.permissions)) {
      const validPermissions = [
        'network.request',
        'network.server',
        'filesystem.read',
        'filesystem.write',
        'database.read',
        'database.write',
        'system.env',
        'system.process',
        'cache.read',
        'cache.write',
        'events.emit',
        'events.listen',
      ];

      for (const permission of manifest.permissions) {
        if (!validPermissions.includes(permission)) {
          result.warnings.push({
            field: 'permissions',
            message: `Unknown permission: ${permission}`,
            value: permission,
          });
        }

        // Check for dangerous permissions
        const dangerousPermissions = ['system.process', 'filesystem.write'];
        if (dangerousPermissions.includes(permission)) {
          result.warnings.push({
            field: 'permissions',
            message: `Potentially dangerous permission: ${permission}`,
            value: permission,
          });
        }
      }
    }

    // Validate host requirements
    if (manifest.engines?.host) {
      const hostVersionPattern = /^[><=~^]*\d+\.\d+\.\d+/;
      if (!hostVersionPattern.test(manifest.engines.host)) {
        result.warnings.push({
          field: 'engines.host',
          message: 'Host version requirement format may be invalid',
          value: manifest.engines.host,
        });
      }
    }

    // Validate routes
    if (manifest.routes && Array.isArray(manifest.routes)) {
      for (const [index, route] of manifest.routes.entries()) {
        this.validateRoute(route, `routes[${index}]`, result);
      }
    }

    // Validate hooks
    if (manifest.hooks && typeof manifest.hooks === 'object') {
      this.validateHooks(manifest.hooks, result);
    }
  }

  private validateRoute(
    route: any,
    fieldPrefix: string,
    result: ManifestValidationResult,
  ): void {
    if (!route.path) {
      result.errors.push({
        field: `${fieldPrefix}.path`,
        message: 'Route path is required',
      });
      result.valid = false;
    }

    if (!route.method) {
      result.errors.push({
        field: `${fieldPrefix}.method`,
        message: 'Route method is required',
      });
      result.valid = false;
    }

    if (route.method) {
      const validMethods = [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'HEAD',
        'OPTIONS',
      ];
      if (!validMethods.includes(route.method.toUpperCase())) {
        result.errors.push({
          field: `${fieldPrefix}.method`,
          message: 'Invalid HTTP method',
          value: route.method,
        });
        result.valid = false;
      }
    }

    if (route.path && !route.path.startsWith('/')) {
      result.warnings.push({
        field: `${fieldPrefix}.path`,
        message: 'Route path should start with "/"',
        value: route.path,
      });
    }

    // Check for conflicting routes
    if (route.path === '/health' || route.path === '/status') {
      result.warnings.push({
        field: `${fieldPrefix}.path`,
        message: 'Route path conflicts with system endpoints',
        value: route.path,
      });
    }
  }

  private validateHooks(hooks: any, result: ManifestValidationResult): void {
    const validHooks = [
      'onLoad',
      'onUnload',
      'onStart',
      'onStop',
      'onRequest',
      'onResponse',
      'onError',
      'beforeRequest',
      'afterResponse',
    ];

    for (const [hookName, hookConfig] of Object.entries(hooks)) {
      if (!validHooks.includes(hookName)) {
        result.warnings.push({
          field: `hooks.${hookName}`,
          message: 'Unknown hook type',
          value: hookName,
        });
      }

      if (typeof hookConfig === 'object' && hookConfig !== null) {
        const config = hookConfig as any;
        if (config.handler && typeof config.handler !== 'string') {
          result.errors.push({
            field: `hooks.${hookName}.handler`,
            message: 'Hook handler must be a string',
            value: config.handler,
          });
          result.valid = false;
        }
      }
    }
  }

  private generateWarnings(
    manifest: any,
    result: ManifestValidationResult,
  ): void {
    // Check for recommended fields
    const recommendedFields = [
      'description',
      'author',
      'license',
      'homepage',
      'repository',
      'keywords',
    ];

    for (const field of recommendedFields) {
      if (!manifest[field]) {
        result.warnings.push({
          field,
          message: `Recommended field '${field}' is missing`,
        });
      }
    }

    // Check description length
    if (manifest.description && manifest.description.length < 20) {
      result.warnings.push({
        field: 'description',
        message: 'Description should be at least 20 characters long',
        value: manifest.description,
      });
    }

    if (manifest.description && manifest.description.length > 500) {
      result.warnings.push({
        field: 'description',
        message: 'Description should be no more than 500 characters',
        value: manifest.description,
      });
    }

    // Check for keywords
    if (
      !manifest.keywords ||
      !Array.isArray(manifest.keywords) ||
      manifest.keywords.length === 0
    ) {
      result.warnings.push({
        field: 'keywords',
        message: 'Adding keywords helps with plugin discoverability',
      });
    }

    if (manifest.keywords && manifest.keywords.length > 10) {
      result.warnings.push({
        field: 'keywords',
        message: 'Too many keywords may affect searchability',
        value: manifest.keywords.length,
      });
    }

    // Check license format
    if (manifest.license && !this.isValidLicense(manifest.license)) {
      result.warnings.push({
        field: 'license',
        message: 'License should use SPDX identifier (e.g., MIT, Apache-2.0)',
        value: manifest.license,
      });
    }
  }

  private isValidLicense(license: string): boolean {
    const commonLicenses = [
      'MIT',
      'Apache-2.0',
      'GPL-3.0',
      'BSD-3-Clause',
      'ISC',
      'GPL-2.0',
      'LGPL-3.0',
      'LGPL-2.1',
      'MPL-2.0',
      'UNLICENSED',
    ];
    return commonLicenses.includes(license);
  }

  private createManifestSchema(): object {
    return {
      type: 'object',
      required: [
        'name',
        'version',
        'description',
        'main',
        'pluginType',
        'apiVersion',
      ],
      properties: {
        name: {
          type: 'string',
          minLength: 3,
          maxLength: 50,
        },
        version: {
          type: 'string',
        },
        description: {
          type: 'string',
          minLength: 1,
          maxLength: 1000,
        },
        main: {
          type: 'string',
        },
        pluginType: {
          type: 'string',
          enum: [
            'service',
            'middleware',
            'integration',
            'utility',
            'auth',
            'storage',
          ],
        },
        apiVersion: {
          type: 'string',
        },
        author: {
          oneOf: [
            { type: 'string' },
            {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                url: { type: 'string', format: 'uri' },
              },
              required: ['name'],
            },
          ],
        },
        license: {
          type: 'string',
        },
        homepage: {
          type: 'string',
          format: 'uri',
        },
        repository: {
          oneOf: [
            { type: 'string', format: 'uri' },
            {
              type: 'object',
              properties: {
                type: { type: 'string' },
                url: { type: 'string', format: 'uri' },
              },
              required: ['type', 'url'],
            },
          ],
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 15,
        },
        permissions: {
          type: 'array',
          items: { type: 'string' },
        },
        engines: {
          type: 'object',
          properties: {
            host: { type: 'string' },
            node: { type: 'string' },
          },
        },
        routes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              method: { type: 'string' },
              handler: { type: 'string' },
              middleware: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['path', 'method'],
          },
        },
        hooks: {
          type: 'object',
          additionalProperties: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  handler: { type: 'string' },
                  priority: { type: 'number' },
                },
                required: ['handler'],
              },
            ],
          },
        },
        config: {
          type: 'object',
        },
        dependencies: {
          type: 'object',
        },
        devDependencies: {
          type: 'object',
        },
        peerDependencies: {
          type: 'object',
        },
      },
      additionalProperties: true,
    };
  }
}
