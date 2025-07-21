/**
 * Configuration type system for plugins
 */

// Base type for configuration values  
export type ConfigValue = 
  | string 
  | number 
  | boolean 
  | null
  | undefined
  | ConfigArray 
  | ConfigObject;

// Helper types for structured config values
export interface ConfigObject {
  [key: string]: ConfigValue;
}

export type ConfigArray = ConfigValue[];

// Schema definition for configuration validation
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

// Main plugin configuration interface
export interface PluginConfig {
  [key: string]: ConfigValue;
}

// Schema for the entire plugin configuration
export interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, ConfigSchema>;
  required?: string[];
  additionalProperties?: boolean;
}

// Configuration validation result
export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings?: ConfigValidationWarning[];
}

// Configuration validation error
export interface ConfigValidationError {
  field: string;
  message: string;
  code: 'MISSING_REQUIRED' | 'INVALID_TYPE' | 'INVALID_VALUE' | 'INVALID_FORMAT';
  value?: ConfigValue;
  expected?: string | string[];
}

// Configuration validation warning
export interface ConfigValidationWarning {
  field: string;
  message: string;
  code: 'DEPRECATED' | 'UNUSED' | 'SUBOPTIMAL';
  value?: ConfigValue;
}