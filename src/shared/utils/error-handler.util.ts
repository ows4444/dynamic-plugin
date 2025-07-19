import { Logger } from '@nestjs/common';
import type { PluginError } from '@/types/plugin.types';
import { PluginSeverity } from '@/types/plugin.types';

/**
 * Comprehensive error handling utility for the plugin system
 */
export class PluginErrorHandler {
  private static readonly logger = new Logger(PluginErrorHandler.name);

  /**
   * Creates a standardized plugin error
   */
  static createPluginError(pluginId: string, code: string, message: string, severity: PluginSeverity = PluginSeverity.MEDIUM, recoverable = true, context?: Record<string, unknown>): PluginError {
    const error = new Error(message) as PluginError;
    error.pluginId = pluginId;
    error.code = code;
    error.severity = severity;
    error.recoverable = recoverable;
    error.context = context;
    error.timestamp = new Date();
    error.stackTrace = error.stack;

    return error;
  }

  /**
   * Handles plugin errors with appropriate logging and recovery actions
   */
  static handlePluginError(error: PluginError | Error, pluginId?: string): void {
    const pluginError = this.normalizeError(error, pluginId);

    // Log based on severity
    switch (pluginError.severity) {
      case PluginSeverity.CRITICAL:
        this.logger.error(`[CRITICAL] Plugin ${pluginError.pluginId}: ${pluginError.message}`, {
          code: pluginError.code,
          context: pluginError.context,
          stack: pluginError.stackTrace,
        });
        break;
      case PluginSeverity.HIGH:
        this.logger.error(`[HIGH] Plugin ${pluginError.pluginId}: ${pluginError.message}`, {
          code: pluginError.code,
          context: pluginError.context,
        });
        break;
      case PluginSeverity.MEDIUM:
        this.logger.warn(`[MEDIUM] Plugin ${pluginError.pluginId}: ${pluginError.message}`, {
          code: pluginError.code,
        });
        break;
      case PluginSeverity.LOW:
        this.logger.debug(`[LOW] Plugin ${pluginError.pluginId}: ${pluginError.message}`, {
          code: pluginError.code,
        });
        break;
    }

    // Emit error event for monitoring systems
    // This would integrate with your event system
    // eventEmitter.emit('plugin.error', pluginError);
  }

  /**
   * Normalizes any error to a PluginError
   */
  private static normalizeError(error: Error | PluginError, pluginId?: string): PluginError {
    if (this.isPluginError(error)) {
      return error;
    }

    return this.createPluginError(pluginId ?? 'unknown', 'GENERIC_ERROR', error.message, PluginSeverity.MEDIUM, true, {
      originalError: error.name,
      stack: error.stack,
    });
  }

  /**
   * Type guard to check if error is a PluginError
   */
  private static isPluginError(error: Error | PluginError): error is PluginError {
    return 'pluginId' in error && 'code' in error && 'severity' in error;
  }

  /**
   * Validates plugin input parameters
   */
  static validatePluginId(pluginId: unknown, operation = 'operation'): asserts pluginId is string {
    if (!pluginId || typeof pluginId !== 'string' || !pluginId.trim()) {
      throw this.createPluginError('unknown', 'INVALID_PLUGIN_ID', `Invalid plugin ID provided for ${operation}`, PluginSeverity.HIGH, false);
    }
  }

  /**
   * Validates plugin source
   */
  static validatePluginSource(source: unknown): asserts source is { type: string; location: string } {
    if (!source || typeof source !== 'object') {
      throw this.createPluginError('unknown', 'INVALID_PLUGIN_SOURCE', 'Plugin source must be an object', PluginSeverity.HIGH, false);
    }

    const sourceObj = source as Record<string, unknown>;

    if (!sourceObj.type || typeof sourceObj.type !== 'string') {
      throw this.createPluginError('unknown', 'INVALID_PLUGIN_SOURCE_TYPE', 'Plugin source type is required and must be a string', PluginSeverity.HIGH, false);
    }

    if (!sourceObj.location || typeof sourceObj.location !== 'string') {
      throw this.createPluginError('unknown', 'INVALID_PLUGIN_SOURCE_LOCATION', 'Plugin source location is required and must be a string', PluginSeverity.HIGH, false);
    }
  }

  /**
   * Wraps async operations with error handling
   */
  static async withErrorHandling<T>(operation: () => Promise<T>, pluginId: string, operationName: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const pluginError = this.createPluginError(
        pluginId,
        `${operationName.toUpperCase()}_FAILED`,
        `${operationName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        PluginSeverity.HIGH,
        true,
        {
          operationName,
          originalError: error instanceof Error ? error.name : 'Unknown',
        },
      );

      this.handlePluginError(pluginError);
      throw pluginError;
    }
  }

  /**
   * Validates and sanitizes configuration objects
   */
  static validateConfiguration(config: unknown, pluginId: string): Record<string, unknown> {
    if (config === null || config === undefined) {
      return {};
    }

    if (typeof config !== 'object') {
      throw this.createPluginError(pluginId, 'INVALID_CONFIGURATION', 'Plugin configuration must be an object', PluginSeverity.MEDIUM, false);
    }

    // Deep clone to avoid mutations
    try {
      return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
    } catch (_error) {
      throw this.createPluginError(pluginId, 'CONFIGURATION_SERIALIZATION_ERROR', 'Plugin configuration contains non-serializable values', PluginSeverity.MEDIUM, false);
    }
  }
}

/**
 * Common error codes for plugin operations
 */
export enum PluginErrorCodes {
  INSTALLATION_FAILED = 'INSTALLATION_FAILED',
  INVALID_MANIFEST = 'INVALID_MANIFEST',
  DEPENDENCY_RESOLUTION_FAILED = 'DEPENDENCY_RESOLUTION_FAILED',

  // Loading errors
  LOAD_FAILED = 'LOAD_FAILED',
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',
  COMPILATION_FAILED = 'COMPILATION_FAILED',

  // Runtime errors
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  RESOURCE_LIMIT_EXCEEDED = 'RESOURCE_LIMIT_EXCEEDED',

  // Security errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SIGNATURE_VERIFICATION_FAILED = 'SIGNATURE_VERIFICATION_FAILED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',

  // Configuration errors
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  CONFIGURATION_VALIDATION_FAILED = 'CONFIGURATION_VALIDATION_FAILED',

  // Registry errors
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
  REGISTRY_CORRUPTION = 'REGISTRY_CORRUPTION',
  DUPLICATE_REGISTRATION = 'DUPLICATE_REGISTRATION',
}
