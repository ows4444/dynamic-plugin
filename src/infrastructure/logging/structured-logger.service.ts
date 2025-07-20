import { Injectable, Logger, LogLevel } from '@nestjs/common';
import { CorrelationService } from './correlation.service';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  correlationId?: string;
  userId?: string;
  pluginId?: string;
  metadata?: Record<string, any>;
  stack?: string;
  duration?: number;
  requestId?: string;
  sessionId?: string;
}

export interface LogFilter {
  level?: LogLevel[];
  context?: string[];
  correlationId?: string;
  userId?: string;
  pluginId?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

/**
 * Structured logging service with correlation and metadata support
 * Provides consistent log formatting and enrichment across the application
 */
@Injectable()
export class StructuredLoggerService extends Logger {
  private readonly logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 10000;

  constructor(private readonly correlationService: CorrelationService) {
    super(StructuredLoggerService.name);
  }

  /**
   * Log with structured format and automatic enrichment
   */
  logStructured(level: LogLevel, message: string, context?: string, metadata?: Record<string, any>, error?: Error): void {
    const logEntry = this.createLogEntry(level, message, context, metadata, error);

    // Store in buffer for querying
    this.storeLogEntry(logEntry);

    // Output to console with formatting
    this.outputLog(logEntry);
  }

  /**
   * Log info level with structured format
   */
  info(message: string, context?: string, metadata?: Record<string, any>): void {
    this.logStructured('log', message, context, metadata);
  }

  /**
   * Log warning level with structured format
   */
  override warn(message: string, context?: string, metadata?: Record<string, any>): void {
    this.logStructured('warn', message, context, metadata);
  }

  /**
   * Log error level with structured format
   */
  override error(message: string, stack?: string, context?: string): void;
  override error(message: string, ...optionalParams: any[]): void;
  override error(message: string, stackOrContext?: string, context?: string, metadata?: Record<string, any>, error?: Error): void {
    // Handle both Logger signature and our custom signature
    if (typeof stackOrContext === 'string' && !context && !metadata && !error) {
      // Standard Logger.error(message, stack, context) call
      super.error(message, stackOrContext);
    } else {
      // Our custom structured logging call
      const actualContext = context ?? stackOrContext;
      this.logStructured('error', message, actualContext, metadata, error);
    }
  }

  /**
   * Log verbose level with structured format
   */
  override verbose(message: string, context?: string, metadata?: Record<string, any>): void {
    this.logStructured('verbose', message, context, metadata);
  }

  /**
   * Log plugin-specific activity
   */
  logPlugin(level: LogLevel, pluginId: string, message: string, metadata?: Record<string, any>, error?: Error): void {
    const enrichedMetadata = {
      ...metadata,
      plugin_id: pluginId,
      component: 'plugin',
    };

    this.logStructured(level, message, `Plugin:${pluginId}`, enrichedMetadata, error);
  }

  /**
   * Log request/response activity
   */
  logRequest(method: string, url: string, statusCode: number, duration: number, userId?: string, metadata?: Record<string, any>): void {
    const requestMetadata = {
      ...metadata,
      http_method: method,
      url,
      status_code: statusCode,
      duration_ms: duration,
      user_id: userId,
      component: 'http',
    };

    const message = `${method} ${url} ${statusCode} - ${duration}ms`;
    this.logStructured('log', message, 'HTTP', requestMetadata);
  }

  /**
   * Log database operation
   */
  logDatabase(operation: string, table: string, duration: number, rowsAffected?: number, metadata?: Record<string, any>): void {
    const dbMetadata = {
      ...metadata,
      db_operation: operation,
      table,
      duration_ms: duration,
      rows_affected: rowsAffected,
      component: 'database',
    };

    const message = `DB ${operation} on ${table} - ${duration}ms${rowsAffected ? ` (${rowsAffected} rows)` : ''}`;
    this.logStructured('debug', message, 'Database', dbMetadata);
  }

