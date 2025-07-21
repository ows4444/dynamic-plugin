import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoggerUtil, PluginLogContext } from '../utilities/logger.util';
import { ConfigUtil, PluginConfigOptions } from '../utilities/config.util';

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license?: string;
  tags?: string[];
}

export interface PluginLifecycleHooks {
  onInstall?(): Promise<void> | void;
  onUninstall?(): Promise<void> | void;
  onEnable?(): Promise<void> | void;
  onDisable?(): Promise<void> | void;
  onUpdate?(fromVersion: string, toVersion: string): Promise<void> | void;
}

@Injectable()
export abstract class BasePlugin
  implements OnModuleInit, OnModuleDestroy, PluginLifecycleHooks
{
  protected readonly metadata: PluginMetadata;
  protected readonly config: PluginConfigOptions;
  protected readonly logContext: PluginLogContext;
  protected isEnabled = false;

  constructor(metadata: PluginMetadata, config: PluginConfigOptions = {}) {
    this.metadata = metadata;
    this.config = config;
    this.logContext = LoggerUtil.createPluginContext(
      metadata.id,
      metadata.name,
      metadata.version,
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      LoggerUtil.log(
        this.metadata.id,
        'Plugin module initializing',
        this.logContext,
      );
      await this.onEnable?.();
      this.isEnabled = true;
      LoggerUtil.log(
        this.metadata.id,
        'Plugin module initialized successfully',
        this.logContext,
      );
    } catch (error) {
      LoggerUtil.error(
        this.metadata.id,
        'Failed to initialize plugin module',
        error as Error,
        this.logContext,
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      LoggerUtil.log(
        this.metadata.id,
        'Plugin module destroying',
        this.logContext,
      );
      await this.onDisable?.();
      this.isEnabled = false;
      LoggerUtil.log(
        this.metadata.id,
        'Plugin module destroyed successfully',
        this.logContext,
      );
    } catch (error) {
      LoggerUtil.error(
        this.metadata.id,
        'Failed to destroy plugin module',
        error as Error,
        this.logContext,
      );
      throw error;
    }
  }

  getMetadata(): PluginMetadata {
    return { ...this.metadata };
  }

  getConfig(): PluginConfigOptions {
    return { ...this.config };
  }

  getConfigValue<T>(key: string, defaultValue?: T): T | undefined {
    return ConfigUtil.getConfigValue(this.config, key, defaultValue);
  }

  isPluginEnabled(): boolean {
    return this.isEnabled;
  }

  protected log(message: string, data?: any): void {
    LoggerUtil.log(this.metadata.id, message, this.logContext, data);
  }

  protected logError(message: string, error?: Error): void {
    LoggerUtil.error(this.metadata.id, message, error, this.logContext);
  }

  protected logWarn(message: string, data?: any): void {
    LoggerUtil.warn(this.metadata.id, message, this.logContext, data);
  }

  protected logDebug(message: string, data?: any): void {
    LoggerUtil.debug(this.metadata.id, message, this.logContext, data);
  }

  protected audit(action: string, data?: any): void {
    LoggerUtil.audit(this.metadata.id, action, this.logContext, data);
  }

  protected logPerformance(operation: string, duration: number): void {
    LoggerUtil.performance(
      this.metadata.id,
      operation,
      duration,
      this.logContext,
    );
  }

  protected logSecurity(event: string, data?: any): void {
    LoggerUtil.security(this.metadata.id, event, this.logContext, data);
  }

  abstract getName(): string;
  abstract getDescription(): string;
  abstract getVersion(): string;
}
