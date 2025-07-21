export interface PluginErrorDetails {
  code?: string;
  pluginId?: string;
  version?: string;
  host?: string;
  timestamp?: Date;
  path?: string;
  method?: string;
  statusCode?: number;
  stack?: string;
  context?: {
    operation?: string;
    component?: string;
    params?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

export interface NodeErrorCapture {
  captureStackTrace?: (targetObject: Error, constructorOpt?: new (...args: any[]) => any) => void;
}

export class PluginError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly pluginId?: string,
    public readonly details?: PluginErrorDetails,
  ) {
    super(message);
    this.name = 'PluginError';

    // V8 stack trace capture for better debugging
    const captureStackTrace = (Error as NodeErrorCapture).captureStackTrace;
    if (typeof captureStackTrace === 'function') {
      captureStackTrace(this, PluginError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      pluginId: this.pluginId,
      details: this.details,
      stack: this.stack,
    };
  }
}

export class PluginInstallationError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_INSTALLATION_ERROR', pluginId, details);
    this.name = 'PluginInstallationError';
  }
}

export class PluginLoadError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_LOAD_ERROR', pluginId, details);
    this.name = 'PluginLoadError';
  }
}

export class PluginValidationError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_VALIDATION_ERROR', pluginId, details);
    this.name = 'PluginValidationError';
  }
}

export class PluginDependencyError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_DEPENDENCY_ERROR', pluginId, details);
    this.name = 'PluginDependencyError';
  }
}

export class PluginSecurityError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_SECURITY_ERROR', pluginId, details);
    this.name = 'PluginSecurityError';
  }
}

export class PluginPermissionError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_PERMISSION_ERROR', pluginId, details);
    this.name = 'PluginPermissionError';
  }
}

export class PluginConfigurationError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_CONFIGURATION_ERROR', pluginId, details);
    this.name = 'PluginConfigurationError';
  }
}

export class PluginRuntimeError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_RUNTIME_ERROR', pluginId, details);
    this.name = 'PluginRuntimeError';
  }
}

export class PluginTimeoutError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_TIMEOUT_ERROR', pluginId, details);
    this.name = 'PluginTimeoutError';
  }
}

export class PluginCommunicationError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_COMMUNICATION_ERROR', pluginId, details);
    this.name = 'PluginCommunicationError';
  }
}

export class PluginStorageError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_STORAGE_ERROR', pluginId, details);
    this.name = 'PluginStorageError';
  }
}

export class PluginRegistryError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_REGISTRY_ERROR', pluginId, details);
    this.name = 'PluginRegistryError';
  }
}

export class PluginVersionError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_VERSION_ERROR', pluginId, details);
    this.name = 'PluginVersionError';
  }
}

export class PluginCompatibilityError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_COMPATIBILITY_ERROR', pluginId, details);
    this.name = 'PluginCompatibilityError';
  }
}

export class PluginManifestError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_MANIFEST_ERROR', pluginId, details);
    this.name = 'PluginManifestError';
  }
}

export class PluginExecutionError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_EXECUTION_ERROR', pluginId, details);
    this.name = 'PluginExecutionError';
  }
}

export class PluginResourceError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_RESOURCE_ERROR', pluginId, details);
    this.name = 'PluginResourceError';
  }
}

export class PluginHealthCheckError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_HEALTH_CHECK_ERROR', pluginId, details);
    this.name = 'PluginHealthCheckError';
  }
}

export class PluginNotFoundError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_NOT_FOUND', pluginId, details);
    this.name = 'PluginNotFoundError';
  }
}

export class PluginAlreadyExistsError extends PluginError {
  constructor(
    message: string,
    pluginId?: string,
    details?: PluginErrorDetails,
  ) {
    super(message, 'PLUGIN_ALREADY_EXISTS', pluginId, details);
    this.name = 'PluginAlreadyExistsError';
  }
}

