import { PluginPermission, SecurityLevel } from '../enums/permission.enum';
import { PluginCategory, PluginType } from '../enums/plugin-status.enum';

// Comprehensive type definitions for manifest components
export interface PluginAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface PluginLicense {
  type: string;
  url?: string;
}

export interface PluginRepository {
  type: 'git' | 'svn' | 'mercurial';
  url: string;
  directory?: string;
}

export interface PluginEngines {
  node?: string;
  npm?: string;
  host?: string;
}

export interface PluginConfiguration {
  schema?: Record<string, unknown>;
  defaults?: Record<string, unknown>;
  required?: string[];
  properties?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    default?: unknown;
    enum?: unknown[];
  }>;
}

export interface PluginMetadata {
  displayName?: string;
  description?: string;
  icon?: string;
  screenshots?: string[];
  keywords?: string[];
  homepage?: string;
  bugs?: string | { url: string; email?: string };
  funding?: string | { type: string; url: string }[];
  contributors?: (string | PluginAuthor)[];
  maintainers?: (string | PluginAuthor)[];
}

export interface PluginRoute {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  description?: string;
  deprecated?: boolean;
}

export interface PluginHook {
  name: string;
  description?: string;
  async?: boolean;
  priority?: number;
}

export interface PluginManifest {
  // Required core fields
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string | PluginAuthor;
  readonly license: string | PluginLicense;
  readonly type: PluginType;
  readonly category: PluginCategory;
  readonly main: string;
  
  // Required security and compatibility
  readonly permissions: readonly PluginPermission[];
  readonly securityLevel: SecurityLevel;
  readonly supportedVersions: readonly string[];
  readonly minHostVersion: string;
  
  // Optional fields with strict typing
  readonly maxHostVersion?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  
  // Optional advanced features
  readonly routes?: readonly (string | PluginRoute)[];
  readonly hooks?: readonly (string | PluginHook)[];
  readonly configuration?: PluginConfiguration;
  readonly metadata?: PluginMetadata;
  readonly engines?: PluginEngines;
  readonly repository?: PluginRepository;
  
  // Optional runtime settings
  readonly priority?: number;
  readonly timeout?: number;
  readonly retries?: number;
  readonly healthCheck?: {
    readonly endpoint?: string;
    readonly interval?: number;
    readonly timeout?: number;
  };
}

// Type for unknown input during validation
export type UnknownManifest = Record<string, unknown>;

// Type for partial manifest during incremental validation
export type PartialManifest = Partial<PluginManifest>;

// Detailed error types for comprehensive error handling
export enum ValidationErrorCode {
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_VALUE = 'INVALID_VALUE',
  INVALID_RANGE = 'INVALID_RANGE',
  INVALID_ENUM_VALUE = 'INVALID_ENUM_VALUE',
  INVALID_DEPENDENCY = 'INVALID_DEPENDENCY',
  INVALID_PERMISSION = 'INVALID_PERMISSION',
  INVALID_SECURITY_LEVEL = 'INVALID_SECURITY_LEVEL',
  INVALID_VERSION = 'INVALID_VERSION',
  INVALID_ROUTE = 'INVALID_ROUTE',
  INVALID_HOOK = 'INVALID_HOOK',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  INVALID_METADATA = 'INVALID_METADATA',
  UNSUPPORTED_FEATURE = 'UNSUPPORTED_FEATURE',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
}

export interface ValidationError {
  readonly code: ValidationErrorCode;
  readonly field: string;
  readonly message: string;
  readonly value?: unknown;
  readonly expected?: string | string[];
  readonly severity: 'error' | 'warning' | 'info';
  readonly suggestions?: string[];
}

export interface ValidationWarning {
  readonly code: string;
  readonly field: string;
  readonly message: string;
  readonly value?: unknown;
  readonly suggestions?: string[];
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly manifest?: PluginManifest;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
  readonly metadata: {
    readonly validatedAt: Date;
    readonly validatorVersion: string;
    readonly performance: {
      readonly duration: number;
      readonly checksPerformed: number;
    };
  };
}

