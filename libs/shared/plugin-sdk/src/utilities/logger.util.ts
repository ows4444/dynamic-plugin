import { Injectable, Logger, LogLevel } from '@nestjs/common';

export interface PluginLogContext {
  pluginId: string;
  pluginName: string;
  version: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: PluginLogContext;
  timestamp: Date;
  data?: any;
}

@Injectable()
export class LoggerUtil {
  private static loggers = new Map<string, Logger>();

  static getLogger(pluginId: string): Logger {
    if (!this.loggers.has(pluginId)) {
      this.loggers.set(pluginId, new Logger(`Plugin:${pluginId}`));
    }
    return this.loggers.get(pluginId)!;
  }

  static log(
    pluginId: string,
    message: string,
    context?: PluginLogContext,
    data?: any,
  ): void {
    const logger = this.getLogger(pluginId);
    const logMessage = this.formatMessage(message, context, data);
    logger.log(logMessage);
  }

  static error(
    pluginId: string,
    message: string,
    error?: Error,
    context?: PluginLogContext,
  ): void {
    const logger = this.getLogger(pluginId);
    const logMessage = this.formatMessage(message, context, {
      error: error?.stack || error?.message,
    });
    logger.error(logMessage);
  }

  static warn(
    pluginId: string,
    message: string,
    context?: PluginLogContext,
    data?: any,
  ): void {
    const logger = this.getLogger(pluginId);
    const logMessage = this.formatMessage(message, context, data);
    logger.warn(logMessage);
  }

  static debug(
    pluginId: string,
    message: string,
    context?: PluginLogContext,
    data?: any,
  ): void {
    const logger = this.getLogger(pluginId);
    const logMessage = this.formatMessage(message, context, data);
    logger.debug(logMessage);
  }

  static verbose(
    pluginId: string,
    message: string,
    context?: PluginLogContext,
    data?: any,
  ): void {
    const logger = this.getLogger(pluginId);
    const logMessage = this.formatMessage(message, context, data);
    logger.verbose(logMessage);
  }

  static createPluginContext(
    pluginId: string,
    pluginName: string,
    version: string,
    additional?: Record<string, any>,
  ): PluginLogContext {
    return {
      pluginId,
      pluginName,
      version,
      ...additional,
    };
  }

  private static formatMessage(
    message: string,
    context?: PluginLogContext,
    data?: any,
  ): string {
    let formatted = message;

    if (context) {
      const contextStr = Object.entries(context)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      formatted += ` [${contextStr}]`;
    }

    if (data) {
      const dataStr =
        typeof data === 'object' ? JSON.stringify(data) : String(data);
      formatted += ` ${dataStr}`;
    }

    return formatted;
  }

  static audit(
    pluginId: string,
    action: string,
    context?: PluginLogContext,
    data?: any,
  ): void {
    const logger = this.getLogger(pluginId);
    const auditMessage = `AUDIT: ${action}`;
    const logMessage = this.formatMessage(auditMessage, context, data);
    logger.log(logMessage);
  }

  static performance(
    pluginId: string,
    operation: string,
    duration: number,
    context?: PluginLogContext,
  ): void {
    const logger = this.getLogger(pluginId);
    const perfMessage = `PERF: ${operation} completed in ${duration}ms`;
    const logMessage = this.formatMessage(perfMessage, context);
    logger.log(logMessage);
  }

  static security(
    pluginId: string,
    event: string,
    context?: PluginLogContext,
    data?: any,
  ): void {
    const logger = this.getLogger(pluginId);
    const securityMessage = `SECURITY: ${event}`;
    const logMessage = this.formatMessage(securityMessage, context, data);
    logger.warn(logMessage);
  }
}
