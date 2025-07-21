import { Injectable } from '@nestjs/common';
import type { 
  ValidationError, 
  ValidationResult 
} from '../../plugin-types/src/validation.interface';

export interface ValidationRule {
  type:
    | 'required'
    | 'string'
    | 'number'
    | 'boolean'
    | 'array'
    | 'object'
    | 'email'
    | 'url';
  message?: string;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

export interface ValidationSchema {
  [field: string]: ValidationRule | ValidationRule[];
}

export interface ValidationData {
  [key: string]: unknown;
}

@Injectable()
export class ValidationUtil {
  static validate(data: ValidationData, schema: ValidationSchema): ValidationResult {
    const errors: ValidationError[] = [];

    for (const [field, rules] of Object.entries(schema)) {
      const fieldRules = Array.isArray(rules) ? rules : [rules];
      const value = data[field];

      for (const rule of fieldRules) {
        const error = this.validateField(field, value, rule);
        if (error) {
          errors.push(error);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  private static validateField(
    field: string,
    value: unknown,
    rule: ValidationRule,
  ): ValidationError | null {
    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return {
            field,
            message: rule.message ?? `${field} is required`,
            code: 'MISSING_REQUIRED',
            value,
          };
        }
        break;

      case 'string':
        if (typeof value !== 'string') {
          return {
            field,
            message: rule.message ?? `${field} must be a string`,
            code: 'INVALID_TYPE',
            value,
          };
        }
        if (rule.min && value.length < rule.min) {
          return {
            field,
            message:
              rule.message ??
              `${field} must be at least ${rule.min} characters`,
            code: 'INVALID_LENGTH',
            value,
          };
        }
        if (rule.max && value.length > rule.max) {
          return {
            field,
            message:
              rule.message ?? `${field} must be at most ${rule.max} characters`,
            code: 'INVALID_LENGTH',
            value,
          };
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          return {
            field,
            message: rule.message ?? `${field} format is invalid`,
            code: 'INVALID_FORMAT',
            value,
          };
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return {
            field,
            message: rule.message ?? `${field} must be a number`,
            code: 'INVALID_TYPE',
            value,
          };
        }
        if (rule.min && value < rule.min) {
          return {
            field,
            message: rule.message ?? `${field} must be at least ${rule.min}`,
            code: 'INVALID_RANGE',
            value,
          };
        }
        if (rule.max && value > rule.max) {
          return {
            field,
            message: rule.message ?? `${field} must be at most ${rule.max}`,
            code: 'INVALID_RANGE',
            value,
          };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return {
            field,
            message: rule.message ?? `${field} must be a boolean`,
            code: 'INVALID_TYPE',
            value,
          };
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return {
            field,
            message: rule.message ?? `${field} must be an array`,
            code: 'INVALID_TYPE',
            value,
          };
        }
        if (rule.min && value.length < rule.min) {
          return {
            field,
            message:
              rule.message ?? `${field} must have at least ${rule.min} items`,
            code: 'INVALID_LENGTH',
            value,
          };
        }
        if (rule.max && value.length > rule.max) {
          return {
            field,
            message:
              rule.message ?? `${field} must have at most ${rule.max} items`,
            code: 'INVALID_LENGTH',
            value,
          };
        }
        break;

      case 'object':
        if (
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)
        ) {
          return {
            field,
            message: rule.message ?? `${field} must be an object`,
            code: 'INVALID_TYPE',
            value,
          };
        }
        break;

      case 'email':
        if (
          typeof value !== 'string' ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ) {
          return {
            field,
            message: rule.message ?? `${field} must be a valid email address`,
            code: 'INVALID_FORMAT',
            value,
          };
        }
        break;

      case 'url':
        if (typeof value !== 'string') {
          return {
            field,
            message: rule.message ?? `${field} must be a valid URL`,
            code: 'INVALID_TYPE',
            value,
          };
        }
        try {
          new URL(value);
        } catch {
          return {
            field,
            message: rule.message ?? `${field} must be a valid URL`,
            code: 'INVALID_FORMAT',
            value,
          };
        }
        break;
    }

    return null;
  }

  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  static isValidPluginName(name: string): boolean {
    return (
      /^[a-z][a-z0-9-]*[a-z0-9]$/.test(name) &&
      name.length >= 3 &&
      name.length <= 50
    );
  }

  static isValidVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?(\+[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?$/.test(
      version,
    );
  }
}