export interface ValidationContext {
  readonly strict: boolean;
  readonly allowDeprecated: boolean;
  readonly maxFileSize?: number;
  readonly customRules?: ValidationRule[];
  readonly environment?: 'development' | 'staging' | 'production';
}

// Validation rule interface for extensibility
export interface ValidationRule {
  readonly name: string;
  readonly field?: string;
  readonly validate: (manifest: UnknownManifest, context: ValidationContext) => ValidationError[];
  readonly async?: boolean;
  readonly priority?: number;
}

// Type guards for runtime validation and type narrowing
export const TypeGuards = {
  isString: (value: unknown): value is string => typeof value === 'string',
  
  isNonEmptyString: (value: unknown): value is string => 
    typeof value === 'string' && value.trim().length > 0,
    
  isStringArray: (value: unknown): value is string[] => 
    Array.isArray(value) && value.every(item => typeof item === 'string'),
    
  isRecord: (value: unknown): value is Record<string, unknown> => 
    typeof value === 'object' && value !== null && !Array.isArray(value),
    
  isStringRecord: (value: unknown): value is Record<string, string> =>
    TypeGuards.isRecord(value) && Object.values(value).every(v => typeof v === 'string'),
    
  isPluginType: (value: unknown): value is PluginType => 
    Object.values(PluginType).includes(value as PluginType),
    
  isPluginCategory: (value: unknown): value is PluginCategory => 
    Object.values(PluginCategory).includes(value as PluginCategory),
    
  isPluginPermissionArray: (value: unknown): value is PluginPermission[] =>
    Array.isArray(value) && value.every(item => 
      Object.values(PluginPermission).includes(item as PluginPermission)
    ),
    
  isSecurityLevel: (value: unknown): value is SecurityLevel => 
    Object.values(SecurityLevel).includes(value as SecurityLevel),
    
  isVersionString: (value: unknown): value is string => {
    if (!TypeGuards.isString(value)) return false;
    return /^\d+\.\d+\.\d+(-[\w\d-]+)?(\+[\w\d-]+)?$/.test(value);
  },
  
  isPluginAuthor: (value: unknown): value is PluginAuthor => {
    if (TypeGuards.isString(value)) return true;
    if (!TypeGuards.isRecord(value)) return false;
    
    const record = value;
    return TypeGuards.isNonEmptyString(record.name) &&
           (record.email === undefined || TypeGuards.isString(record.email)) &&
           (record.url === undefined || TypeGuards.isString(record.url));
  },
  
  isPluginLicense: (value: unknown): value is PluginLicense => {
    if (TypeGuards.isString(value)) return true;
    if (!TypeGuards.isRecord(value)) return false;
    
    const record = value;
    return TypeGuards.isNonEmptyString(record.type) &&
           (record.url === undefined || TypeGuards.isString(record.url));
  },
  
  isPluginConfiguration: (value: unknown): value is PluginConfiguration => {
    if (!TypeGuards.isRecord(value)) return false;
    
    const config = value;
    return (config.schema === undefined || TypeGuards.isRecord(config.schema)) &&
           (config.defaults === undefined || TypeGuards.isRecord(config.defaults)) &&
           (config.required === undefined || TypeGuards.isStringArray(config.required)) &&
           (config.properties === undefined || TypeGuards.isRecord(config.properties));
  },
  
  isManifestLike: (value: unknown): value is UnknownManifest => 
    TypeGuards.isRecord(value),
    
} as const;

// Mutable version for building validation rules
interface MutableValidationRule {
  name?: string;
  field?: string;
  validate?: ValidationRule['validate'];
  async?: boolean;
  priority?: number;
}

// Builder pattern for validation rules with fluent API
export class ValidationRuleBuilder {
  private rule: MutableValidationRule = {};
  
  name(name: string): this {
    this.rule.name = name;
    return this;
  }
  
