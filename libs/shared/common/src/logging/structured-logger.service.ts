import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  pluginId?: string;
  operation?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  context: LogContext;
  service: string;
  environment: string;
  stack?: string;
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLoggerService implements LoggerService {
  private readonly logger: winston.Logger;
  private readonly serviceName: string;
  private readonly environment: string;
  private correlationId?: string;

  constructor(
    private readonly configService: ConfigService,
    serviceName?: string,
  ) {
    this.serviceName = serviceName || 'unknown-service';
    this.environment = this.configService.get('NODE_ENV', 'development');
    
    this.logger = winston.createLogger({
      level: this.configService.get('LOG_LEVEL', 'info'),
      format: this.createLogFormat(),
      transports: this.createTransports(),
      exitOnError: false,
    });
  }

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Generate new correlation ID
   */
  generateCorrelationId(): string {
    this.correlationId = uuidv4();
    return this.correlationId;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  /**
   * Log error with context
   */
  error(message: string, error?: Error | string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, { ...context, stack: error instanceof Error ? error.stack : undefined });
  }

  /**
   * Log warning with context
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log info with context
   */
  log(level: LogLevel | string, message: string, context?: LogContext): void {
    const logEntry: LogEntry = {
      level: level as string,
      message,
      timestamp: new Date().toISOString(),
      context: this.enrichContext(context),
      service: this.serviceName,
      environment: this.environment,
    };

    if (context?.stack) {
      logEntry.stack = context.stack;
    }

    this.logger.log(level as string, logEntry);
  }

  /**
   * Log debug information
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log verbose information
   */
  verbose(message: string, context?: LogContext): void {
    this.log(LogLevel.VERBOSE, message, context);
  }

  /**
   * Log HTTP request/response
   */
  http(message: string, context?: LogContext): void {
    this.log(LogLevel.HTTP, message, context);
  }

  /**
   * Log plugin-specific events
   */
  logPluginEvent(
    pluginId: string,
    event: string,
    message: string,
    metadata?: Record<string, any>,
  ): void {
    this.log(LogLevel.INFO, message, {
      pluginId,
      operation: event,
      metadata,
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>,
  ): void {
    this.log(LogLevel.INFO, `Performance: ${operation}`, {
      operation,
      duration,
      metadata: {
        ...metadata,
        performanceLog: true,
      },
    });
  }

  /**
   * Log security events
   */
  logSecurityEvent(
    event: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    metadata?: Record<string, any>,
  ): void {
    const level = severity === 'critical' || severity === 'high' ? LogLevel.ERROR : LogLevel.WARN;
    this.log(level, `Security: ${message}`, {
      operation: event,
      metadata: {
        ...metadata,
        securityEvent: true,
        severity,
      },
    });
  }

  /**
   * Log audit trail
   */
  logAudit(
    action: string,
    resource: string,
    userId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log(LogLevel.INFO, `Audit: ${action} on ${resource}`, {
      userId,
      operation: action,
      metadata: {
        ...metadata,
        auditLog: true,
        resource,
      },
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): StructuredLoggerService {
    const childLogger = new StructuredLoggerService(this.configService, this.serviceName);
    childLogger.correlationId = this.correlationId;
    
    // Override the log method to include additional context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel | string, message: string, logContext?: LogContext) => {
      originalLog(level, message, { ...context, ...logContext });
    };

    return childLogger;
  }

  /**
   * Flush all pending logs
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }

  private createLogFormat(): winston.Logform.Format {
    if (this.environment === 'development') {
      return winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const { timestamp, level, message, service, context } = info;
          const correlationId = context?.correlationId ? `[${context.correlationId}]` : '';
          const operation = context?.operation ? `[${context.operation}]` : '';
          return `${timestamp} ${level} [${service}]${correlationId}${operation} ${message}`;
        }),
      );
    }

    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );
  }

  private createTransports(): winston.transport[] {
    const transports: winston.transport[] = [];

    // Console transport
    transports.push(
      new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true,
      }),
    );

    // File transports in production
    if (this.environment === 'production') {
      // Error log file
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 10,
          tailable: true,
        }),
      );

      // Combined log file
      transports.push(
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 10,
          tailable: true,
        }),
      );

      // Audit log file
      transports.push(
        new winston.transports.File({
          filename: 'logs/audit.log',
          level: 'info',
          maxsize: 5242880, // 5MB
          maxFiles: 20,
          tailable: true,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
            winston.format((info) => {
              // Only audit logs
              return info.context?.metadata?.auditLog ? info : false;
            })(),
          ),
        }),
      );

      // Performance log file
      transports.push(
        new winston.transports.File({
          filename: 'logs/performance.log',
          level: 'info',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
            winston.format((info) => {
              // Only performance logs
              return info.context?.metadata?.performanceLog ? info : false;
            })(),
          ),
        }),
      );
    }

    return transports;
  }

  private enrichContext(context?: LogContext): LogContext {
    return {
      correlationId: this.correlationId,
      ...context,
      timestamp: new Date().toISOString(),
    };
  }
}