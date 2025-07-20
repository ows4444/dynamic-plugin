import { Injectable, Logger } from '@nestjs/common';
import type { ConfigSchema } from './config-loader.service';

/**
 * Configuration validation service
 */
@Injectable()
export class ConfigValidatorService {
  private readonly logger = new Logger(ConfigValidatorService.name);

  /**
   * Validate configuration against schema
   */
  validateConfig(config: Record<string, unknown>, schema: ConfigSchema): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate required properties
      if (schema.required) {
        for (const requiredField of schema.required) {
          if (!(requiredField in config) || config[requiredField] === undefined) {
            errors.push(`Required field '${requiredField}' is missing`);
          }
        }
      }

      // Validate property types and constraints
      for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
        const value = config[propertyName];

        if (value !== undefined) {
          const fieldValidation = this.validateProperty(propertyName, value, propertySchema);
          errors.push(...fieldValidation.errors);
          warnings.push(...fieldValidation.warnings);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error('Configuration validation failed', error);
      return {
        valid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
      };
    }
  }

  /**
   * Validate a single property
   */
  private validateProperty(name: string, value: unknown, schema: PropertySchema): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Type validation
    if (!this.validateType(value, schema.type)) {
      errors.push(`Property '${name}' should be of type '${schema.type}' but got '${typeof value}'`);
      return { valid: false, errors, warnings };
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`Property '${name}' should be one of: ${schema.enum.join(', ')}`);
    }

    // Number constraints
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`Property '${name}' should be >= ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`Property '${name}' should be <= ${schema.maximum}`);
      }
    }

    // String constraints
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`Property '${name}' should have at least ${schema.minLength} characters`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`Property '${name}' should have at most ${schema.maxLength} characters`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate value type
   */
  private validateType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Validate plugin configuration
   */
  validatePluginConfig(config: Record<string, unknown>, _pluginId: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic plugin configuration validation
    const requiredFields = ['id', 'name', 'version'];
    for (const field of requiredFields) {
      if (!(field in config) || config[field] === undefined) {
        errors.push(`Plugin configuration missing required field: ${field}`);
      }
    }

    // Validate plugin ID format
    if (config.id && typeof config.id === 'string') {
      if (!/^[a-z0-9-]+$/.test(config.id)) {
        errors.push('Plugin ID should only contain lowercase letters, numbers, and hyphens');
      }
    }

    // Validate version format
    if (config.version && typeof config.version === 'string') {
      if (!/^\d+\.\d+\.\d+/.test(config.version)) {
        warnings.push('Plugin version should follow semantic versioning (x.y.z)');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PropertySchema {
  type: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}