  field(field: string): this {
    this.rule.field = field;
    return this;
  }
  
  validate(validator: ValidationRule['validate']): this {
    this.rule.validate = validator;
    return this;
  }
  
  async(async = true): this {
    this.rule.async = async;
    return this;
  }
  
  priority(priority: number): this {
    this.rule.priority = priority;
    return this;
  }
  
  build(): ValidationRule {
    if (!this.rule.name || !this.rule.validate) {
      throw new Error('ValidationRule must have a name and validate function');
    }
    
    return {
      name: this.rule.name,
      field: this.rule.field,
      validate: this.rule.validate,
      async: this.rule.async ?? false,
      priority: this.rule.priority ?? 0,
    };
  }
  
  static create(): ValidationRuleBuilder {
    return new ValidationRuleBuilder();
  }
}

// Error factory for creating typed validation errors
export class ValidationErrorFactory {
  static createError(
    code: ValidationErrorCode,
    field: string,
    message: string,
    options: {
      value?: unknown;
      expected?: string | string[];
      severity?: ValidationError['severity'];
      suggestions?: string[];
    } = {}
  ): ValidationError {
    return {
      code,
      field,
      message,
      value: options.value,
      expected: options.expected,
      severity: options.severity ?? 'error',
      suggestions: options.suggestions,
    };
  }
  
  static missingField(field: string, suggestions?: string[]): ValidationError {
    return this.createError(
      ValidationErrorCode.MISSING_REQUIRED_FIELD,
      field,
      `Missing required field: ${field}`,
      { suggestions }
    );
  }
  
  static invalidType(
    field: string,
    expected: string | string[],
    actual: unknown,
    suggestions?: string[]
  ): ValidationError {
    return this.createError(
      ValidationErrorCode.INVALID_TYPE,
      field,
      `Invalid type for field ${field}. Expected ${Array.isArray(expected) ? expected.join(' or ') : expected}, got ${typeof actual}`,
      { value: actual, expected, suggestions }
    );
  }
  
  static invalidFormat(
    field: string,
    format: string,
    value: unknown,
    suggestions?: string[]
  ): ValidationError {
    return this.createError(
      ValidationErrorCode.INVALID_FORMAT,
      field,
      `Invalid format for field ${field}. Expected ${format}`,
      { value, expected: format, suggestions }
    );
  }
  
  static invalidEnumValue(
    field: string,
    validValues: string[],
    actual: unknown,
    suggestions?: string[]
  ): ValidationError {
    return this.createError(
      ValidationErrorCode.INVALID_ENUM_VALUE,
      field,
      `Invalid value for field ${field}. Must be one of: ${validValues.join(', ')}`,
      { value: actual, expected: validValues, suggestions }
    );
  }
}

// Type-safe validator class with architectural separation
export class ManifestValidator {
  private static readonly VALIDATOR_VERSION = '2.0.0';
  
  private static readonly REQUIRED_FIELDS: readonly (keyof PluginManifest)[] = [
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
  ] as const;

  private static readonly VERSION_REGEX = /^\d+\.\d+\.\d+(-[\w\d-]+)?(\+[\w\d-]+)?$/;
  private static readonly NAME_REGEX = /^[a-z]([a-z0-9-])*[a-z0-9]$/;

