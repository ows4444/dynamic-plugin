import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { AppConfiguration } from './app.config';

export const createDatabaseConfig = (
  configService: ConfigService<AppConfiguration>,
): TypeOrmModuleOptions => {
  const dbConfig = configService.get('database', { infer: true });
  
  if (!dbConfig) {
    throw new Error('Database configuration is required');
  }

  return {
    type: dbConfig.type,
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: dbConfig.ssl,
    synchronize: dbConfig.synchronize,
    logging: dbConfig.logging,
    entities: [
      // Auto-discover entities from all modules
      ...(process.env['NODE_ENV'] === 'production' 
        ? ['dist/**/*.entity.js']
        : ['src/**/*.entity.ts']
      ),
    ],
    migrations: [
      ...(process.env['NODE_ENV'] === 'production'
        ? ['dist/migrations/*.js']
        : ['src/migrations/*.ts']
      ),
    ],
    subscribers: [
      ...(process.env['NODE_ENV'] === 'production'
        ? ['dist/subscribers/*.js']
        : ['src/subscribers/*.ts']
      ),
    ],
    // Connection pool settings
    extra: {
      max: 20, // Maximum connections in pool
      min: 5, // Minimum connections in pool
      acquire: 30000, // Maximum time to get connection
      idle: 10000, // Maximum time connection can be idle
    },
  };
};