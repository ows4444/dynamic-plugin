import { Injectable } from '@nestjs/common';

export interface PluginConfigOptions {
  [key: string]: any;
}

@Injectable()
export class ConfigUtil {
  static validateConfig(config: PluginConfigOptions, schema: any): boolean {
    // Basic validation logic
    if (!config || typeof config !== 'object') {
      return false;
    }

    // Add schema validation logic here
    return true;
  }

  static mergeConfigs(
    defaultConfig: PluginConfigOptions,
    userConfig: PluginConfigOptions,
  ): PluginConfigOptions {
    return {
      ...defaultConfig,
      ...userConfig,
    };
  }

  static getConfigValue<T>(
    config: PluginConfigOptions,
    key: string,
    defaultValue?: T,
  ): T | undefined {
    const keys = key.split('.');
    let value = config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value as T;
  }

  static setConfigValue(
    config: PluginConfigOptions,
    key: string,
    value: any,
  ): void {
    const keys = key.split('.');
    const lastKey = keys.pop();

    if (!lastKey) return;

    let current = config;
    for (const k of keys) {
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    current[lastKey] = value;
  }
}
