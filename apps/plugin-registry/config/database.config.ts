import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export interface DatabaseConfig extends TypeOrmModuleOptions {
  type: 'postgres' | 'mysql' | 'sqlite' | 'mongodb';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
  maxConnections: number;
  ssl?: boolean | {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
    [key: string]: unknown;
  };
  retryAttempts: number;
  retryDelay: number;
  autoLoadEntities: boolean;
  keepConnectionAlive: boolean;
  migrations?: string[];
  migrationsTableName?: string;
  entities?: string[];
}

export default registerAs('database', (): DatabaseConfig => {
  const type = (process.env.DB_TYPE as 'postgres' | 'mysql' | 'sqlite' | 'mongodb') ?? 'sqlite';

  const baseConfig = {
    type,
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS ?? '10', 10),
    retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS ?? '3', 10),
    retryDelay: parseInt(process.env.DB_RETRY_DELAY ?? '3000', 10),
    autoLoadEntities: true,
    keepConnectionAlive: true,
    entities: ['dist/**/*.entity{.ts,.js}'],
    migrations: ['dist/database/migrations/*{.ts,.js}'],
    migrationsTableName: 'plugin_migrations',
  };

  // SQLite configuration (default for development)
  if (type === 'sqlite') {
    return {
      ...baseConfig,
      database: process.env.DB_DATABASE ?? 'data/plugin-registry.db',
    };
  }

  // PostgreSQL configuration
  if (type === 'postgres') {
    return {
      ...baseConfig,
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'plugin_registry',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_DATABASE ?? 'plugin_registry',
      ssl:
        process.env.DB_SSL === 'true'
          ? {
              rejectUnauthorized:
                process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
              ca: process.env.DB_SSL_CA,
              cert: process.env.DB_SSL_CERT,
              key: process.env.DB_SSL_KEY,
            }
          : false,
    };
  }

  // MySQL configuration
  if (type === 'mysql') {
    return {
      ...baseConfig,
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '3306', 10),
      username: process.env.DB_USERNAME ?? 'plugin_registry',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_DATABASE ?? 'plugin_registry',
      charset: 'utf8mb4',
      timezone: 'Z',
    };
  }

  // MongoDB configuration
  if (type === 'mongodb') {
    const connectionString =
      process.env.DB_CONNECTION_STRING ??
      `mongodb://${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '27017'}/${process.env.DB_DATABASE ?? 'plugin_registry'}`;

    return {
      ...baseConfig,
      url: connectionString,
      database: process.env.DB_DATABASE ?? 'plugin_registry',
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };
  }

  return baseConfig;
});
