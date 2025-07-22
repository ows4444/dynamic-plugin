import * as Joi from 'joi';
import { Logger } from '@nestjs/common';

export interface EnvironmentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  environment: string;
  config: Record<string, any>;
}

export interface EnvironmentRequirement {
  key: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'port';
  defaultValue?: any;
  description: string;
  allowedValues?: any[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export class EnvironmentValidator {
  private readonly logger = new Logger(EnvironmentValidator.name);
  private readonly requirements: EnvironmentRequirement[] = [
    // Application Configuration
    {
      key: 'NODE_ENV',
      required: true,
      type: 'string',
      defaultValue: 'development',
      allowedValues: ['development', 'staging', 'production', 'test'],
      description: 'Application environment',
    },
    {
      key: 'PORT',
      required: false,
      type: 'port',
      defaultValue: 3000,
      description: 'Application port',
    },
    {
      key: 'LOG_LEVEL',
      required: false,
      type: 'string',
      defaultValue: 'info',
      allowedValues: ['error', 'warn', 'info', 'debug', 'verbose'],
      description: 'Logging level',
    },

    // Database Configuration
    {
      key: 'DB_HOST',
      required: true,
      type: 'string',
      description: 'Database host',
    },
    {
      key: 'DB_PORT',
      required: false,
      type: 'port',
      defaultValue: 5432,
      description: 'Database port',
    },
    {
      key: 'DB_USERNAME',
      required: true,
      type: 'string',
      description: 'Database username',
    },
    {
      key: 'DB_PASSWORD',
      required: true,
      type: 'string',
      minLength: 8,
      description: 'Database password',
    },
    {
      key: 'DB_DATABASE',
      required: true,
      type: 'string',
      description: 'Database name',
    },

    // Redis Configuration
    {
      key: 'REDIS_HOST',
      required: false,
      type: 'string',
      defaultValue: 'localhost',
      description: 'Redis host',
    },
    {
      key: 'REDIS_PORT',
      required: false,
      type: 'port',
      defaultValue: 6379,
      description: 'Redis port',
    },
    {
      key: 'REDIS_PASSWORD',
      required: false,
      type: 'string',
      description: 'Redis password (if required)',
    },

    // Security Configuration
    {
      key: 'JWT_SECRET',
      required: true,
      type: 'string',
      minLength: 32,
      description: 'JWT signing secret',
    },
    {
      key: 'JWT_EXPIRES_IN',
      required: false,
      type: 'string',
      defaultValue: '1h',
      description: 'JWT expiration time',
    },
    {
      key: 'ENCRYPTION_KEY',
      required: true,
      type: 'string',
      minLength: 32,
      description: 'Data encryption key',
    },

    // Plugin System Configuration
    {
      key: 'PLUGIN_UPLOAD_MAX_SIZE',
      required: false,
      type: 'number',
      defaultValue: 2097152, // 2MB
      min: 1024, // 1KB minimum
      max: 52428800, // 50MB maximum
      description: 'Maximum plugin upload size in bytes',
    },
    {
      key: 'PLUGIN_SANDBOX_MEMORY_LIMIT',
      required: false,
      type: 'number',
      defaultValue: 128,
      min: 64,
      max: 512,
      description: 'Plugin sandbox memory limit in MB',
    },
    {
      key: 'PLUGIN_EXECUTION_TIMEOUT',
      required: false,
      type: 'number',
      defaultValue: 30000,
      min: 1000,
      max: 300000, // 5 minutes
      description: 'Plugin execution timeout in milliseconds',
    },

    // Storage Configuration
    {
      key: 'STORAGE_TYPE',
      required: false,
      type: 'string',
      defaultValue: 'local',
      allowedValues: ['local', 's3', 'gcs'],
      description: 'Storage provider type',
    },
    {
      key: 'STORAGE_PATH',
      required: false,
      type: 'string',
      defaultValue: './storage',
      description: 'Local storage path',
    },
  ];

  validate(): EnvironmentValidationResult {
    const result: EnvironmentValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      environment: process.env.NODE_ENV || 'development',
      config: {},
    };

    // Build Joi schema from requirements
    const schemaFields: Record<string, Joi.Schema> = {};

    for (const requirement of this.requirements) {
      let schema = this.buildJoiSchema(requirement);

      if (!requirement.required && requirement.defaultValue !== undefined) {
        schema = schema.default(requirement.defaultValue);
      }

      if (requirement.required) {
        schema = schema.required();
      } else {
        schema = schema.optional();
      }

      schemaFields[requirement.key] = schema;
    }

    const validationSchema = Joi.object(schemaFields);

    // Validate environment
    const { error, value, warning } = validationSchema.validate(process.env, {
      allowUnknown: true,
      stripUnknown: false,
      abortEarly: false,
    });

    if (error) {
      result.isValid = false;
      result.errors = error.details.map(detail => {
        const requirement = this.requirements.find(req => req.key === detail.path[0]);
        const description = requirement?.description || 'Unknown requirement';
        return `${detail.message} (${description})`;
      });
    }

    if (warning) {
      result.warnings = warning.details.map(detail => detail.message);
    }

    result.config = value || {};

    // Additional security checks for production
    if (result.environment === 'production') {
      this.performProductionChecks(result);
    }

    // Log validation results
    this.logValidationResults(result);

    return result;
  }

  validateAndThrow(): Record<string, any> {
    const result = this.validate();

    if (!result.isValid) {
      const errorMessage = `Environment validation failed:\n${result.errors.join('\n')}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (result.warnings.length > 0) {
      this.logger.warn(`Environment validation warnings:\n${result.warnings.join('\n')}`);
    }

    this.logger.log('✅ Environment validation passed');
    return result.config;
  }

  getRequiredVariables(): string[] {
    return this.requirements
      .filter(req => req.required)
      .map(req => req.key);
  }

  getDocumentation(): string {
    let doc = '# Environment Variables Documentation\n\n';
    
    doc += '## Required Variables\n';
    this.requirements
      .filter(req => req.required)
      .forEach(req => {
        doc += `- **${req.key}**: ${req.description}\n`;
        if (req.allowedValues) {
          doc += `  - Allowed values: ${req.allowedValues.join(', ')}\n`;
        }
        if (req.minLength) {
          doc += `  - Minimum length: ${req.minLength}\n`;
        }
      });

    doc += '\n## Optional Variables\n';
    this.requirements
      .filter(req => !req.required)
      .forEach(req => {
        doc += `- **${req.key}**: ${req.description}\n`;
        if (req.defaultValue !== undefined) {
          doc += `  - Default: ${req.defaultValue}\n`;
        }
        if (req.allowedValues) {
          doc += `  - Allowed values: ${req.allowedValues.join(', ')}\n`;
        }
      });

    return doc;
  }

  private buildJoiSchema(requirement: EnvironmentRequirement): Joi.Schema {
    let schema: Joi.Schema;

    switch (requirement.type) {
      case 'string':
        schema = Joi.string();
        if (requirement.minLength) {
          schema = schema.min(requirement.minLength);
        }
        if (requirement.maxLength) {
          schema = schema.max(requirement.maxLength);
        }
        break;
      case 'number':
        schema = Joi.number();
        if (requirement.min !== undefined) {
          schema = schema.min(requirement.min);
        }
        if (requirement.max !== undefined) {
          schema = schema.max(requirement.max);
        }
        break;
      case 'boolean':
        schema = Joi.boolean();
        break;
      case 'url':
        schema = Joi.string().uri();
        break;
      case 'email':
        schema = Joi.string().email();
        break;
      case 'port':
        schema = Joi.number().port();
        break;
      default:
        schema = Joi.string();
    }

    if (requirement.allowedValues) {
      schema = schema.valid(...requirement.allowedValues);
    }

    return schema;
  }

  private performProductionChecks(result: EnvironmentValidationResult): void {
    // Check for insecure defaults in production
    const insecureChecks = [
      {
        key: 'JWT_SECRET',
        check: (value: string) => value === 'your-secret-key' || value.length < 32,
        message: 'JWT_SECRET should be a strong, unique secret in production',
      },
      {
        key: 'DB_PASSWORD',
        check: (value: string) => ['password', 'admin', '123456'].includes(value.toLowerCase()),
        message: 'Database password appears to be insecure',
      },
      {
        key: 'NODE_ENV',
        check: (value: string) => value !== 'production',
        message: 'NODE_ENV should be set to "production" in production environment',
      },
    ];

    for (const check of insecureChecks) {
      const value = result.config[check.key];
      if (value && check.check(value)) {
        result.warnings.push(check.message);
      }
    }
  }

  private logValidationResults(result: EnvironmentValidationResult): void {
    if (result.isValid) {
      this.logger.log(`Environment validation passed for ${result.environment}`);
      if (result.warnings.length > 0) {
        this.logger.warn(`Warnings: ${result.warnings.length}`);
      }
    } else {
      this.logger.error(`Environment validation failed: ${result.errors.length} errors`);
    }
  }
}