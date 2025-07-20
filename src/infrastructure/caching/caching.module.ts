import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheManagerService } from './cache-manager.service';
import { MemoryCacheProvider } from './providers/memory-cache.provider';
import { RedisCacheProvider } from './providers/redis-cache.provider';
import { ConfigService } from '../config/config.service';

/**
 * Global caching module providing multi-tier caching capabilities
 * Supports both memory-based and Redis-based caching strategies
 */
@Global()
@Module({
  providers: [
    CacheService,
    CacheManagerService,
    MemoryCacheProvider,
    RedisCacheProvider,
    {
      provide: 'CACHE_CONFIG',
      useFactory: (configService: ConfigService) => configService.getCacheConfig(),
      inject: [ConfigService],
    },
  ],
  exports: [CacheService, CacheManagerService],
})
export class CachingModule {}