export const ERROR_CODES = {
  PLUGIN_INSTALLATION_ERROR: 'PLUGIN_INSTALLATION_ERROR',
  PLUGIN_LOAD_ERROR: 'PLUGIN_LOAD_ERROR',
  PLUGIN_VALIDATION_ERROR: 'PLUGIN_VALIDATION_ERROR',
  PLUGIN_DEPENDENCY_ERROR: 'PLUGIN_DEPENDENCY_ERROR',
  PLUGIN_SECURITY_ERROR: 'PLUGIN_SECURITY_ERROR',
  PLUGIN_PERMISSION_ERROR: 'PLUGIN_PERMISSION_ERROR',
  PLUGIN_CONFIGURATION_ERROR: 'PLUGIN_CONFIGURATION_ERROR',
  PLUGIN_RUNTIME_ERROR: 'PLUGIN_RUNTIME_ERROR',
  PLUGIN_TIMEOUT_ERROR: 'PLUGIN_TIMEOUT_ERROR',
  PLUGIN_COMMUNICATION_ERROR: 'PLUGIN_COMMUNICATION_ERROR',
  PLUGIN_STORAGE_ERROR: 'PLUGIN_STORAGE_ERROR',
  PLUGIN_REGISTRY_ERROR: 'PLUGIN_REGISTRY_ERROR',
  PLUGIN_VERSION_ERROR: 'PLUGIN_VERSION_ERROR',
  PLUGIN_COMPATIBILITY_ERROR: 'PLUGIN_COMPATIBILITY_ERROR',
  PLUGIN_MANIFEST_ERROR: 'PLUGIN_MANIFEST_ERROR',
  PLUGIN_EXECUTION_ERROR: 'PLUGIN_EXECUTION_ERROR',
  PLUGIN_RESOURCE_ERROR: 'PLUGIN_RESOURCE_ERROR',
  PLUGIN_HEALTH_CHECK_ERROR: 'PLUGIN_HEALTH_CHECK_ERROR',
  PLUGIN_NOT_FOUND: 'PLUGIN_NOT_FOUND',
  PLUGIN_ALREADY_EXISTS: 'PLUGIN_ALREADY_EXISTS',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function createPluginError(
  code: ErrorCode,
  message: string,
  pluginId?: string,
  details?: PluginErrorDetails,
): PluginError {
  const errorMap = {
    [ERROR_CODES.PLUGIN_INSTALLATION_ERROR]: PluginInstallationError,
    [ERROR_CODES.PLUGIN_LOAD_ERROR]: PluginLoadError,
    [ERROR_CODES.PLUGIN_VALIDATION_ERROR]: PluginValidationError,
    [ERROR_CODES.PLUGIN_DEPENDENCY_ERROR]: PluginDependencyError,
    [ERROR_CODES.PLUGIN_SECURITY_ERROR]: PluginSecurityError,
    [ERROR_CODES.PLUGIN_PERMISSION_ERROR]: PluginPermissionError,
    [ERROR_CODES.PLUGIN_CONFIGURATION_ERROR]: PluginConfigurationError,
    [ERROR_CODES.PLUGIN_RUNTIME_ERROR]: PluginRuntimeError,
    [ERROR_CODES.PLUGIN_TIMEOUT_ERROR]: PluginTimeoutError,
    [ERROR_CODES.PLUGIN_COMMUNICATION_ERROR]: PluginCommunicationError,
    [ERROR_CODES.PLUGIN_STORAGE_ERROR]: PluginStorageError,
    [ERROR_CODES.PLUGIN_REGISTRY_ERROR]: PluginRegistryError,
    [ERROR_CODES.PLUGIN_VERSION_ERROR]: PluginVersionError,
    [ERROR_CODES.PLUGIN_COMPATIBILITY_ERROR]: PluginCompatibilityError,
    [ERROR_CODES.PLUGIN_MANIFEST_ERROR]: PluginManifestError,
    [ERROR_CODES.PLUGIN_EXECUTION_ERROR]: PluginExecutionError,
    [ERROR_CODES.PLUGIN_RESOURCE_ERROR]: PluginResourceError,
    [ERROR_CODES.PLUGIN_HEALTH_CHECK_ERROR]: PluginHealthCheckError,
    [ERROR_CODES.PLUGIN_NOT_FOUND]: PluginNotFoundError,
    [ERROR_CODES.PLUGIN_ALREADY_EXISTS]: PluginAlreadyExistsError,
  };

  const ErrorClass = errorMap[code] || PluginError;
  return new ErrorClass(message, pluginId, details);
}
