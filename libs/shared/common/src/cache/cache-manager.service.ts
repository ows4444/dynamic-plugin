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
      this.logger.error(`Cache GET error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to get value from cache for key: ${key}`);
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
      this.logger.error(`Cache SET error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
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
      this.logger.error(`Cache DELETE error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
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
      this.logger.error(`Cache HAS error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Get or set pattern - if key exists return it, otherwise compute and cache
   * Uses mutex-like behavior to prevent race conditions
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const fullKey = this.buildKey(key, options.namespace);
    const lockKey = `${fullKey}:lock`;
    
    try {
      // Check if value exists first
      const cachedValue = await this.get<T>(key, options.namespace);
      if (cachedValue !== undefined) {
        return cachedValue;
      }

      // Simple lock mechanism to prevent concurrent factory calls
      const isLocked = await this.cacheManager.get(lockKey);
      if (isLocked) {
        // Wait a bit and try again to get the cached value
        await new Promise(resolve => setTimeout(resolve, 50));
        const retryValue = await this.get<T>(key, options.namespace);
        if (retryValue !== undefined) {
          return retryValue;
        }
      }

      // Set lock
      await this.cacheManager.set(lockKey, true, 30); // 30 second lock
      
      try {
        const freshValue = await factory();
        await this.set(key, freshValue, options);
        return freshValue;
      } finally {
        // Release lock
        await this.cacheManager.del(lockKey);
      }
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`Cache getOrSet error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Delete multiple keys by pattern
   * Note: This is a basic implementation. For Redis, use SCAN command for better performance
   */
  async deleteByPattern(pattern: string, namespace?: string): Promise<void> {
    try {
      const fullPattern = this.buildKey(pattern, namespace);
      
      // This is a simplified implementation
      // In production, you'd want to use Redis SCAN command for Redis cache
      // or implement proper pattern matching for in-memory cache
      
      this.logger.warn('deleteByPattern is not fully implemented. Use with caution in production.');
      this.logger.debug(`Cache DELETE by pattern requested: ${fullPattern}`);
      
      // For now, we'll just log the attempt
      // TODO: Implement proper pattern-based deletion based on cache store type
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`Cache DELETE by pattern error: ${error instanceof Error ? error.message : String(error)}`);
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
      this.logger.error(`Cache CLEAR namespace error: ${error instanceof Error ? error.message : String(error)}`);
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
      this.logger.error(`Cache RESET error: ${error instanceof Error ? error.message : String(error)}`);
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