  // Main validation method with comprehensive type safety
  static validate(
    input: unknown, 
    context: Partial<ValidationContext> = {}
  ): ValidationResult {
    const startTime = performance.now();
    const validationContext: ValidationContext = {
      strict: false,
      allowDeprecated: true,
      environment: 'production',
      ...context
    };

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let checksPerformed = 0;

    // Initial type guard check
    if (!TypeGuards.isManifestLike(input)) {
      return this.createFailureResult(
        [ValidationErrorFactory.createError(
          ValidationErrorCode.INVALID_TYPE,
          'manifest',
          'Manifest must be a valid object',
          { value: input, expected: 'object' }
        )],
        [],
        startTime,
        checksPerformed
      );
    }

    const manifest = input;
    checksPerformed++;

    // Core validation steps
    this.validateStructure(manifest, errors, validationContext);
    checksPerformed += this.REQUIRED_FIELDS.length;
    
    this.validateCoreFields(manifest, errors, validationContext);
    checksPerformed += 8;
    
    this.validateOptionalFields(manifest, errors, warnings, validationContext);
    checksPerformed += 6;
    
    this.validateAdvancedFeatures(manifest, errors, warnings, validationContext);
    checksPerformed += 4;

    // Apply custom rules if provided
    if (validationContext.customRules) {
      for (const rule of validationContext.customRules) {
        const ruleErrors = rule.validate(manifest, validationContext);
        errors.push(...ruleErrors);
        checksPerformed++;
      }
    }

    const endTime = performance.now();
    const valid = errors.length === 0;

    return {
      valid,
      manifest: valid ? this.transformToTypedManifest(manifest) : undefined,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validatorVersion: this.VALIDATOR_VERSION,
        performance: {
          duration: endTime - startTime,
          checksPerformed,
        },
      },
    };
  }

  // Legacy compatibility method
  static validateLegacy(manifest: unknown): { valid: boolean; errors: string[] } {
    const result = this.validate(manifest, { strict: false, allowDeprecated: true });
    return {
      valid: result.valid,
      errors: result.errors.map(error => error.message),
    };
  }

  // Utility method for creating failure results
  private static createFailureResult(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    startTime: number,
    checksPerformed: number
  ): ValidationResult {
    return {
      valid: false,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validatorVersion: this.VALIDATOR_VERSION,
        performance: {
          duration: performance.now() - startTime,
          checksPerformed,
        },
      },
    };
  }

  // Transform validated manifest to typed version
  private static transformToTypedManifest(manifest: UnknownManifest): PluginManifest {
    // At this point we know the manifest is valid, so we can safely cast
    return manifest as unknown as PluginManifest;
  }

  // Validate structural integrity
  private static validateStructure(
    manifest: UnknownManifest,
    errors: ValidationError[],
    _context: ValidationContext
  ): void {
    for (const field of this.REQUIRED_FIELDS) {
      if (!(field in manifest) || manifest[field] === null || manifest[field] === undefined) {
        errors.push(ValidationErrorFactory.missingField(field, [
          `Add the required field '${field}' to your manifest`,
        ]));
      }
    }
  }

  // Validate core required fields with proper typing
  private static validateCoreFields(
    manifest: UnknownManifest,
    errors: ValidationError[],
    _context: ValidationContext
  ): void {
    this.validatePluginName(manifest.name, errors);
    this.validateVersion(manifest.version, errors);
    this.validateDescription(manifest.description, errors);
    this.validateAuthor(manifest.author, errors);
    this.validateLicense(manifest.license, errors);
    this.validatePluginType(manifest.type, errors);
    this.validatePluginCategory(manifest.category, errors);
    this.validateMainField(manifest.main, errors);
    this.validatePermissions(manifest.permissions, errors);
    this.validateSecurityLevel(manifest.securityLevel, errors);
    this.validateSupportedVersions(manifest.supportedVersions, errors);
    this.validateHostVersions(manifest.minHostVersion, manifest.maxHostVersion, errors);
  }

  // Validate optional fields
  private static validateOptionalFields(
    manifest: UnknownManifest,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    _context: ValidationContext
  ): void {
    if (manifest.dependencies !== undefined) {
      this.validateDependencies(manifest.dependencies, errors);
    }
    
    if (manifest.peerDependencies !== undefined) {
      this.validatePeerDependencies(manifest.peerDependencies, errors);
    }
    
    if (manifest.routes !== undefined) {
      this.validateRoutes(manifest.routes, errors);
    }
    
    if (manifest.hooks !== undefined) {
      this.validateHooks(manifest.hooks, errors);
    }
    
    if (manifest.configuration !== undefined) {
      this.validateConfiguration(manifest.configuration, errors);
    }
    
    if (manifest.metadata !== undefined) {
      this.validateMetadata(manifest.metadata, errors, warnings);
    }
  }

  // Validate advanced features
  private static validateAdvancedFeatures(
    manifest: UnknownManifest,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    _context: ValidationContext
  ): void {
    if (manifest.engines !== undefined) {
      this.validateEngines(manifest.engines, errors);
    }
    
    if (manifest.repository !== undefined) {
      this.validateRepository(manifest.repository, errors);
    }
    
    if (manifest.healthCheck !== undefined) {
      this.validateHealthCheck(manifest.healthCheck, errors);
    }
    
    // Additional validation for runtime settings
    this.validateRuntimeSettings(manifest, errors, warnings);
  }

  private static validatePluginName(name: unknown, errors: ValidationError[]): void {
    if (typeof name !== 'string') {
      errors.push(ValidationErrorFactory.invalidType('name', 'string', name));
      return;
    }

    if (!this.NAME_REGEX.test(name)) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_FORMAT,
        'name',
        'Plugin name must be lowercase, alphanumeric with hyphens, and cannot start or end with a hyphen',
        { value: name }
      ));
    }

    if (name.length < 3 || name.length > 50) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_VALUE,
        'name',
        'Plugin name must be between 3 and 50 characters',
        { value: name }
      ));
    }
  }

  private static validateVersion(version: unknown, errors: ValidationError[]): void {
    if (typeof version !== 'string') {
      errors.push(ValidationErrorFactory.invalidType('version', 'string', version));
      return;
    }

    if (!this.VERSION_REGEX.test(version)) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_FORMAT,
        'version',
        'Version must follow semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)',
        { value: version }
      ));
    }
  }

  private static validatePluginType(type: unknown, errors: ValidationError[]): void {
    if (!Object.values(PluginType).includes(type as PluginType)) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_VALUE,
        'type',
        `Invalid plugin type. Must be one of: ${Object.values(PluginType).join(', ')}`,
        { value: type, expected: Object.values(PluginType) }
      ));
    }
  }

  private static validatePluginCategory(category: unknown, errors: ValidationError[]): void {
    if (!Object.values(PluginCategory).includes(category as PluginCategory)) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_VALUE,
        'category',
        `Invalid plugin category. Must be one of: ${Object.values(PluginCategory).join(', ')}`,
        { value: category, expected: Object.values(PluginCategory) }
      ));
    }
  }

  private static validatePermissions(permissions: unknown, errors: ValidationError[]): void {
    if (!Array.isArray(permissions)) {
      errors.push(ValidationErrorFactory.invalidType('permissions', 'array', permissions));
      return;
    }

    for (const permission of permissions) {
      if (!Object.values(PluginPermission).includes(permission as PluginPermission)) {
        errors.push(ValidationErrorFactory.createError(
          ValidationErrorCode.INVALID_VALUE,
          'permissions',
          `Invalid permission: ${permission}. Must be one of: ${Object.values(PluginPermission).join(', ')}`,
          { value: permission, expected: Object.values(PluginPermission) }
        ));
      }
    }
  }

  private static validateSecurityLevel(
    securityLevel: unknown,
    errors: ValidationError[],
  ): void {
    if (!Object.values(SecurityLevel).includes(securityLevel as SecurityLevel)) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_VALUE,
        'securityLevel',
        `Invalid security level. Must be one of: ${Object.values(SecurityLevel).join(', ')}`,
        { value: securityLevel, expected: Object.values(SecurityLevel) }
      ));
    }
  }

  private static validateSupportedVersions(
    supportedVersions: unknown,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(supportedVersions)) {
      errors.push(ValidationErrorFactory.invalidType('supportedVersions', 'array', supportedVersions));
      return;
    }

    if (supportedVersions.length === 0) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_VALUE,
        'supportedVersions',
        'At least one supported version must be specified',
        { value: supportedVersions }
      ));
    }

    for (const version of supportedVersions) {
      if (typeof version !== 'string' || !this.VERSION_REGEX.test(version)) {
        errors.push(ValidationErrorFactory.createError(
          ValidationErrorCode.INVALID_FORMAT,
          'supportedVersions',
          `Invalid supported version: ${version}. Must follow semantic versioning`,
          { value: version }
        ));
      }
    }
  }

  private static validateDependencies(
    dependencies: unknown,
    errors: ValidationError[],
  ): void {
    if (dependencies !== undefined && typeof dependencies !== 'object') {
      errors.push(ValidationErrorFactory.invalidType('dependencies', 'object', dependencies));
      return;
    }

    if (dependencies) {
      for (const [name, version] of Object.entries(dependencies as Record<string, unknown>)) {
        if (typeof name !== 'string' || typeof version !== 'string') {
          errors.push(ValidationErrorFactory.createError(
            ValidationErrorCode.INVALID_VALUE,
            'dependencies',
            `Invalid dependency: ${name}@${String(version)}`,
            { value: { [name]: version } }
          ));
        }
      }
    }
  }

  private static validatePeerDependencies(
    peerDependencies: unknown,
    errors: ValidationError[],
  ): void {
    if (
      peerDependencies !== undefined &&
      typeof peerDependencies !== 'object'
    ) {
      errors.push(ValidationErrorFactory.invalidType('peerDependencies', 'object', peerDependencies));
      return;
    }

    if (peerDependencies) {
      for (const [name, version] of Object.entries(peerDependencies as Record<string, unknown>)) {
        if (typeof name !== 'string' || typeof version !== 'string') {
          errors.push(ValidationErrorFactory.createError(
            ValidationErrorCode.INVALID_VALUE,
            'peerDependencies',
            `Invalid peer dependency: ${name}@${String(version)}`,
            { value: { [name]: version } }
          ));
        }
      }
    }
  }

  private static validateRoutes(routes: unknown, errors: ValidationError[]): void {
    if (routes !== undefined && !Array.isArray(routes)) {
      errors.push(ValidationErrorFactory.invalidType('routes', 'array', routes));
      return;
    }

    if (routes) {
      for (const route of routes) {
        if (typeof route !== 'string') {
          errors.push(ValidationErrorFactory.createError(
            ValidationErrorCode.INVALID_VALUE,
            'routes',
            `Invalid route: ${route}. Routes must be strings`,
            { value: route }
          ));
        }
      }
    }
  }

  private static validateHooks(hooks: unknown, errors: ValidationError[]): void {
    if (hooks !== undefined && !Array.isArray(hooks)) {
      errors.push(ValidationErrorFactory.invalidType('hooks', 'array', hooks));
      return;
    }

    if (hooks) {
      for (const hook of hooks) {
        if (typeof hook !== 'string') {
          errors.push(ValidationErrorFactory.createError(
            ValidationErrorCode.INVALID_VALUE,
            'hooks',
            `Invalid hook: ${hook}. Hooks must be strings`,
            { value: hook }
          ));
        }
      }
    }
  }

  // Additional validation methods required by validateCoreFields
  private static validateDescription(description: unknown, errors: ValidationError[]): void {
    if (typeof description !== 'string') {
      errors.push(ValidationErrorFactory.invalidType('description', 'string', description));
      return;
    }

    if (description.trim().length === 0) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_VALUE,
        'description',
        'Description cannot be empty',
        { value: description }
      ));
    }

    if (description.length > 1000) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_VALUE,
        'description',
        'Description cannot exceed 1000 characters',
        { value: description }
      ));
    }
  }

  private static validateAuthor(author: unknown, errors: ValidationError[]): void {
    if (typeof author !== 'string' && typeof author !== 'object') {
      errors.push(ValidationErrorFactory.invalidType('author', ['string', 'object'], author));
      return;
    }

    if (typeof author === 'string') {
      if (author.trim().length === 0) {
        errors.push(ValidationErrorFactory.createError(
          ValidationErrorCode.INVALID_VALUE,
          'author',
          'Author name cannot be empty',
          { value: author }
        ));
      }
    } else if (author && typeof author === 'object') {
      const authorObj = author as Record<string, unknown>;
      if (!authorObj.name || typeof authorObj.name !== 'string') {
        errors.push(ValidationErrorFactory.missingField('author.name'));
      }
    }
  }

  private static validateLicense(license: unknown, errors: ValidationError[]): void {
    if (typeof license !== 'string') {
      errors.push(ValidationErrorFactory.invalidType('license', 'string', license));
      return;
    }

    if (license.trim().length === 0) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_VALUE,
        'license',
        'License cannot be empty',
        { value: license }
      ));
    }
  }

  private static validateMainField(main: unknown, errors: ValidationError[]): void {
    if (typeof main !== 'string') {
      errors.push(ValidationErrorFactory.invalidType('main', 'string', main));
      return;
    }

    if (main.trim().length === 0) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_VALUE,
        'main',
        'Main field cannot be empty',
        { value: main }
      ));
    }

    if (!main.endsWith('.js') && !main.endsWith('.ts')) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_FORMAT,
        'main',
        'Main field must point to a .js or .ts file',
        { value: main }
      ));
    }
  }

  private static validateHostVersions(minHostVersion: unknown, maxHostVersion: unknown, errors: ValidationError[]): void {
    if (typeof minHostVersion !== 'string') {
      errors.push(ValidationErrorFactory.invalidType('minHostVersion', 'string', minHostVersion));
    } else if (!this.VERSION_REGEX.test(minHostVersion)) {
      errors.push(ValidationErrorFactory.createError(
        ValidationErrorCode.INVALID_FORMAT,
        'minHostVersion',
        'Minimum host version must follow semantic versioning',
        { value: minHostVersion }
      ));
    }

    if (maxHostVersion !== undefined) {
      if (typeof maxHostVersion !== 'string') {
        errors.push(ValidationErrorFactory.invalidType('maxHostVersion', 'string', maxHostVersion));
      } else if (!this.VERSION_REGEX.test(maxHostVersion)) {
        errors.push(ValidationErrorFactory.createError(
          ValidationErrorCode.INVALID_FORMAT,
          'maxHostVersion',
          'Maximum host version must follow semantic versioning',
          { value: maxHostVersion }
        ));
      }
    }
  }

  private static validateConfiguration(configuration: unknown, errors: ValidationError[]): void {
    if (configuration !== undefined && typeof configuration !== 'object') {
      errors.push(ValidationErrorFactory.invalidType('configuration', 'object', configuration));
    }
  }

  private static validateMetadata(metadata: unknown, errors: ValidationError[]): void {
    if (metadata !== undefined && typeof metadata !== 'object') {
      errors.push(ValidationErrorFactory.invalidType('metadata', 'object', metadata));
    }
  }

  private static validateEngines(engines: unknown, errors: ValidationError[]): void {
    if (engines !== undefined && typeof engines !== 'object') {
      errors.push(ValidationErrorFactory.invalidType('engines', 'object', engines));
    }
  }

  private static validateRepository(repository: unknown, errors: ValidationError[]): void {
    if (repository !== undefined && typeof repository !== 'object') {
      errors.push(ValidationErrorFactory.invalidType('repository', 'object', repository));
    }
  }

  private static validateHealthCheck(healthCheck: unknown, errors: ValidationError[]): void {
    if (healthCheck !== undefined && typeof healthCheck !== 'object') {
      errors.push(ValidationErrorFactory.invalidType('healthCheck', 'object', healthCheck));
    }
  }

  private static validateRuntimeSettings(manifest: UnknownManifest, errors: ValidationError[], _warnings: ValidationWarning[]): void {
    // Basic runtime validation
    if (manifest.runtime && typeof manifest.runtime !== 'object') {
      errors.push(ValidationErrorFactory.invalidType('runtime', 'object', manifest.runtime));
    }
  }
}
