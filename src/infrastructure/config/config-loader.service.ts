import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Configuration loader service for loading configurations from various sources
 */
@Injectable()
export class ConfigLoaderService {
  private readonly logger = new Logger(ConfigLoaderService.name);

  /**
   * Load configuration from a JSON file
   */
  loadFromFile<T = Record<string, unknown>>(filePath: string): T | null {
    try {
      if (!existsSync(filePath)) {
        this.logger.warn(`Configuration file not found: ${filePath}`);
        return null;
      }

      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content) as T;
    } catch (error) {
      this.logger.error(`Failed to load configuration from file ${filePath}`, error);
      return null;
    }
  }

  /**
   * Load plugin configuration
   */
  loadPluginConfig<T = Record<string, unknown>>(pluginId: string): T | null {
    const configPath = join(process.cwd(), 'plugins', 'config', `${pluginId}.json`);
    return this.loadFromFile<T>(configPath);
  }

  /**
   * Load application configuration schema
   */
  loadConfigSchema(): ConfigSchema | null {
    const schemaPath = join(process.cwd(), 'config', 'schema.json');
    return this.loadFromFile<ConfigSchema>(schemaPath);
  }

  /**
   * Merge configurations with precedence
   */
  mergeConfigs<T>(...configs: Array<T | null>): T {
    const validConfigs = configs.filter((config): config is T => config !== null);

    if (validConfigs.length === 0) {
      return {} as unknown as T;
    }

    return validConfigs.reduce(
      (merged, config) => ({
        ...merged,
        ...config,
      }),
      {} as T,
    );
  }
}

export interface ConfigSchema {
  type: 'object';
  properties: Record<string, ConfigProperty>;
  required?: string[];
}

export interface ConfigProperty {
  type: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
}
