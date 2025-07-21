export type ConfigValue = string | number | boolean | ConfigObject | ConfigArray | null | undefined;

export interface ConfigObject {
  [key: string]: ConfigValue;
}

export type ConfigArray = ConfigValue[];

export interface ConfigSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  default?: ConfigValue;
  enum?: ConfigValue[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  properties?: Record<string, ConfigSchema>;
  items?: ConfigSchema;
  description?: string;
}

export interface PluginConfig {
  [key: string]: ConfigValue;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

type TypeValidator = (value: unknown) => boolean;

export class ConfigValidator {
  private static readonly TYPE_VALIDATORS: Record<string, TypeValidator> = {
    string: (value: unknown): value is string => typeof value === 'string',
    number: (value: unknown): value is number => typeof value === 'number' && !isNaN(value),
    boolean: (value: unknown): value is boolean => typeof value === 'boolean',
    object: (value: unknown): value is ConfigObject =>
      typeof value === 'object' && value !== null && !Array.isArray(value),
    array: (value: unknown): value is ConfigArray => Array.isArray(value),
  };

  static validate(
    config: PluginConfig,
    schema: Record<string, ConfigSchema>,
  ): ValidationResult {
    const errors: string[] = [];

    this.validateObject(
      config,
      { type: 'object', properties: schema },
      '',
      errors,
    );

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static validateObject(
    value: unknown,
    schema: ConfigSchema,
    path: string,
    errors: string[],
  ): void {
    if (!schema.properties) {
      return;
    }

    if (value === null || value === undefined) {
      if (schema.required) {
        errors.push(`Missing required field at ${path ?? 'root'}`);
      }
      return;
    }

    if (!this.TYPE_VALIDATORS.object(value)) {
      errors.push(`Expected object at ${path ?? 'root'}, got ${typeof value}`);
      return;
    }

    for (const [key, propertySchema] of Object.entries(schema.properties)) {
      const propertyPath = path ? `${path}.${key}` : key;
      const propertyValue = this.getPropertyValue(value as ConfigObject, key);

      if (propertyValue === undefined || propertyValue === null) {
        if (propertySchema.required) {
          errors.push(`Missing required field: ${propertyPath}`);
        }
        continue;
      }

      this.validateValue(propertyValue, propertySchema, propertyPath, errors);
    }
  }

  private static validateValue(
    value: unknown,
    schema: ConfigSchema,
    path: string,
    errors: string[],
  ): void {
    if (value === null || value === undefined) {
      if (schema.required) {
        errors.push(`Missing required field: ${path}`);
      }
      return;
    }

    this.validateType(value, schema, path, errors);

    if (errors.length > 0) {
      return;
    }

    this.validateConstraints(value, schema, path, errors);

    if (schema.type === 'object' && schema.properties) {
      this.validateObject(value, schema, path, errors);
    }

    if (schema.type === 'array' && schema.items && Array.isArray(value)) {
      this.validateArray(value as ConfigArray, schema, path, errors);
    }
  }

  private static validateType(
    value: unknown,
    schema: ConfigSchema,
    path: string,
    errors: string[],
  ): void {
    const validator = this.TYPE_VALIDATORS[schema.type];
    if (!validator?.(value)) {
      errors.push(`Expected ${schema.type} at ${path}, got ${typeof value}`);
    }
  }

  private static validateConstraints(
    value: unknown,
    schema: ConfigSchema,
    path: string,
    errors: string[],
  ): void {
    if (schema.enum && !schema.enum.includes(value)) {
      const enumValues = schema.enum.map(v => {
        if (typeof v === 'string') {
          return `"${v}"`;
        } else if (typeof v === 'number' || typeof v === 'boolean') {
          return String(v);
        } else if (v === null) {
          return 'null';
        } else if (v === undefined) {
          return 'undefined';
        } else {
          return JSON.stringify(v);
        }
      }).join(', ');
      errors.push(`Value at ${path} must be one of: ${enumValues}`);
    }

    if (schema.type === 'string') {
      this.validateStringConstraints(value as string, schema, path, errors);
    }

    if (schema.type === 'number') {
      this.validateNumberConstraints(value as number, schema, path, errors);
    }

    if (schema.type === 'array' && Array.isArray(value)) {
      this.validateArrayConstraints(value as ConfigArray, schema, path, errors);
    }
  }

  private static validateStringConstraints(
    value: string,
    schema: ConfigSchema,
    path: string,
    errors: string[],
  ): void {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(
        `String at ${path} must be at least ${schema.minLength} characters long`,
      );
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(
        `String at ${path} must be at most ${schema.maxLength} characters long`,
      );
    }

    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push(
          `String at ${path} does not match required pattern: ${schema.pattern}`,
        );
      }
    }
  }

  private static validateNumberConstraints(
    value: number,
    schema: ConfigSchema,
    path: string,
    errors: string[],
  ): void {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`Number at ${path} must be at least ${schema.minimum}`);
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`Number at ${path} must be at most ${schema.maximum}`);
    }
  }

  private static validateArrayConstraints(
    value: ConfigArray,
    schema: ConfigSchema,
    path: string,
    errors: string[],
  ): void {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(
        `Array at ${path} must have at least ${schema.minLength} items`,
      );
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(
        `Array at ${path} must have at most ${schema.maxLength} items`,
      );
    }
  }

  private static validateArray(
    value: ConfigArray,
    schema: ConfigSchema,
    path: string,
    errors: string[],
  ): void {
    if (!schema.items) {
      return;
    }

    for (let i = 0; i < value.length; i++) {
      const itemPath = `${path}[${i}]`;
      this.validateValue(value[i], schema.items, itemPath, errors);
    }
  }

  static applyDefaults(
    config: PluginConfig,
    schema: Record<string, ConfigSchema>,
  ): PluginConfig {
    const result = { ...config };

    for (const [key, propertySchema] of Object.entries(schema)) {
      if (result[key] === undefined && propertySchema.default !== undefined) {
        result[key] = this.cloneValue(propertySchema.default);
      }

      if (
        propertySchema.type === 'object' &&
        propertySchema.properties &&
        result[key]
      ) {
        result[key] = this.applyDefaults(
          result[key] as PluginConfig,
          propertySchema.properties,
        );
      }
    }

    return result;
  }

  private static cloneValue(value: ConfigValue): ConfigValue {
    if (value === null || value === undefined || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.cloneValue(item));
    }

    const cloned: ConfigObject = {};
    for (const [key, val] of Object.entries(value)) {
      cloned[key] = this.cloneValue(val);
    }
    return cloned;
  }

  static generateSchema(example: PluginConfig): Record<string, ConfigSchema> {
    const schema: Record<string, ConfigSchema> = {};

    for (const [key, value] of Object.entries(example)) {
      schema[key] = this.inferSchemaFromValue(value);
    }

    return schema;
  }

  private static inferSchemaFromValue(value: ConfigValue): ConfigSchema {
    if (typeof value === 'string') {
      return { type: 'string', default: value };
    }

    if (typeof value === 'number') {
      return { type: 'number', default: value };
    }

    if (typeof value === 'boolean') {
      return { type: 'boolean', default: value };
    }

    if (Array.isArray(value)) {
      const itemSchema =
        value.length > 0
          ? this.inferSchemaFromValue(value[0])
          : { type: 'string' as const };
      return { type: 'array', items: itemSchema, default: value };
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const properties: Record<string, ConfigSchema> = {};
      for (const [key, val] of Object.entries(value)) {
        properties[key] = this.inferSchemaFromValue(val);
      }
      return { type: 'object', properties, default: value };
    }

    return { type: 'string' };
  }

  private static getPropertyValue(obj: ConfigObject, key: string): ConfigValue {
    return obj[key];
  }
}
