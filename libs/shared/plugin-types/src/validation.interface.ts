/**
 * Validation system interfaces for plugins
 */

// Standard validation error codes
export enum ValidationErrorCode {
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_VALUE = 'INVALID_VALUE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_RANGE = 'INVALID_RANGE',
  INVALID_LENGTH = 'INVALID_LENGTH',
  DUPLICATE_VALUE = 'DUPLICATE_VALUE',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION'
}

// Standard validation warning codes
export enum ValidationWarningCode {
  DEPRECATED = 'DEPRECATED',
  UNUSED = 'UNUSED',
  SUBOPTIMAL = 'SUBOPTIMAL',
  MISSING_OPTIONAL = 'MISSING_OPTIONAL'
}

// Base validation error interface
export interface ValidationError {
  field: string;
  message: string;
  code: ValidationErrorCode | string;
  value?: unknown;
  expected?: string | string[];
  severity?: 'error' | 'warning';
  suggestions?: string[];
}

// Base validation warning interface
export interface ValidationWarning {
  field: string;
  message: string;
  code: ValidationWarningCode | string;
  value?: unknown;
  suggestions?: string[];
}

// Standard validation result interface
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
  metadata?: {
    validatedAt: Date;
    validatorVersion: string;
    performance?: {
      duration: number;
      checksPerformed: number;
    };
  };
}

// Extended validation result for complex validations
export interface ExtendedValidationResult<T = unknown> extends ValidationResult {
  data?: T;
  transformedData?: T;
  context?: Record<string, unknown>;
}

// Validation context for providing additional information during validation
export interface ValidationContext {
  strict?: boolean;
  allowDeprecated?: boolean;
  environment?: 'development' | 'staging' | 'production';
  customRules?: ValidationRule[];
  metadata?: Record<string, unknown>;
}

// Validation rule interface for extensibility
export interface ValidationRule {
  name: string;
  field?: string;
  validate: (data: unknown, context?: ValidationContext) => ValidationError[];
  async?: boolean;
  priority?: number;
  description?: string;
}

// Validator factory interface
export interface ValidatorFactory {
  createValidator<T = unknown>(
    rules: ValidationRule[],
    context?: ValidationContext
  ): Validator<T>;
}

// Generic validator interface
export interface Validator<T = unknown> {
  validate(data: unknown, context?: ValidationContext): ExtendedValidationResult<T>;
  validateAsync?(data: unknown, context?: ValidationContext): Promise<ExtendedValidationResult<T>>;
  addRule(rule: ValidationRule): void;
  removeRule(ruleName: string): boolean;
  getRules(): ValidationRule[];
}