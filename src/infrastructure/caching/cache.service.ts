import { Injectable, Logger } from '@nestjs/common';
import { CacheManagerService } from './cache-manager.service';

/**
 * Unified cache service that provides both memory and distributed caching
 * Acts as a high-level interface to the cache manager
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly cacheManager: CacheManagerService) {}

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      return await this.cacheManager.get<T>(key);
    } catch (error) {
      this.logger.error(`Failed to get cache value for key: ${key}`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
    } catch (error) {
      this.logger.error(`Failed to set cache value for key: ${key}`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete cache value for key: ${key}`, error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await this.cacheManager.clear();
      this.logger.log('Cache cleared successfully');
    } catch (error) {
      this.logger.error('Failed to clear cache', error);
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    try {
      return await this.cacheManager.has(key);
    } catch (error) {
      this.logger.error(`Failed to check cache key existence: ${key}`, error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      return await this.cacheManager.getStatistics();
    } catch (error) {
      this.logger.error('Failed to get cache statistics', error);
      throw error;
    }
  }

  /**
   * Get or set pattern - useful for expensive operations
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    try {
      return await this.cacheManager.getOrSet(key, factory, ttl);
    } catch (error) {
      this.logger.error(`Failed to get or set cache value for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Set cache value with plugin-specific prefix
   */
  async setPluginCache(pluginId: string, key: string, value: unknown, ttl?: number): Promise<void> {
    const prefixedKey = this.getPluginCacheKey(pluginId, key);
    await this.set(prefixedKey, value, ttl);
  }

  /**
   * Get cache value with plugin-specific prefix
   */
  async getPluginCache<T>(pluginId: string, key: string): Promise<T | null> {
    const prefixedKey = this.getPluginCacheKey(pluginId, key);
    return await this.get<T>(prefixedKey);
  }

  /**
   * Clear all cache for a specific plugin
   */
  async clearPluginCache(pluginId: string): Promise<void> {
    try {
      const prefix = this.getPluginCachePrefix(pluginId);
      await this.cacheManager.clearByPattern(prefix);
      this.logger.log(`Cleared cache for plugin: ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to clear cache for plugin: ${pluginId}`, error);
    }
  }

  private getPluginCachePrefix(pluginId: string): string {
    return `plugin:${pluginId}:`;
  }

  private getPluginCacheKey(pluginId: string, key: string): string {
    return `${this.getPluginCachePrefix(pluginId)}${key}`;
  }
  /**
   * Get cache health status
   */
  async getHealthStatus() {
    try {
      return await this.cacheManager.getHealthStatus();
    } catch (error) {
      this.logger.error('Failed to get cache health status', error);
      throw error;
    }
  }

  /**
   * Batch operations
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    try {
      return await this.cacheManager.mget<T>(keys);
    } catch (error) {
      this.logger.error('Failed to perform batch get operation', error);
      throw error;
    }
  }

  async mset(entries: Array<{ key: string; value: unknown; ttl?: number }>): Promise<void> {
    try {
      await this.cacheManager.mset(entries);
    } catch (error) {
      this.logger.error('Failed to perform batch set operation', error);
      throw error;
    }
  }
}
