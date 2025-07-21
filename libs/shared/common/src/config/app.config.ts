import { ConfigFactory } from '@nestjs/config';

export interface DatabaseConfig {
  type: 'postgres' | 'mysql' | 'sqlite';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl?: boolean;
  synchronize?: boolean;
  logging?: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  keyPrefix?: string;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  corsOrigins: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
}

export interface PluginConfig {
  storagePath: string;
  maxFileSize: number;
  allowedTypes: string[];
  defaultTimeout: number;
  maxInstances: number;
  registryUrl: string;
}

export interface AppConfiguration {
  port: number;
  environment: 'development' | 'staging' | 'production' | 'test';
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  database: DatabaseConfig;
  redis: RedisConfig;
  security: SecurityConfig;
  plugin: PluginConfig;
}

export const appConfig: ConfigFactory<AppConfiguration> = () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  environment: (process.env.NODE_ENV as AppConfiguration['environment']) ?? 'development',
  logLevel: (process.env.LOG_LEVEL as AppConfiguration['logLevel']) ?? 'info',
  
  database: {
    type: (process.env.DB_TYPE as DatabaseConfig['type']) ?? 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'password',
    database: process.env.DB_DATABASE ?? 'plugin_system',
    ssl: process.env.DB_SSL === 'true',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
    database: parseInt(process.env.REDIS_DATABASE ?? '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'plugin:',
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET ?? 'your-secret-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
    corsOrigins: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW ?? '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  },
  
  plugin: {
    storagePath: process.env.PLUGIN_STORAGE_PATH ?? './plugins',
    maxFileSize: parseInt(process.env.PLUGIN_MAX_FILE_SIZE ?? '10485760', 10), // 10MB
    allowedTypes: process.env.PLUGIN_ALLOWED_TYPES?.split(',') ?? ['.zip', '.tar.gz', '.tgz'],
    defaultTimeout: parseInt(process.env.PLUGIN_DEFAULT_TIMEOUT ?? '30000', 10), // 30 seconds
    maxInstances: parseInt(process.env.PLUGIN_MAX_INSTANCES ?? '10', 10),
    registryUrl: process.env.PLUGIN_REGISTRY_URL ?? 'http://localhost:3001',
  },
});

// Type-safe configuration getter
export function getConfig(): AppConfiguration {
  return appConfig();
}