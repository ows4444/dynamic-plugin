import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';
import * as Joi from 'joi';

const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  
  // Plugin configuration
  PLUGIN_DIRECTORY: Joi.string().default('./plugins'),
  PLUGIN_HOT_RELOAD: Joi.boolean().default(true),
  PLUGIN_SECURITY_LEVEL: Joi.string().valid('low', 'medium', 'high').default('medium'),
  PLUGIN_SANDBOXED: Joi.boolean().default(false),
  PLUGIN_MEMORY_LIMIT: Joi.string().default('256MB'),
  PLUGIN_CPU_LIMIT: Joi.string().default('1.0'),
  PLUGIN_DISK_LIMIT: Joi.string().default('1GB'),
  PLUGIN_NETWORK_LIMIT: Joi.string().default('10MB/s'),
  PLUGIN_EXECUTION_TIMEOUT: Joi.number().default(30000),
  
  // Security configuration
  SECURITY_SIGNATURE_VERIFICATION: Joi.boolean().default(false),
  SECURITY_TRUSTED_SOURCES: Joi.string().default(''),
  SECURITY_BLACKLISTED_PATTERNS: Joi.string().default(''),
  SECURITY_MAX_PLUGIN_SIZE: Joi.string().default('10MB'),
  SECURITY_SCAN_TIMEOUT: Joi.number().default(30000),
  
  // Metrics configuration
  METRICS_ENABLED: Joi.boolean().default(true),
  METRICS_COLLECTION_INTERVAL: Joi.number().default(60000),
  METRICS_RETENTION_PERIOD: Joi.number().default(7 * 24 * 60 * 60 * 1000),
  METRICS_EXPORT_FORMAT: Joi.string().valid('json', 'csv', 'xml').default('json'),
  
  // Logging configuration
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple', 'combined').default('json'),
  LOG_DESTINATION: Joi.string().valid('console', 'file', 'both').default('console'),
  LOG_MAX_FILES: Joi.number().default(10),
  LOG_MAX_SIZE: Joi.string().default('10MB'),
  
  // CORS configuration
  CORS_ORIGIN: Joi.string().default('*'),
  CORS_METHODS: Joi.string().default('GET,HEAD,PUT,PATCH,POST,DELETE'),
  CORS_ALLOWED_HEADERS: Joi.string().default('Content-Type,Authorization'),
  CORS_CREDENTIALS: Joi.boolean().default(true),
  
  // Swagger configuration
  SWAGGER_ENABLED: Joi.boolean().default(true),
  SWAGGER_PATH: Joi.string().default('api/docs'),
  SWAGGER_TITLE: Joi.string().default('NestJS Dynamic Plugin System'),
  SWAGGER_DESCRIPTION: Joi.string().default('Enterprise-grade dynamic plugin system for NestJS'),
  SWAGGER_VERSION: Joi.string().default('1.0.0'),
  
  // Health check configuration
  HEALTH_CHECK_ENABLED: Joi.boolean().default(true),
  HEALTH_CHECK_INTERVAL: Joi.number().default(30000),
  HEALTH_CHECK_TIMEOUT: Joi.number().default(5000),
  HEALTH_CHECK_RETRIES: Joi.number().default(3),
  
  // Cache configuration
  CACHE_ENABLED: Joi.boolean().default(true),
  CACHE_TTL: Joi.number().default(300),
  CACHE_MAX_SIZE: Joi.number().default(1000),
  CACHE_STRATEGY: Joi.string().valid('lru', 'lfu', 'fifo').default('lru'),
  
  // Rate limiting configuration
  RATE_LIMIT_ENABLED: Joi.boolean().default(true),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: Joi.number().default(100),
  RATE_LIMIT_SKIP_SUCCESSFUL: Joi.boolean().default(false),
  
  // Event emitter configuration
  EVENT_EMITTER_WILDCARD: Joi.boolean().default(true),
  EVENT_EMITTER_DELIMITER: Joi.string().default('.'),
  EVENT_EMITTER_NEW_LISTENER: Joi.boolean().default(false),
  EVENT_EMITTER_REMOVE_LISTENER: Joi.boolean().default(false),
  EVENT_EMITTER_MAX_LISTENERS: Joi.number().default(10),
  EVENT_EMITTER_VERBOSE_MEMORY_LEAK: Joi.boolean().default(false)
});

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}