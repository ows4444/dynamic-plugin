import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  apiPrefix: string;
  corsEnabled: boolean;
  corsOrigins: string[];
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: string;
    format: string;
    enableConsole: boolean;
    enableFile: boolean;
    logDirectory: string;
  };
  security: {
    enableHelmet: boolean;
    enableCsrf: boolean;
    trustProxy: boolean;
    maxRequestSize: string;
  };
  health: {
    endpoint: string;
    timeout: number;
    enableDisk: boolean;
    enableMemory: boolean;
  };
}

export default registerAs(
  'app',
  (): AppConfig => ({
    port: parseInt(process.env.PORT ?? '3001', 10),
    host: process.env.HOST ?? '0.0.0.0',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsEnabled: process.env.CORS_ENABLED === 'true',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') ?? [
      'http://localhost:3000',
    ],

    rateLimiting: {
      enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
      windowMs: parseInt(process.env.RATE_LIMITING_WINDOW_MS ?? '900000', 10), // 15 minutes
      maxRequests: parseInt(
        process.env.RATE_LIMITING_MAX_REQUESTS ?? '1000',
        10,
      ),
    },

    logging: {
      level: process.env.LOG_LEVEL ?? 'info',
      format: process.env.LOG_FORMAT ?? 'json',
      enableConsole: process.env.LOG_CONSOLE !== 'false',
      enableFile: process.env.LOG_FILE === 'true',
      logDirectory: process.env.LOG_DIRECTORY ?? './logs',
    },

    security: {
      enableHelmet: process.env.SECURITY_HELMET !== 'false',
      enableCsrf: process.env.SECURITY_CSRF === 'true',
      trustProxy: process.env.TRUST_PROXY === 'true',
      maxRequestSize: process.env.MAX_REQUEST_SIZE ?? '10mb',
    },

    health: {
      endpoint: process.env.HEALTH_ENDPOINT ?? '/health',
      timeout: parseInt(process.env.HEALTH_TIMEOUT ?? '30000', 10),
      enableDisk: process.env.HEALTH_DISK !== 'false',
      enableMemory: process.env.HEALTH_MEMORY !== 'false',
    },
  }),
);
