import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private readonly configService: NestConfigService) {}

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  get pluginConfig() {
    return {
      directory: this.configService.get<string>('PLUGIN_DIRECTORY', './plugins'),
      hotReload: this.configService.get<boolean>('PLUGIN_HOT_RELOAD', this.isDevelopment),
      securityLevel: this.configService.get<string>('PLUGIN_SECURITY_LEVEL', this.isDevelopment ? 'low' : 'high'),
      sandboxed: this.configService.get<boolean>('PLUGIN_SANDBOXED', !this.isDevelopment),
      resourceLimits: {
        memory: this.configService.get<string>('PLUGIN_MEMORY_LIMIT', this.isDevelopment ? '256MB' : '128MB'),
        cpu: this.configService.get<string>('PLUGIN_CPU_LIMIT', this.isDevelopment ? '1.0' : '0.5'),
        disk: this.configService.get<string>('PLUGIN_DISK_LIMIT', '1GB'),
        network: this.configService.get<string>('PLUGIN_NETWORK_LIMIT', '10MB/s'),
        executionTime: this.configService.get<number>('PLUGIN_EXECUTION_TIMEOUT', 30000)
      }
    };
  }

  get securityConfig() {
    return {
      signatureVerification: this.configService.get<boolean>('SECURITY_SIGNATURE_VERIFICATION', !this.isDevelopment),
      trustedSources: this.configService.get<string>('SECURITY_TRUSTED_SOURCES', '').split(',').filter(s => s.trim()),
      blacklistedPatterns: this.configService.get<string>('SECURITY_BLACKLISTED_PATTERNS', '').split(',').filter(p => p.trim()),
      maxPluginSize: this.configService.get<string>('SECURITY_MAX_PLUGIN_SIZE', '10MB'),
      scanTimeout: this.configService.get<number>('SECURITY_SCAN_TIMEOUT', 30000)
    };
  }

  get metricsConfig() {
    return {
      enabled: this.configService.get<boolean>('METRICS_ENABLED', true),
      collectionInterval: this.configService.get<number>('METRICS_COLLECTION_INTERVAL', 60000),
      retentionPeriod: this.configService.get<number>('METRICS_RETENTION_PERIOD', 7 * 24 * 60 * 60 * 1000), // 7 days
      exportFormat: this.configService.get<string>('METRICS_EXPORT_FORMAT', 'json')
    };
  }

  get loggingConfig() {
    return {
      level: this.configService.get<string>('LOG_LEVEL', this.isDevelopment ? 'debug' : 'info'),
      format: this.configService.get<string>('LOG_FORMAT', 'json'),
      destination: this.configService.get<string>('LOG_DESTINATION', 'console'),
      maxFiles: this.configService.get<number>('LOG_MAX_FILES', 10),
      maxSize: this.configService.get<string>('LOG_MAX_SIZE', '10MB')
    };
  }

  get corsConfig() {
    return {
      origin: this.configService.get<string>('CORS_ORIGIN', this.isDevelopment ? '*' : 'https://yourdomain.com'),
      methods: this.configService.get<string>('CORS_METHODS', 'GET,HEAD,PUT,PATCH,POST,DELETE'),
      allowedHeaders: this.configService.get<string>('CORS_ALLOWED_HEADERS', 'Content-Type,Authorization'),
      credentials: this.configService.get<boolean>('CORS_CREDENTIALS', true)
    };
  }

  get swaggerConfig() {
    return {
      enabled: this.configService.get<boolean>('SWAGGER_ENABLED', this.isDevelopment),
      path: this.configService.get<string>('SWAGGER_PATH', 'api/docs'),
      title: this.configService.get<string>('SWAGGER_TITLE', 'NestJS Dynamic Plugin System'),
      description: this.configService.get<string>('SWAGGER_DESCRIPTION', 'Enterprise-grade dynamic plugin system for NestJS'),
      version: this.configService.get<string>('SWAGGER_VERSION', '1.0.0')
    };
  }

  get healthCheckConfig() {
    return {
      enabled: this.configService.get<boolean>('HEALTH_CHECK_ENABLED', true),
      interval: this.configService.get<number>('HEALTH_CHECK_INTERVAL', 30000),
      timeout: this.configService.get<number>('HEALTH_CHECK_TIMEOUT', 5000),
      retries: this.configService.get<number>('HEALTH_CHECK_RETRIES', 3)
    };
  }

  get cacheConfig() {
    return {
      enabled: this.configService.get<boolean>('CACHE_ENABLED', true),
      ttl: this.configService.get<number>('CACHE_TTL', 300), // 5 minutes
      maxSize: this.configService.get<number>('CACHE_MAX_SIZE', 1000),
      strategy: this.configService.get<string>('CACHE_STRATEGY', 'lru')
    };
  }

  get rateLimitConfig() {
    return {
      enabled: this.configService.get<boolean>('RATE_LIMIT_ENABLED', true),
      windowMs: this.configService.get<number>('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
      max: this.configService.get<number>('RATE_LIMIT_MAX', 100),
      skipSuccessfulRequests: this.configService.get<boolean>('RATE_LIMIT_SKIP_SUCCESSFUL', false)
    };
  }

  get eventEmitterConfig() {
    return {
      wildcard: this.configService.get<boolean>('EVENT_EMITTER_WILDCARD', true),
      delimiter: this.configService.get<string>('EVENT_EMITTER_DELIMITER', '.'),
      newListener: this.configService.get<boolean>('EVENT_EMITTER_NEW_LISTENER', false),
      removeListener: this.configService.get<boolean>('EVENT_EMITTER_REMOVE_LISTENER', false),
      maxListeners: this.configService.get<number>('EVENT_EMITTER_MAX_LISTENERS', 10),
      verboseMemoryLeak: this.configService.get<boolean>('EVENT_EMITTER_VERBOSE_MEMORY_LEAK', false)
    };
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  // Helper method to get environment-specific config
  getEnvironmentConfig<T>(key: string, defaultValue: T): T {
    const envKey = `${this.nodeEnv.toUpperCase()}_${key}`;
    return this.configService.get<T>(envKey, defaultValue);
  }

  // Helper method to validate required configuration
  validateRequiredConfig(keys: string[]): void {
    const missingKeys = keys.filter(key => !this.configService.get(key));
    
    if (missingKeys.length > 0) {
      throw new Error(`Missing required configuration: ${missingKeys.join(', ')}`);
    }
  }

  // Helper method to get configuration value
  get<T>(key: string, defaultValue?: T): T {
    return this.configService.get<T>(key, defaultValue);
  }

  // Helper method to get all configuration
  getAllConfig(): Record<string, any> {
    return {
      nodeEnv: this.nodeEnv,
      port: this.port,
      plugin: this.pluginConfig,
      security: this.securityConfig,
      metrics: this.metricsConfig,
      logging: this.loggingConfig,
      cors: this.corsConfig,
      swagger: this.swaggerConfig,
      healthCheck: this.healthCheckConfig,
      cache: this.cacheConfig,
      rateLimit: this.rateLimitConfig,
      eventEmitter: this.eventEmitterConfig
    };
  }
}