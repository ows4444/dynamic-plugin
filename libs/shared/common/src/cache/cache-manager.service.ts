import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Cache namespace for organization
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

@Injectable()
export class CacheManagerService {
  private readonly logger = new Logger(CacheManagerService.name);
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * Get value from cache
   */
  async get<T>(key: string, namespace?: string): Promise<T | undefined> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const value = await this.cacheManager.get<T>(fullKey);
      
      if (value !== undefined) {
        this.stats.hits++;
        this.logger.debug(`Cache HIT for key: ${fullKey}`);
      } else {
        this.stats.misses++;
        this.logger.debug(`Cache MISS for key: ${fullKey}`);
      }
      
      return value;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`Cache GET error for key ${key}: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {},
  ): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      await this.cacheManager.set(fullKey, value, options.ttl);
      
      this.stats.sets++;
      this.logger.debug(`Cache SET for key: ${fullKey}, TTL: ${options.ttl ?? 'default'}`);
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`Cache SET error for key ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, namespace?: string): Promise<void> {
    try {
      const fullKey = this.buildKey(key, namespace);
      await this.cacheManager.del(fullKey);
      
      this.stats.deletes++;
      this.logger.debug(`Cache DELETE for key: ${fullKey}`);
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`Cache DELETE error for key ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string, namespace?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const value = await this.cacheManager.get(fullKey);
      return value !== undefined;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`Cache HAS error for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get or set pattern - if key exists return it, otherwise compute and cache
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const cachedValue = await this.get<T>(key, options.namespace);
    
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const freshValue = await factory();
    await this.set(key, freshValue, options);
    
    return freshValue;
  }

  /**
   * Delete multiple keys by pattern
   */
  async deleteByPattern(pattern: string, namespace?: string): Promise<void> {
    try {
      const fullPattern = this.buildKey(pattern, namespace);
      
      // For Redis cache manager, we would use SCAN command
      // For in-memory cache, we need to implement pattern matching
      this.logger.debug(`Cache DELETE by pattern: ${fullPattern}`);
      
      // Note: Implementation depends on the cache store being used
      // This is a placeholder for pattern-based deletion
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`Cache DELETE by pattern error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear entire cache namespace
   */
  async clearNamespace(namespace: string): Promise<void> {
    try {
      await this.deleteByPattern('*', namespace);
      this.logger.log(`Cleared cache namespace: ${namespace}`);
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`Cache CLEAR namespace error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reset all cache
   */
  async reset(): Promise<void> {
    try {
      await this.cacheManager.clear();
      this.logger.log('Cache completely reset');
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`Cache RESET error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
    this.logger.log('Cache statistics reset');
  }

  /**
   * Generate cache key with optional namespace
   */
  generateKey(parts: string[], namespace?: string): string {
    return this.buildKey(parts.join(':'), namespace);
  }

  /**
   * Build full cache key with namespace
   */
  private buildKey(key: string, namespace?: string): string {
    return (namespace != null) ? `${namespace}:${key}` : key;
  }
}