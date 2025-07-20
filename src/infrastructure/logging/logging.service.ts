import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { StructuredLoggerService } from './structured-logger.service';
import { CorrelationService } from './correlation.service';
import { LogAggregatorService } from './log-aggregator.service';
import { ConfigService } from '../config/config.service';

export interface LoggingConfiguration {
  level: 'error' | 'warn' | 'log' | 'debug' | 'verbose';
  enableCorrelation: boolean;
  enableAggregation: boolean;
  bufferSize: number;
  flushInterval: number;
  enableFileLogging: boolean;
  logDirectory: string;
  rotationSize: number;
  retentionDays: number;
}

/**
 * Central logging service coordinating all logging components
 * Provides unified interface for structured logging, correlation, and aggregation
 */
@Injectable()
export class LoggingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LoggingService.name);
  private readonly config: LoggingConfiguration;
  private isInitialized = false;

  constructor(
    private readonly structuredLogger: StructuredLoggerService,
    private readonly correlationService: CorrelationService,
    private readonly logAggregator: LogAggregatorService,
    private readonly configService: ConfigService,
  ) {
    this.config = {
      level: this.configService.get('LOG_LEVEL', 'log'),
      enableCorrelation: this.configService.get('LOG_ENABLE_CORRELATION', true),
      enableAggregation: this.configService.get('LOG_ENABLE_AGGREGATION', true),
      bufferSize: this.configService.get('LOG_BUFFER_SIZE', 10000),
      flushInterval: this.configService.get('LOG_FLUSH_INTERVAL', 30000),
      enableFileLogging: this.configService.get('LOG_ENABLE_FILE', false),
      logDirectory: this.configService.get('LOG_DIRECTORY', './logs'),
      rotationSize: this.configService.get('LOG_ROTATION_SIZE', 100 * 1024 * 1024), // 100MB
      retentionDays: this.configService.get('LOG_RETENTION_DAYS', 30),
    };
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.initializeLogging();
      this.logger.log('Logging service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize logging service:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.shutdownLogging();
      this.logger.log('Logging service shut down successfully');
    } catch (error) {
      this.logger.error('Error during logging service shutdown:', error);
    }
  }

  /**
   * Initialize logging components
   */
  private async initializeLogging(): Promise<void> {
    const initPromises: Array<Promise<void>> = [];

    // Initialize log aggregator if enabled
    if (this.config.enableAggregation) {
      this.logAggregator.initialize();
    }

    await Promise.allSettled(initPromises);
    this.isInitialized = true;
  }

  /**
   * Log info level message
   */
  info(message: string, context?: string, metadata?: Record<string, any>): void {
    this.structuredLogger.info(message, context, metadata);

    if (this.config.enableAggregation) {
      this.logAggregator.aggregate('info', context, metadata);
    }
  }

  /**
   * Log warning level message
   */
  warn(message: string, context?: string, metadata?: Record<string, any>): void {
    this.structuredLogger.warn(message, context, metadata);

    if (this.config.enableAggregation) {
      this.logAggregator.aggregate('warn', context, metadata);
    }
  }

  /**
   * Log error level message
   */
  error(message: string, context?: string, metadata?: Record<string, any>, error?: Error): void {
    this.structuredLogger.error(message, context, metadata, error);

    if (this.config.enableAggregation) {
      this.logAggregator.aggregate('error', context, { ...metadata, has_error: true });
    }
  }

  /**
   * Log debug level message
   */
  debug(message: string, context?: string, metadata?: Record<string, any>): void {
    this.structuredLogger.debug(message, context, metadata);

    if (this.config.enableAggregation) {
      this.logAggregator.aggregate('debug', context, metadata);
    }
  }

  /**
   * Log verbose level message
   */
  verbose(message: string, context?: string, metadata?: Record<string, any>): void {
    this.structuredLogger.verbose(message, context, metadata);

    if (this.config.enableAggregation) {
      this.logAggregator.aggregate('verbose', context, metadata);
    }
  }

  /**
   * Log plugin activity with automatic context enrichment
   */
  logPlugin(level: 'error' | 'warn' | 'log' | 'debug' | 'verbose', pluginId: string, message: string, metadata?: Record<string, any>, error?: Error): void {
    // Enrich correlation context with plugin ID
    if (this.config.enableCorrelation) {
      this.correlationService.setPluginId(pluginId);
    }

    this.structuredLogger.logPlugin(level, pluginId, message, metadata, error);

    if (this.config.enableAggregation) {
      this.logAggregator.aggregate(level, `Plugin:${pluginId}`, {
        ...metadata,
        plugin_id: pluginId,
        has_error: !!error,
      });
    }
  }

  /**
   * Log HTTP request/response
   */
  logRequest(method: string, url: string, statusCode: number, duration: number, userId?: string, metadata?: Record<string, any>): void {
    // Enrich correlation context
    if (this.config.enableCorrelation && userId) {
      this.correlationService.setUserId(userId);
    }

    this.structuredLogger.logRequest(method, url, statusCode, duration, userId, metadata);

    if (this.config.enableAggregation) {
      this.logAggregator.aggregate('log', 'HTTP', {
        ...metadata,
        http_method: method,
        status_code: statusCode,
        duration_ms: duration,
        user_id: userId,
      });
    }
  }

  /**
   * Log database operation
   */
  logDatabase(operation: string, table: string, duration: number, rowsAffected?: number, metadata?: Record<string, any>): void {
    this.structuredLogger.logDatabase(operation, table, duration, rowsAffected, metadata);

    if (this.config.enableAggregation) {
      this.logAggregator.aggregate('debug', 'Database', {
        ...metadata,
        db_operation: operation,
        table,
        duration_ms: duration,
        rows_affected: rowsAffected,
      });
    }
  }

  /**
   * Log cache operation
   */
  logCache(operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear', key: string, duration?: number, metadata?: Record<string, any>): void {
    this.structuredLogger.logCache(operation, key, duration, metadata);

    if (this.config.enableAggregation) {
      this.logAggregator.aggregate('debug', 'Cache', {
        ...metadata,
        cache_operation: operation,
        cache_key: key,
        duration_ms: duration,
      });
    }
  }

  /**
   * Log security event
   */
  logSecurity(event: string, severity: 'low' | 'medium' | 'high' | 'critical', userId?: string, metadata?: Record<string, any>): void {
    if (this.config.enableCorrelation && userId) {
      this.correlationService.setUserId(userId);
    }

    this.structuredLogger.logSecurity(event, severity, userId, metadata);

    if (this.config.enableAggregation) {
      this.logAggregator.aggregate(severity === 'critical' || severity === 'high' ? 'error' : 'warn', 'Security', {
        ...metadata,
        security_event: event,
        severity,
        user_id: userId,
      });
    }
  }

  /**
   * Log performance metric
   */
  logPerformance(operation: string, duration: number, metadata?: Record<string, any>): void {
    this.structuredLogger.logPerformance(operation, duration, metadata);

    if (this.config.enableAggregation) {
      this.logAggregator.aggregate('log', 'Performance', {
        ...metadata,
        operation,
        duration_ms: duration,
      });
    }
  }

  /**
   * Start a correlated operation
   */
  startCorrelatedOperation<T>(operationName: string, fn: () => T | Promise<T>, metadata?: Record<string, any>): T | Promise<T> {
    if (!this.config.enableCorrelation) {
      return fn();
    }

    return this.correlationService.runWithEnrichedContext(
      {
        metadata: {
          operation: operationName,
          ...metadata,
        },
      },
      () => {
        this.debug(`Starting operation: ${operationName}`, 'Operation', metadata);
        const startTime = Date.now();

        try {
          const result = fn();

          // Handle both sync and async results
          if (result instanceof Promise) {
            return result
              .then((value) => {
                const duration = Date.now() - startTime;
                this.logPerformance(operationName, duration, metadata);
                return value;
              })
              .catch((error) => {
                const duration = Date.now() - startTime;
                this.error(
                  `Operation failed: ${operationName}`,
                  'Operation',
                  {
                    ...metadata,
                    duration_ms: duration,
                  },
                  error,
                );
                throw error;
              });
          } else {
            const duration = Date.now() - startTime;
            this.logPerformance(operationName, duration, metadata);
            return result;
          }
        } catch (error) {
          const duration = Date.now() - startTime;
          this.error(
            `Operation failed: ${operationName}`,
            'Operation',
            {
              ...metadata,
              duration_ms: duration,
            },
            error as Error,
          );
          throw error;
        }
      },
    );
  }

  /**
   * Get logging statistics
   */
  getLoggingStatistics(): LoggingStatistics {
    try {
      const structuredStats = this.structuredLogger.getLogStatistics();
      const aggregationStats = this.config.enableAggregation ? this.logAggregator.getAggregationStatistics() : null;

      return {
        structured: structuredStats,
        aggregation: aggregationStats,
        configuration: this.config,
        correlationActive: this.correlationService.hasContext(),
      };
    } catch (error) {
      this.logger.error('Failed to get logging statistics:', error);
      throw error;
    }
  }

  /**
   * Export logs in various formats
   */
  exportLogs(format: 'json' | 'csv' | 'text', filter?: any): string {
    return this.structuredLogger.exportLogs(format, filter);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.structuredLogger.clearLogs();

    if (this.config.enableAggregation) {
      this.logAggregator.clearAggregations();
    }
  }

  /**
   * Update logging configuration
   */
  updateConfiguration(newConfig: Partial<LoggingConfiguration>): void {
    Object.assign(this.config, newConfig);
    this.logger.log('Logging configuration updated');
  }

  /**
   * Check if logging service is healthy
   */
  isHealthy(): boolean {
    if (!this.isInitialized) {
      return false;
    }

    try {
      // Test basic logging functionality
      this.debug('Health check test log', 'HealthCheck');

      // Check aggregator health if enabled
      if (this.config.enableAggregation) {
        return this.logAggregator.isHealthy();
      }

      return true;
    } catch (error) {
      this.logger.error('Logging health check failed:', error);
      return false;
    }
  }

  /**
   * Shutdown logging gracefully
   */
  private async shutdownLogging(): Promise<void> {
    const shutdownPromises: Array<Promise<void>> = [];

    if (this.config.enableAggregation) {
      this.logAggregator.shutdown();
    }

    await Promise.allSettled(shutdownPromises);
    this.isInitialized = false;
  }
}

export interface LoggingStatistics {
  structured: any;
  aggregation: any;
  configuration: LoggingConfiguration;
  correlationActive: boolean;
}
