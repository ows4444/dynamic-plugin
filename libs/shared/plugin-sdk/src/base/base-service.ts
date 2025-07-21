import { Injectable } from '@nestjs/common';
import { BasePlugin, PluginMetadata } from './base-plugin';
import { LoggerUtil, PluginLogContext } from '../utilities/logger.util';
import { ConfigUtil, PluginConfigOptions } from '../utilities/config.util';

export interface ServiceOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

@Injectable()
export abstract class BaseService {
  protected readonly pluginId: string;
  protected readonly logContext: PluginLogContext;
  protected readonly config: PluginConfigOptions;
  protected readonly options: ServiceOptions;

  constructor(
    plugin: BasePlugin | PluginMetadata,
    config: PluginConfigOptions = {},
    options: ServiceOptions = {},
  ) {
    if (plugin instanceof BasePlugin) {
      this.pluginId = plugin.getMetadata().id;
      this.logContext = LoggerUtil.createPluginContext(
        plugin.getMetadata().id,
        plugin.getMetadata().name,
        plugin.getMetadata().version,
      );
    } else {
      this.pluginId = plugin.id;
      this.logContext = LoggerUtil.createPluginContext(
        plugin.id,
        plugin.name,
        plugin.version,
      );
    }

    this.config = config;
    this.options = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...options,
    };
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retries?: number,
  ): Promise<T> {
    const maxRetries = retries ?? this.options.retries ?? 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await Promise.race([
          operation(),
          this.createTimeoutPromise<T>(this.options.timeout ?? 30000),
        ]);
        const duration = Date.now() - startTime;

        this.logPerformance(`${operationName} (attempt ${attempt})`, duration);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.logWarn(
          `${operationName} failed on attempt ${attempt}/${maxRetries}`,
          {
            error: lastError.message,
            attempt,
            maxRetries,
          },
        );

        if (attempt < maxRetries) {
          await this.delay(this.options.retryDelay ?? 1000);
        }
      }
    }

    this.logError(
      `${operationName} failed after ${maxRetries} attempts`,
      lastError,
    );
    throw lastError;
  }

  private createTimeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected getConfigValue<T>(key: string, defaultValue?: T): T | undefined {
    return ConfigUtil.getConfigValue(this.config, key, defaultValue);
  }

  protected log(message: string, data?: any): void {
    LoggerUtil.log(this.pluginId, message, this.logContext, data);
  }

  protected logError(message: string, error?: Error): void {
    LoggerUtil.error(this.pluginId, message, error, this.logContext);
  }

  protected logWarn(message: string, data?: any): void {
    LoggerUtil.warn(this.pluginId, message, this.logContext, data);
  }

  protected logDebug(message: string, data?: any): void {
    LoggerUtil.debug(this.pluginId, message, this.logContext, data);
  }

  protected audit(action: string, data?: any): void {
    LoggerUtil.audit(this.pluginId, action, this.logContext, data);
  }

  protected logPerformance(operation: string, duration: number): void {
    LoggerUtil.performance(this.pluginId, operation, duration, this.logContext);
  }

  protected logSecurity(event: string, data?: any): void {
    LoggerUtil.security(this.pluginId, event, this.logContext, data);
  }

  protected validateInput(data: any, schema: any): boolean {
    // Implement validation logic using ValidationUtil if needed
    return true;
  }

  protected sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }
}