  /**
   * Log cache operation
   */
  logCache(operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear', key: string, duration?: number, metadata?: Record<string, any>): void {
    const cacheMetadata = {
      ...metadata,
      cache_operation: operation,
      cache_key: key,
      duration_ms: duration,
      component: 'cache',
    };

    const message = `Cache ${operation}: ${key}${duration ? ` - ${duration}ms` : ''}`;
    this.logStructured('debug', message, 'Cache', cacheMetadata);
  }

  /**
   * Log security event
   */
  logSecurity(event: string, severity: 'low' | 'medium' | 'high' | 'critical', userId?: string, metadata?: Record<string, any>): void {
    const securityMetadata = {
      ...metadata,
      security_event: event,
      severity,
      user_id: userId,
      component: 'security',
    };

    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    const message = `Security Event: ${event} (${severity})`;
    this.logStructured(level, message, 'Security', securityMetadata);
  }

  /**
   * Log performance metric
   */
  logPerformance(operation: string, duration: number, metadata?: Record<string, any>): void {
    const perfMetadata = {
      ...metadata,
      operation,
      duration_ms: duration,
      component: 'performance',
    };

    const message = `Performance: ${operation} - ${duration}ms`;
    this.logStructured('log', message, 'Performance', perfMetadata);
  }

