import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Application settings
  PORT: Joi.number().port().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),

  // Database configuration
  DB_TYPE: Joi.string().valid('postgres', 'mysql', 'sqlite').default('postgres'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),

  // Redis configuration
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_DATABASE: Joi.number().min(0).max(15).default(0),
  REDIS_KEY_PREFIX: Joi.string().default('plugin:'),

  // Security configuration
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  BCRYPT_ROUNDS: Joi.number().min(8).max(15).default(12),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW: Joi.number().positive().default(900000), // 15 minutes
  RATE_LIMIT_MAX: Joi.number().positive().default(100),

  // Plugin system configuration
  PLUGIN_STORAGE_PATH: Joi.string().default('./plugins'),
  PLUGIN_MAX_FILE_SIZE: Joi.number().positive().default(10485760), // 10MB
  PLUGIN_ALLOWED_TYPES: Joi.string().default('.zip,.tar.gz,.tgz'),
  PLUGIN_DEFAULT_TIMEOUT: Joi.number().positive().default(30000), // 30 seconds
  PLUGIN_MAX_INSTANCES: Joi.number().positive().default(10),
  PLUGIN_REGISTRY_URL: Joi.string().uri().default('http://localhost:3001'),
});