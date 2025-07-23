import type { CacheModuleOptions } from '@nestjs/cache-manager';
import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { redisStore } from 'cache-manager-redis-store';
import type { AppConfiguration } from './app.config';

export const createCacheConfig = async (
  configService: ConfigService<AppConfiguration>,
): Promise<CacheModuleOptions> => {
  const redisConfig = configService.get('redis', { infer: true });
  
  if (!redisConfig) {
    throw new Error('Redis configuration is required');
  }

  try {
    // Try to create Redis store
    const store = await redisStore({
      socket: {
        host: redisConfig.host,
        port: redisConfig.port,
      },
      password: redisConfig.password,
      database: redisConfig.database,
      keyPrefix: redisConfig.keyPrefix,
    });

    return {
      store,
      ttl: 300, // 5 minutes default TTL
      max: 1000, // Maximum number of items in cache
    };
  } catch (error) {
    const logger = new Logger('CacheConfig');
    logger.warn('Redis connection failed, falling back to in-memory cache:', error);
    
    // Fallback to in-memory cache if Redis is not available
    return {
      ttl: 300, // 5 minutes default TTL
      max: 100, // Smaller limit for in-memory cache
    };
  }
};