  /**
   * Query logs with filters
   */
  queryLogs(filter: LogFilter = {}): LogEntry[] {
    let filteredLogs = [...this.logBuffer];

    // Apply filters
    if (filter.level && filter.level.length > 0) {
      filteredLogs = filteredLogs.filter((log) => filter.level!.includes(log.level));
    }

    if (filter.context && filter.context.length > 0) {
      filteredLogs = filteredLogs.filter((log) => log.context && filter.context!.some((ctx) => log.context!.includes(ctx)));
    }

    if (filter.correlationId) {
      filteredLogs = filteredLogs.filter((log) => log.correlationId === filter.correlationId);
    }

    if (filter.userId) {
      filteredLogs = filteredLogs.filter((log) => log.userId === filter.userId);
    }

    if (filter.pluginId) {
      filteredLogs = filteredLogs.filter((log) => log.pluginId === filter.pluginId);
    }

    if (filter.startTime) {
      filteredLogs = filteredLogs.filter((log) => log.timestamp >= filter.startTime!);
    }

    if (filter.endTime) {
      filteredLogs = filteredLogs.filter((log) => log.timestamp <= filter.endTime!);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (filter.limit && filter.limit > 0) {
      filteredLogs = filteredLogs.slice(0, filter.limit);
    }

    return filteredLogs;
  }

  /**
   * Get log statistics
   */
  getLogStatistics(): LogStatistics {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentLogs = this.logBuffer.filter((log) => log.timestamp.getTime() > oneHourAgo);
    const dailyLogs = this.logBuffer.filter((log) => log.timestamp.getTime() > oneDayAgo);

    const levelCounts = this.logBuffer.reduce(
      (acc, log) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const contextCounts = this.logBuffer.reduce(
      (acc, log) => {
        if (log.context) {
          acc[log.context] = (acc[log.context] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalLogs: this.logBuffer.length,
      recentLogs: recentLogs.length,
      dailyLogs: dailyLogs.length,
      levelDistribution: levelCounts,
      contextDistribution: contextCounts,
      bufferUsage: (this.logBuffer.length / this.maxBufferSize) * 100,
    };
  }

  /**
   * Export logs in various formats
   */
  exportLogs(format: 'json' | 'csv' | 'text', filter?: LogFilter): string {
    const logs = this.queryLogs(filter);

    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);
      case 'csv':
        return this.exportToCSV(logs);
      case 'text':
        return this.exportToText(logs);
      default:
        throw new Error(`Unsupported export format: ${String(format)}`);
    }
  }

  /**
   * Clear log buffer
   */
  clearLogs(): void {
    this.logBuffer.length = 0;
    this.log('Log buffer cleared');
  }

  /**
   * Create structured log entry
   */
  private createLogEntry(level: LogLevel, message: string, context?: string, metadata?: Record<string, any>, error?: Error): LogEntry {
    const correlationId = this.correlationService.getCorrelationId();
    const userId = this.correlationService.getUserId();
    const requestId = this.correlationService.getRequestId();
    const sessionId = this.correlationService.getSessionId();

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      correlationId,
      userId,
      requestId,
      sessionId,
      metadata: {
        ...metadata,
        pid: process.pid,
        memory_usage: process.memoryUsage(),
      },
    };

    // Add error details if provided
    if (error) {
      logEntry.stack = error.stack;
      logEntry.metadata = {
        ...logEntry.metadata,
        error_name: error.name,
        error_message: error.message,
      };
    }

    // Extract plugin ID from context or metadata
    if (context?.startsWith('Plugin:')) {
      logEntry.pluginId = context.split(':')[1];
    } else if (metadata?.plugin_id) {
      logEntry.pluginId = metadata.plugin_id;
    }

    return logEntry;
  }

  /**
   * Store log entry in buffer
   */
  private storeLogEntry(logEntry: LogEntry): void {
    this.logBuffer.push(logEntry);

    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.splice(0, this.logBuffer.length - this.maxBufferSize);
    }
  }

  /**
   * Output log to console with formatting
   */
  private outputLog(logEntry: LogEntry): void {
    const formattedMessage = this.formatLogMessage(logEntry);

    switch (logEntry.level) {
      case 'error':
        super.error(formattedMessage, logEntry.context);
        break;
      case 'warn':
        super.warn(formattedMessage, logEntry.context);
        break;
      case 'debug':
        super.debug(formattedMessage, logEntry.context);
        break;
      case 'verbose':
        super.verbose(formattedMessage, logEntry.context);
        break;
      case 'log': {
        throw new Error('Not implemented yet: "log" case');
      }
      case 'fatal': {
        throw new Error('Not implemented yet: "fatal" case');
      }
      default:
        super.log(formattedMessage, logEntry.context);
    }
  }

  /**
   * Format log message for console output
   */
  private formatLogMessage(logEntry: LogEntry): string {
    const parts = [logEntry.message];

    if (logEntry.correlationId) {
      parts.push(`[${logEntry.correlationId}]`);
    }

    if (logEntry.duration) {
      parts.push(`(${logEntry.duration}ms)`);
    }

    if (logEntry.metadata && Object.keys(logEntry.metadata).length > 0) {
      // Only include important metadata in console output
      const importantKeys = ['user_id', 'plugin_id', 'status_code', 'error_message'];
      const importantMetadata: Record<string, any> = {};

      for (const key of importantKeys) {
        if (logEntry.metadata[key] !== undefined) {
          importantMetadata[key] = logEntry.metadata[key];
        }
      }

      if (Object.keys(importantMetadata).length > 0) {
        parts.push(JSON.stringify(importantMetadata));
      }
    }

    return parts.join(' ');
  }

  /**
   * Export logs to CSV format
   */
  private exportToCSV(logs: LogEntry[]): string {
    const headers = ['timestamp', 'level', 'message', 'context', 'correlationId', 'userId', 'pluginId'];
    const rows = [headers.join(',')];

    for (const log of logs) {
      const row = [log.timestamp.toISOString(), log.level, `"${log.message.replace(/"/g, '""')}"`, log.context ?? '', log.correlationId ?? '', log.userId ?? '', log.pluginId ?? ''];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Export logs to text format
   */
  private exportToText(logs: LogEntry[]): string {
    return logs
      .map((log) => {
        const timestamp = log.timestamp.toISOString();
        const level = log.level.toUpperCase().padEnd(7);
        const context = log.context ? `[${log.context}]` : '';
        const correlation = log.correlationId ? `{${log.correlationId}}` : '';

        return `${timestamp} ${level} ${context} ${correlation} ${log.message}`;
      })
      .join('\n');
  }
}

export interface LogStatistics {
  totalLogs: number;
  recentLogs: number;
  dailyLogs: number;
  levelDistribution: Record<string, number>;
  contextDistribution: Record<string, number>;
  bufferUsage: number;
}
