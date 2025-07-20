import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MemoryCacheProvider } from './providers/memory-cache.provider';
import { RedisCacheProvider } from './providers/redis-cache.provider';

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  getStats(): Promise<Record<string, any>>;
  clearByPrefix?(prefix: string): Promise<void>;
}

export interface CacheConfiguration {
  defaultTtl: number;
  enableL1Cache: boolean;
  enableL2Cache: boolean;
  maxMemorySize: number;
  evictionPolicy: 'LRU' | 'LFU' | 'FIFO';
  compressionEnabled: boolean;
  serializationFormat: 'json' | 'msgpack' | 'protobuf';
}

/**
 * Advanced cache manager with multi-tier caching strategy
 * Implements L1 (memory) and L2 (Redis) cache layers
 */
@Injectable()
export class CacheManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheManagerService.name);
  private currentProvider: CacheProvider;
  private readonly providers = new Map<string, CacheProvider>();
  private readonly defaultConfig: CacheConfiguration = {
    defaultTtl: 3600, // 1 hour
    enableL1Cache: true,
    enableL2Cache: false,
    maxMemorySize: 100 * 1024 * 1024, // 100MB
    evictionPolicy: 'LRU',
    compressionEnabled: false,
    serializationFormat: 'json',
  };

  private cacheHits = 0;
  private cacheMisses = 0;
  private totalOperations = 0;

  constructor(
    private readonly memoryCache: MemoryCacheProvider,
    private readonly redisCache: RedisCacheProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      // Register cache providers
      this.providers.set('memory', this.memoryCache);
      this.providers.set('redis', this.redisCache);

      // Initialize providers
      this.memoryCache.initialize();

      // Try to initialize Redis cache
      try {
        await this.redisCache.initialize();
        this.currentProvider = this.redisCache;
        this.logger.log('Using Redis cache as primary provider');
      } catch (error) {
        this.logger.warn('Redis cache not available, falling back to memory cache');
        this.currentProvider = this.memoryCache;
      }

      this.logger.log('Cache manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize cache manager:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await Promise.allSettled([this.memoryCache.cleanup(), this.redisCache.cleanup()]);
      this.logger.log('Cache manager cleaned up');
    } catch (error) {
      this.logger.error('Error during cache manager cleanup:', error);
    }
  }

  /**
   * Get value from multi-tier cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      this.totalOperations++;

      // L1 Cache (Memory) - fastest
      if (this.defaultConfig.enableL1Cache) {
        const memoryValue = await this.memoryCache.get<T>(key);
        if (memoryValue !== null) {
          this.cacheHits++;
          this.logger.debug(`Cache hit (L1) for key: ${key}`);
          return memoryValue;
        }
      }

      // L2 Cache (Redis) - slower but persistent
      if (this.defaultConfig.enableL2Cache && this.providers.has('redis')) {
        const redisValue = await this.redisCache.get<T>(key);
        if (redisValue !== null) {
          this.cacheHits++;
          this.logger.debug(`Cache hit (L2) for key: ${key}`);

          // Promote to L1 cache
          if (this.defaultConfig.enableL1Cache) {
            await this.memoryCache.set(key, redisValue, this.defaultConfig.defaultTtl);
          }

          return redisValue;
        }
      }

      this.cacheMisses++;
      this.logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      this.cacheMisses++;
      return null;
    }
  }

  /**
   * Set value in multi-tier cache
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const cacheTime = ttl ?? this.defaultConfig.defaultTtl;

      // Set in both layers if enabled
      const promises: Array<Promise<void>> = [];

      if (this.defaultConfig.enableL1Cache) {
        promises.push(this.memoryCache.set(key, value, cacheTime));
      }

      if (this.defaultConfig.enableL2Cache && this.providers.has('redis')) {
        promises.push(this.redisCache.set(key, value, cacheTime));
      }

      await Promise.allSettled(promises);
      this.logger.debug(`Cache set for key: ${key} with TTL: ${cacheTime}s`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete value from all cache layers
   */
  async del(key: string): Promise<void> {
    try {
      const promises: Array<Promise<void>> = [];

      if (this.defaultConfig.enableL1Cache) {
        promises.push(this.memoryCache.del(key));
      }

      if (this.defaultConfig.enableL2Cache && this.providers.has('redis')) {
        promises.push(this.redisCache.del(key));
      }

      await Promise.allSettled(promises);
      this.logger.debug(`Cache deleted for key: ${key}`);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if key exists in any cache layer
   */
  async has(key: string): Promise<boolean> {
    try {
      // Check L1 first
      if (this.defaultConfig.enableL1Cache && (await this.memoryCache.has(key))) {
        return true;
      }

      // Check L2
      if (this.defaultConfig.enableL2Cache && this.providers.has('redis')) {
        return await this.redisCache.has(key);
      }

      return false;
    } catch (error) {
      this.logger.error(`Cache exists check error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache layers
   */
  async clear(): Promise<void> {
    try {
      const promises: Array<Promise<void>> = [];

      if (this.defaultConfig.enableL1Cache) {
        promises.push(this.memoryCache.clear());
      }

      if (this.defaultConfig.enableL2Cache && this.providers.has('redis')) {
        promises.push(this.redisCache.clear());
      }

      await Promise.allSettled(promises);
      this.resetStatistics();
      this.logger.log('All cache layers cleared');
    } catch (error) {
      this.logger.error('Cache clear error:', error);
      throw error;
    }
  }

  /**
   * Get or set pattern with caching
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const value = await factory();
      await this.set(key, value, ttl);
      return value;
    } catch (error) {
      this.logger.error(`Cache getOrSet error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    const promises = keys.map(async (key) => {
      const value = await this.get<T>(key);
      results.set(key, value);
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Batch set multiple key-value pairs
   */
  async mset(entries: Array<{ key: string; value: unknown; ttl?: number }>): Promise<void> {
    const promises = entries.map(({ key, value, ttl }) => this.set(key, value, ttl));

    await Promise.allSettled(promises);
  }

  /**
   * Clear cache by pattern
   */
  async clearByPattern(pattern: string): Promise<void> {
    try {
      const promises: Array<Promise<void>> = [];

      if (this.defaultConfig.enableL1Cache && this.memoryCache.clearByPrefix) {
        promises.push(this.memoryCache.clearByPrefix(pattern));
      }

      if (this.defaultConfig.enableL2Cache && this.redisCache.clearByPrefix) {
        promises.push(this.redisCache.clearByPrefix(pattern));
      }

      await Promise.allSettled(promises);
      this.logger.debug(`Cache cleared by pattern: ${pattern}`);
    } catch (error) {
      this.logger.error(`Cache pattern clear error for pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  async getStatistics(): Promise<CacheStatistics> {
    try {
      const memoryStats = await this.memoryCache.getStats();
      const redisStats = this.providers.has('redis') ? await this.redisCache.getStats() : { connected: false, keys: 0, memoryUsage: 0 };

      const hitRate = this.totalOperations > 0 ? (this.cacheHits / this.totalOperations) * 100 : 0;

      return {
        hitRate: Number(hitRate.toFixed(2)),
        totalHits: this.cacheHits,
        totalMisses: this.cacheMisses,
        totalOperations: this.totalOperations,
        layers: {
          l1: {
            provider: 'memory',
            enabled: this.defaultConfig.enableL1Cache,
            ...memoryStats,
          },
          l2: {
            provider: 'redis',
            enabled: this.defaultConfig.enableL2Cache,
            ...redisStats,
            keys: 0,
            memoryUsage: 0,
          },
        },
        configuration: this.defaultConfig,
      };
    } catch (error) {
      this.logger.error('Failed to get cache statistics:', error);
      return {
        hitRate: 0,
        totalHits: this.cacheHits,
        totalMisses: this.cacheMisses,
        totalOperations: this.totalOperations,
        layers: {
          l1: { provider: 'memory', enabled: false, keys: 0, memoryUsage: 0 },
          l2: { provider: 'redis', enabled: false, keys: 0, memoryUsage: 0 },
        },
        configuration: this.defaultConfig,
      };
    }
  }

  /**
   * Update cache configuration
   */
  updateConfiguration(newConfig: Partial<CacheConfiguration>): void {
    Object.assign(this.defaultConfig, newConfig);
    this.logger.log('Cache configuration updated');
  }

  /**
   * Reset cache statistics
   */
  resetStatistics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.totalOperations = 0;
    this.logger.log('Cache statistics reset');
  }

  /**
   * Get cache health status
   */
  async getHealthStatus(): Promise<CacheHealthStatus> {
    try {
      const memoryHealth = this.memoryCache.checkHealth ? await this.memoryCache.checkHealth() : { healthy: true };

      const redisHealth = this.providers.has('redis') && this.redisCache.checkHealth ? await this.redisCache.checkHealth() : { healthy: false };

      return {
        overall: memoryHealth.healthy || redisHealth.healthy,
        l1Cache: memoryHealth,
        l2Cache: redisHealth,
        activeProvider: this.currentProvider === this.redisCache ? 'redis' : 'memory',
      };
    } catch (error) {
      this.logger.error('Failed to get cache health status:', error);
      return {
        overall: false,
        l1Cache: { healthy: false },
        l2Cache: { healthy: false },
        activeProvider: 'memory',
      };
    }
  }
}

export interface CacheStatistics {
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalOperations: number;
  layers: {
    l1: {
      provider: string;
      enabled: boolean;
      keys: number;
      memoryUsage: number;
    };
    l2: {
      provider: string;
      enabled: boolean;
      keys: number;
      memoryUsage: number;
    };
  };
  configuration: CacheConfiguration;
}

export interface CacheHealthStatus {
  overall: boolean;
  l1Cache: { healthy: boolean; latency?: number };
  l2Cache: { healthy: boolean; latency?: number };
  activeProvider: string;
}
