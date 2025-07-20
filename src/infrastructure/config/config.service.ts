import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

/**
 * Enhanced configuration service with type safety and plugin-specific configurations
 */
@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  constructor(private readonly nestConfigService: NestConfigService) {}

  /**
   * Get configuration value with type safety
   */
  get<T = string>(key: string, defaultValue?: T): T {
    return this.nestConfigService.get<T>(key) ?? (defaultValue as T);
  }

  /**
   * Get plugin-specific configuration
   */
  getPluginConfig<T = Record<string, unknown>>(pluginId: string, defaultValue?: T): T {
    const key = `PLUGIN_${pluginId.toUpperCase().replace(/-/g, '_')}`;
    return this.get<T>(key, defaultValue);
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(): DatabaseConfig {
    return {
      type: this.get('DB_TYPE', 'postgres'),
      host: this.get('DB_HOST', 'localhost'),
      port: this.get('DB_PORT', 5432),
      username: this.get('DB_USERNAME', 'postgres'),
      password: this.get('DB_PASSWORD', 'password'),
      database: this.get('DB_DATABASE', 'plugin_system'),
      synchronize: this.get('DB_SYNCHRONIZE', false),
      logging: this.get('DB_LOGGING', false),
      ssl: this.get('DB_SSL', false),
      poolSize: this.get('DB_POOL_SIZE', 10),
    };
  }

  /**
   * Get Redis configuration
   */
  getRedisConfig(): RedisConfig {
    return {
      host: this.get('REDIS_HOST', 'localhost'),
      port: this.get('REDIS_PORT', 6379),
      password: this.get('REDIS_PASSWORD'),
      db: this.get('REDIS_DB', 0),
      ttl: this.get('REDIS_TTL', 3600),
      keyPrefix: this.get('REDIS_KEY_PREFIX', 'plugin:'),
    };
  }

  /**
   * Get cache configuration
   */
  getCacheConfig(): CacheConfig {
    return {
      defaultTtl: this.get('CACHE_DEFAULT_TTL', 3600),
      enableL1Cache: this.get('CACHE_ENABLE_L1', true),
      enableL2Cache: this.get('CACHE_ENABLE_L2', false),
      maxMemorySize: this.get('CACHE_MAX_MEMORY_SIZE', 100 * 1024 * 1024),
      evictionPolicy: this.get('CACHE_EVICTION_POLICY', 'LRU'),
      compressionEnabled: this.get('CACHE_COMPRESSION_ENABLED', false),
      serializationFormat: this.get('CACHE_SERIALIZATION_FORMAT', 'json'),
      redis: this.getRedisConfig(),
    };
  }

  /**
   * Get security configuration
   */
  getSecurityConfig(): SecurityConfig {
    return {
      jwtSecret: this.get('JWT_SECRET', 'super-secret-jwt-key'),
      jwtExpirationTime: this.get('JWT_EXPIRATION_TIME', '24h'),
      bcryptSaltRounds: this.get('BCRYPT_SALT_ROUNDS', 10),
      rateLimitWindow: this.get('RATE_LIMIT_WINDOW', 15 * 60 * 1000), // 15 minutes
      rateLimitMax: this.get('RATE_LIMIT_MAX', 100),
      corsOrigins: this.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    };
  }

  /**
   * Get monitoring configuration
   */
  getMonitoringConfig(): MonitoringConfig {
    return {
      enableMetrics: this.get('ENABLE_METRICS', true),
      enableTracing: this.get('ENABLE_TRACING', false),
      metricsPort: this.get('METRICS_PORT', 9090),
      healthCheckInterval: this.get('HEALTH_CHECK_INTERVAL', 30000),
      logLevel: this.get('LOG_LEVEL', 'info'),
    };
  }

  /**
   * Get plugin system configuration
   */
  getPluginSystemConfig(): PluginSystemConfig {
    return {
      pluginDirectory: this.get('PLUGIN_DIRECTORY', './plugins'),
      maxPlugins: this.get('MAX_PLUGINS', 100),
      pluginTimeout: this.get('PLUGIN_TIMEOUT', 30000),
      enableHotReload: this.get('ENABLE_HOT_RELOAD', true),
      sandboxMode: this.get('SANDBOX_MODE', true),
      maxMemoryPerPlugin: this.get('MAX_MEMORY_PER_PLUGIN', 100 * 1024 * 1024), // 100MB
      maxCpuPerPlugin: this.get('MAX_CPU_PER_PLUGIN', 50), // 50%
    };
  }

  /**
   * Validate configuration on startup
   */
  validateConfiguration(): boolean {
    try {
      const requiredVars = ['NODE_ENV'];

      for (const varName of requiredVars) {
        if (!this.get(varName)) {
          this.logger.error(`Required environment variable ${varName} is not set`);
          return false;
        }
      }

      this.logger.log('Configuration validation successful');
      return true;
    } catch (error) {
      this.logger.error('Configuration validation failed', error);
      return false;
    }
  }
}

export interface DatabaseConfig {
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
  ssl: boolean;
  poolSize: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  ttl: number;
  keyPrefix: string;
}

export interface CacheConfig {
  defaultTtl: number;
  enableL1Cache: boolean;
  enableL2Cache: boolean;
  maxMemorySize: number;
  evictionPolicy: 'LRU' | 'LFU' | 'FIFO';
  compressionEnabled: boolean;
  serializationFormat: 'json' | 'msgpack' | 'protobuf';
  redis: RedisConfig;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpirationTime: string;
  bcryptSaltRounds: number;
  rateLimitWindow: number;
  rateLimitMax: number;
  corsOrigins: string[];
}

export interface MonitoringConfig {
  enableMetrics: boolean;
  enableTracing: boolean;
  metricsPort: number;
  healthCheckInterval: number;
  logLevel: string;
}

export interface PluginSystemConfig {
  pluginDirectory: string;
  maxPlugins: number;
  pluginTimeout: number;
  enableHotReload: boolean;
  sandboxMode: boolean;
  maxMemoryPerPlugin: number;
  maxCpuPerPlugin: number;
}
