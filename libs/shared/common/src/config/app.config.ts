import type { ConfigFactory } from '@nestjs/config';

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

function parseIntSafely(value: string | undefined, defaultValue: number, paramName: string): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid configuration: ${paramName} must be a valid number, received: ${value}`);
  }
  return parsed;
}

function validateEnvironment(env: string | undefined): AppConfiguration['environment'] {
  const validEnvs: readonly string[] = ['development', 'staging', 'production', 'test'];
  if (!env || !validEnvs.includes(env)) {
    return 'development';
  }
  return env as AppConfiguration['environment'];
}

function validateLogLevel(level: string | undefined): AppConfiguration['logLevel'] {
  const validLevels: readonly string[] = ['error', 'warn', 'info', 'debug', 'verbose'];
  if (!level || !validLevels.includes(level)) {
    return 'info';
  }
  return level as AppConfiguration['logLevel'];
}

export const appConfig: ConfigFactory<AppConfiguration> = () => {
  // Validate critical environment variables
  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret || jwtSecret === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET environment variable must be set to a secure value in production');
  }
  
  const dbPassword = process.env['DB_PASSWORD'];
  if (process.env['NODE_ENV'] === 'production' && (!dbPassword || dbPassword === 'password')) {
    throw new Error('DB_PASSWORD must be set to a secure value in production');
  }

  return {
  port: parseIntSafely(process.env['PORT'], 3000, 'PORT'),
  environment: validateEnvironment(process.env['NODE_ENV']),
  logLevel: validateLogLevel(process.env['LOG_LEVEL']),
  
  database: {
    type: (() => {
      const dbType = process.env['DB_TYPE'];
      const validTypes: DatabaseConfig['type'][] = ['postgres', 'mysql', 'sqlite'];
      return dbType && validTypes.includes(dbType as DatabaseConfig['type']) 
        ? dbType as DatabaseConfig['type'] 
        : 'postgres';
    })(),
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseIntSafely(process.env['DB_PORT'], 5432, 'DB_PORT'),
    username: process.env['DB_USERNAME'] ?? 'postgres',
    password: process.env['DB_PASSWORD'] ?? (process.env['NODE_ENV'] === 'production' ? '' : 'password'),
    database: process.env['DB_DATABASE'] ?? 'plugin_system',
    ssl: process.env['DB_SSL'] === 'true',
    synchronize: process.env['DB_SYNCHRONIZE'] === 'true',
    logging: process.env['DB_LOGGING'] === 'true',
  },
  
  redis: {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseIntSafely(process.env['REDIS_PORT'], 6379, 'REDIS_PORT'),
    ...((process.env['REDIS_PASSWORD'] != null) && { password: process.env['REDIS_PASSWORD'] }),
    database: parseIntSafely(process.env['REDIS_DATABASE'], 0, 'REDIS_DATABASE'),
    keyPrefix: process.env['REDIS_KEY_PREFIX'] ?? 'plugin:',
  },
  
  security: {
    jwtSecret: process.env['JWT_SECRET'] ?? (() => {
      throw new Error('JWT_SECRET must be provided');
    })(),
    jwtExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '1h',
    bcryptRounds: parseIntSafely(process.env['BCRYPT_ROUNDS'], 12, 'BCRYPT_ROUNDS'),
    corsOrigins: process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    rateLimitWindow: parseIntSafely(process.env['RATE_LIMIT_WINDOW'], 900000, 'RATE_LIMIT_WINDOW'), // 15 minutes
    rateLimitMax: parseIntSafely(process.env['RATE_LIMIT_MAX'], 100, 'RATE_LIMIT_MAX'),
  },
  
  plugin: {
    storagePath: process.env['PLUGIN_STORAGE_PATH'] ?? './plugins',
    maxFileSize: parseIntSafely(process.env['PLUGIN_MAX_FILE_SIZE'], 10485760, 'PLUGIN_MAX_FILE_SIZE'), // 10MB
    allowedTypes: process.env['PLUGIN_ALLOWED_TYPES']?.split(',') ?? ['.zip', '.tar.gz', '.tgz'],
    defaultTimeout: parseIntSafely(process.env['PLUGIN_DEFAULT_TIMEOUT'], 30000, 'PLUGIN_DEFAULT_TIMEOUT'), // 30 seconds
    maxInstances: parseIntSafely(process.env['PLUGIN_MAX_INSTANCES'], 10, 'PLUGIN_MAX_INSTANCES'),
    registryUrl: process.env['PLUGIN_REGISTRY_URL'] ?? 'http://localhost:3001',
  },
};
}

// Type-safe configuration getter
export function getConfig(): AppConfiguration {
  return appConfig() as AppConfiguration;
}