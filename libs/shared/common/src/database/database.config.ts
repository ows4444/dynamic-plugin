import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  poolSize: number;
  acquireTimeout: number;
  timeout: number;
  poolMax: number;
  poolMin: number;
  poolIdle: number;
  poolAcquire: number;
  poolEvict: number;
  synchronize: boolean;
  logging: boolean;
  dropSchema: boolean;
  migrationsRun: boolean;
  cacheDuration: number;
  retryAttempts: number;
  retryDelay: number;
  maxQueryExecutionTime: number;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'plugin_system',
  poolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
  acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT, 10) || 60000,
  timeout: parseInt(process.env.DB_TIMEOUT, 10) || 30000,
  poolMax: parseInt(process.env.DB_POOL_MAX, 10) || 20,
  poolMin: parseInt(process.env.DB_POOL_MIN, 10) || 5,
  poolIdle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
  poolAcquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
  poolEvict: parseInt(process.env.DB_POOL_EVICT, 10) || 1000,
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
  dropSchema: process.env.DB_DROP_SCHEMA === 'true',
  migrationsRun: process.env.DB_MIGRATIONS_RUN !== 'false',
  cacheDuration: parseInt(process.env.DB_CACHE_DURATION, 10) || 30000,
  retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS, 10) || 3,
  retryDelay: parseInt(process.env.DB_RETRY_DELAY, 10) || 3000,
  maxQueryExecutionTime: parseInt(process.env.DB_MAX_QUERY_TIME, 10) || 10000,
}));

export const databaseConfigSchema = Joi.object({
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_POOL_SIZE: Joi.number().min(1).max(50).default(10),
  DB_ACQUIRE_TIMEOUT: Joi.number().min(1000).default(60000),
  DB_TIMEOUT: Joi.number().min(1000).default(30000),
  DB_POOL_MAX: Joi.number().min(1).max(100).default(20),
  DB_POOL_MIN: Joi.number().min(1).default(5),
  DB_POOL_IDLE: Joi.number().min(1000).default(10000),
  DB_POOL_ACQUIRE: Joi.number().min(1000).default(30000),
  DB_POOL_EVICT: Joi.number().min(100).default(1000),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
  DB_DROP_SCHEMA: Joi.boolean().default(false),
  DB_MIGRATIONS_RUN: Joi.boolean().default(true),
  DB_CACHE_DURATION: Joi.number().min(1000).default(30000),
  DB_RETRY_ATTEMPTS: Joi.number().min(0).max(10).default(3),
  DB_RETRY_DELAY: Joi.number().min(100).default(3000),
  DB_MAX_QUERY_TIME: Joi.number().min(1000).default(10000),
});