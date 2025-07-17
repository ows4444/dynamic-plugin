import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as Joi from 'joi';
import { ConfigService } from '../config/config.service';

export interface PluginConfig {
  pluginId: string;
  environment: string;
  version: string;
  config: any;
  schema?: Joi.Schema;
  encrypted?: boolean;
  timestamp: Date;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  schema: Joi.Schema;
  defaultValues: any;
  environments: string[];
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigOverride {
  pluginId: string;
  environment: string;
  path: string;
  value: any;
  priority: number;
  source: 'file' | 'env' | 'api' | 'default';
}

@Injectable()
export class ConfigManagerService {
  private readonly logger = new Logger(ConfigManagerService.name);
  private readonly configs = new Map<string, PluginConfig>();
  private readonly templates = new Map<string, ConfigTemplate>();
  private readonly overrides = new Map<string, ConfigOverride[]>();
  private readonly watchers = new Map<string, any>();
  private readonly configHistory = new Map<string, PluginConfig[]>();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.initializeDefaultTemplates();
  }

  async loadPluginConfig(pluginId: string, environment?: string): Promise<PluginConfig> {
    const env = environment || this.configService.get('NODE_ENV') || 'development';
    const configKey = `${pluginId}:${env}`;

    // Check cache first
    if (this.configs.has(configKey)) {
      return this.configs.get(configKey);
    }

    try {
      this.logger.log(`Loading config for plugin ${pluginId} in ${env} environment`);

      // Load base config
      const baseConfig = await this.loadBaseConfig(pluginId);
      
      // Load environment-specific config
      const envConfig = await this.loadEnvironmentConfig(pluginId, env);
      
      // Apply overrides
      const overrides = await this.getApplicableOverrides(pluginId, env);
      
      // Merge configurations
      const mergedConfig = this.mergeConfigs(baseConfig, envConfig, overrides);
      
      // Load schema
      const schema = await this.loadConfigSchema(pluginId);
      
      // Create plugin config
      const pluginConfig: PluginConfig = {
        pluginId,
        environment: env,
        version: '1.0.0',
        config: mergedConfig,
        schema,
        timestamp: new Date()
      };

      // Validate config
      const validation = await this.validateConfig(pluginConfig);
      if (!validation.valid) {
        throw new Error(`Config validation failed: ${validation.errors.join(', ')}`);
      }

      // Cache the config
      this.configs.set(configKey, pluginConfig);
      
      // Store in history
      this.storeConfigHistory(pluginConfig);

      // Start watching for changes
      this.startWatching(pluginId, env);

      // Emit config loaded event
      this.eventEmitter.emit('plugin.config.loaded', {
        pluginId,
        environment: env,
        config: pluginConfig,
        timestamp: new Date()
      });

      return pluginConfig;
    } catch (error) {
      this.logger.error(`Failed to load config for plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async savePluginConfig(pluginId: string, config: any, environment?: string): Promise<void> {
    const env = environment || this.configService.get('NODE_ENV') || 'development';
    
    try {
      this.logger.log(`Saving config for plugin ${pluginId} in ${env} environment`);

      // Validate config
      const schema = await this.loadConfigSchema(pluginId);
      if (schema) {
        const { error } = schema.validate(config);
        if (error) {
          throw new Error(`Config validation failed: ${error.message}`);
        }
      }

      // Save to file
      await this.saveConfigToFile(pluginId, config, env);
      
      // Update cache
      const configKey = `${pluginId}:${env}`;
      const pluginConfig: PluginConfig = {
        pluginId,
        environment: env,
        version: '1.0.0',
        config,
        schema,
        timestamp: new Date()
      };
      
      this.configs.set(configKey, pluginConfig);
      
      // Store in history
      this.storeConfigHistory(pluginConfig);

      // Emit config saved event
      this.eventEmitter.emit('plugin.config.saved', {
        pluginId,
        environment: env,
        config: pluginConfig,
        timestamp: new Date()
      });

      this.logger.log(`Config saved for plugin ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to save config for plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async validateConfig(pluginConfig: PluginConfig): Promise<ConfigValidationResult> {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (!pluginConfig.schema) {
      result.warnings.push('No schema provided for validation');
      return result;
    }

    try {
      const { error } = pluginConfig.schema.validate(pluginConfig.config);
      if (error) {
        result.valid = false;
        result.errors.push(error.message);
      }
    } catch (err) {
      result.valid = false;
      result.errors.push(`Schema validation failed: ${err.message}`);
    }

    return result;
  }

  async setConfigOverride(override: ConfigOverride): Promise<void> {
    const key = `${override.pluginId}:${override.environment}`;
    
    if (!this.overrides.has(key)) {
      this.overrides.set(key, []);
    }

    const overrides = this.overrides.get(key);
    
    // Remove existing override for the same path
    const existingIndex = overrides.findIndex(o => o.path === override.path);
    if (existingIndex !== -1) {
      overrides.splice(existingIndex, 1);
    }

    // Add new override
    overrides.push(override);
    
    // Sort by priority (higher priority first)
    overrides.sort((a, b) => b.priority - a.priority);

    // Reload config to apply override
    await this.reloadConfig(override.pluginId, override.environment);

    this.logger.log(`Config override set for ${override.pluginId}:${override.path}`);
  }

  async removeConfigOverride(pluginId: string, environment: string, path: string): Promise<void> {
    const key = `${pluginId}:${environment}`;
    const overrides = this.overrides.get(key);
    
    if (overrides) {
      const index = overrides.findIndex(o => o.path === path);
      if (index !== -1) {
        overrides.splice(index, 1);
        
        // Reload config to remove override
        await this.reloadConfig(pluginId, environment);
        
        this.logger.log(`Config override removed for ${pluginId}:${path}`);
      }
    }
  }

  async reloadConfig(pluginId: string, environment?: string): Promise<PluginConfig> {
    const env = environment || this.configService.get('NODE_ENV') || 'development';
    const configKey = `${pluginId}:${env}`;

    // Clear cache
    this.configs.delete(configKey);

    // Reload config
    return await this.loadPluginConfig(pluginId, env);
  }

  getConfigHistory(pluginId: string, environment?: string): PluginConfig[] {
    const key = environment ? `${pluginId}:${environment}` : pluginId;
    return this.configHistory.get(key) || [];
  }

  registerConfigTemplate(template: ConfigTemplate): void {
    this.templates.set(template.id, template);
    this.logger.log(`Config template registered: ${template.id}`);
  }

  getConfigTemplate(templateId: string): ConfigTemplate | undefined {
    return this.templates.get(templateId);
  }

  async generateConfigFromTemplate(templateId: string, pluginId: string, environment: string): Promise<any> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Config template not found: ${templateId}`);
    }

    if (!template.environments.includes(environment)) {
      throw new Error(`Template ${templateId} not supported for environment ${environment}`);
    }

    // Start with default values
    let config = { ...template.defaultValues };

    // Apply environment-specific defaults
    const envDefaults = await this.getEnvironmentDefaults(environment);
    config = { ...config, ...envDefaults };

    // Apply any existing overrides
    const overrides = await this.getApplicableOverrides(pluginId, environment);
    config = this.applyOverrides(config, overrides);

    return config;
  }

  private async loadBaseConfig(pluginId: string): Promise<any> {
    const configPath = path.join(process.cwd(), 'plugins', pluginId, 'config', 'default.json');
    
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }

    return {};
  }

  private async loadEnvironmentConfig(pluginId: string, environment: string): Promise<any> {
    const configPath = path.join(process.cwd(), 'plugins', pluginId, 'config', `${environment}.json`);
    
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }

    return {};
  }

  private async loadConfigSchema(pluginId: string): Promise<Joi.Schema | undefined> {
    const schemaPath = path.join(process.cwd(), 'plugins', pluginId, 'config', 'schema.js');
    
    if (await fs.pathExists(schemaPath)) {
      try {
        delete require.cache[require.resolve(schemaPath)];
        const schemaModule = require(schemaPath);
        return schemaModule.default || schemaModule;
      } catch (error) {
        this.logger.warn(`Failed to load schema for plugin ${pluginId}:`, error);
      }
    }

    return undefined;
  }

  private async getApplicableOverrides(pluginId: string, environment: string): Promise<ConfigOverride[]> {
    const key = `${pluginId}:${environment}`;
    return this.overrides.get(key) || [];
  }

  private mergeConfigs(baseConfig: any, envConfig: any, overrides: ConfigOverride[]): any {
    let merged = { ...baseConfig, ...envConfig };
    
    // Apply overrides
    merged = this.applyOverrides(merged, overrides);
    
    // Apply environment variables
    merged = this.applyEnvironmentVariables(merged);

    return merged;
  }

  private applyOverrides(config: any, overrides: ConfigOverride[]): any {
    let result = { ...config };

    for (const override of overrides) {
      result = this.setValueAtPath(result, override.path, override.value);
    }

    return result;
  }

  private applyEnvironmentVariables(config: any): any {
    const result = { ...config };

    // Look for environment variable placeholders
    const envVarPattern = /\$\{([^}]+)\}/g;
    
    const processValue = (value: any): any => {
      if (typeof value === 'string') {
        return value.replace(envVarPattern, (match, envVar) => {
          return process.env[envVar] || match;
        });
      } else if (typeof value === 'object' && value !== null) {
        const processed = {};
        for (const [key, val] of Object.entries(value)) {
          processed[key] = processValue(val);
        }
        return processed;
      }
      return value;
    };

    return processValue(result);
  }

  private setValueAtPath(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return obj;
  }

  private async saveConfigToFile(pluginId: string, config: any, environment: string): Promise<void> {
    const configDir = path.join(process.cwd(), 'plugins', pluginId, 'config');
    const configPath = path.join(configDir, `${environment}.json`);

    await fs.ensureDir(configDir);
    await fs.writeJson(configPath, config, { spaces: 2 });
  }

  private async getEnvironmentDefaults(environment: string): Promise<any> {
    const defaults = {
      development: {
        debug: true,
        logLevel: 'debug'
      },
      staging: {
        debug: false,
        logLevel: 'info'
      },
      production: {
        debug: false,
        logLevel: 'warn'
      }
    };

    return defaults[environment] || {};
  }

  private startWatching(pluginId: string, environment: string): void {
    const configDir = path.join(process.cwd(), 'plugins', pluginId, 'config');
    const watchKey = `${pluginId}:${environment}`;

    if (this.watchers.has(watchKey)) {
      return; // Already watching
    }

    if (fs.existsSync(configDir)) {
      const chokidar = require('chokidar');
      const watcher = chokidar.watch(configDir, {
        ignored: /node_modules/,
        persistent: true
      });

      watcher.on('change', async (filePath: string) => {
        if (filePath.endsWith('.json')) {
          this.logger.log(`Config file changed: ${filePath}`);
          
          try {
            await this.reloadConfig(pluginId, environment);
          } catch (error) {
            this.logger.error(`Failed to reload config after file change:`, error);
          }
        }
      });

      this.watchers.set(watchKey, watcher);
    }
  }

  private storeConfigHistory(config: PluginConfig): void {
    const key = `${config.pluginId}:${config.environment}`;
    
    if (!this.configHistory.has(key)) {
      this.configHistory.set(key, []);
    }

    const history = this.configHistory.get(key);
    history.push(config);

    // Keep only last 50 configurations
    if (history.length > 50) {
      history.shift();
    }
  }

  private initializeDefaultTemplates(): void {
    // Web API Plugin Template
    this.registerConfigTemplate({
      id: 'web-api-plugin',
      name: 'Web API Plugin',
      description: 'Configuration template for web API plugins',
      environments: ['development', 'staging', 'production'],
      schema: Joi.object({
        server: Joi.object({
          port: Joi.number().default(3000),
          host: Joi.string().default('localhost')
        }),
        database: Joi.object({
          url: Joi.string().required(),
          pool: Joi.object({
            min: Joi.number().default(2),
            max: Joi.number().default(10)
          })
        }),
        logging: Joi.object({
          level: Joi.string().valid('debug', 'info', 'warn', 'error').default('info')
        })
      }),
      defaultValues: {
        server: {
          port: 3000,
          host: 'localhost'
        },
        database: {
          pool: {
            min: 2,
            max: 10
          }
        },
        logging: {
          level: 'info'
        }
      }
    });

    // Background Worker Template
    this.registerConfigTemplate({
      id: 'background-worker',
      name: 'Background Worker',
      description: 'Configuration template for background worker plugins',
      environments: ['development', 'staging', 'production'],
      schema: Joi.object({
        worker: Joi.object({
          concurrency: Joi.number().default(1),
          interval: Joi.number().default(60000)
        }),
        queue: Joi.object({
          maxSize: Joi.number().default(1000)
        })
      }),
      defaultValues: {
        worker: {
          concurrency: 1,
          interval: 60000
        },
        queue: {
          maxSize: 1000
        }
      }
    });

    this.logger.log('Initialized default config templates');
  }
}