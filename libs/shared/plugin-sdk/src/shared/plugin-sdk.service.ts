import { Injectable } from '@nestjs/common';
import { PluginMetadata } from '../base/base-plugin';
import { PluginContext } from '../context/plugin-context';
import { ConfigUtil, PluginConfigOptions } from '../utilities/config.util';
import { LoggerUtil } from '../utilities/logger.util';
import { ValidationData, ValidationSchema, ValidationUtil } from '../utilities/validation.util';

@Injectable()
export class PluginSdkService {
  constructor(private readonly pluginContext: PluginContext) {}

  registerPlugin(metadata: PluginMetadata, _config: unknown): void {
    this.pluginContext.setPlugin(metadata);
    LoggerUtil.log(
      metadata.id,
      'Plugin registered',
      this.pluginContext.getExecutionContext(),
      {
        name: metadata.name,
        version: metadata.version,
      },
    );
  }

  getPluginContext(): PluginContext {
    return this.pluginContext;
  }

  validateConfig(config: unknown, schema: unknown): boolean {
    return ConfigUtil.validateConfig(config as PluginConfigOptions, schema);
  }

  validateInput(data: unknown, schema: unknown): unknown {
    return ValidationUtil.validate(data as ValidationData, schema as ValidationSchema);
  }

  log(pluginId: string, message: string, data?: unknown): void {
    LoggerUtil.log(
      pluginId,
      message,
      this.pluginContext.getExecutionContext(),
      data,
    );
  }

  logError(pluginId: string, message: string, error?: Error): void {
    LoggerUtil.error(
      pluginId,
      message,
      error,
      this.pluginContext.getExecutionContext(),
    );
  }

  logPerformance(pluginId: string, operation: string, duration: number): void {
    LoggerUtil.performance(
      pluginId,
      operation,
      duration,
      this.pluginContext.getExecutionContext(),
    );
  }

  audit(pluginId: string, action: string, data?: unknown): void {
    LoggerUtil.audit(
      pluginId,
      action,
      this.pluginContext.getExecutionContext(),
      data,
    );
  }
}
