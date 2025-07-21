import { Injectable } from '@nestjs/common';

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

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

@Injectable()
export class ValidationUtil {
  static validate(data: any, schema: ValidationSchema): ValidationResult {
    const errors: ValidationError[] = [];

    for (const [field, rules] in Object.entries(schema)) {
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
    };
  }

  private static validateField(
    field: string,
    value: any,
    rule: ValidationRule,
  ): ValidationError | null {
    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return {
            field,
            message: rule.message || `${field} is required`,
            value,
          };
        }
        break;

      case 'string':
        if (typeof value !== 'string') {
          return {
            field,
            message: rule.message || `${field} must be a string`,
            value,
          };
        }
        if (rule.min && value.length < rule.min) {
          return {
            field,
            message:
              rule.message ||
              `${field} must be at least ${rule.min} characters`,
            value,
          };
        }
        if (rule.max && value.length > rule.max) {
          return {
            field,
            message:
              rule.message || `${field} must be at most ${rule.max} characters`,
            value,
          };
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          return {
            field,
            message: rule.message || `${field} format is invalid`,
            value,
          };
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return {
            field,
            message: rule.message || `${field} must be a number`,
            value,
          };
        }
        if (rule.min && value < rule.min) {
          return {
            field,
            message: rule.message || `${field} must be at least ${rule.min}`,
            value,
          };
        }
        if (rule.max && value > rule.max) {
          return {
            field,
            message: rule.message || `${field} must be at most ${rule.max}`,
            value,
          };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return {
            field,
            message: rule.message || `${field} must be a boolean`,
            value,
          };
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return {
            field,
            message: rule.message || `${field} must be an array`,
            value,
          };
        }
        if (rule.min && value.length < rule.min) {
          return {
            field,
            message:
              rule.message || `${field} must have at least ${rule.min} items`,
            value,
          };
        }
        if (rule.max && value.length > rule.max) {
          return {
            field,
            message:
              rule.message || `${field} must have at most ${rule.max} items`,
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
            message: rule.message || `${field} must be an object`,
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
            message: rule.message || `${field} must be a valid email address`,
            value,
          };
        }
        break;

      case 'url':
        if (typeof value !== 'string') {
          return {
            field,
            message: rule.message || `${field} must be a valid URL`,
            value,
          };
        }
        try {
          new URL(value);
        } catch {
          return {
            field,
            message: rule.message || `${field} must be a valid URL`,
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
