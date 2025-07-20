import { Injectable, Logger } from '@nestjs/common';

/**
 * In-memory cache provider with TTL support
 */
@Injectable()
export class MemoryCacheProvider {
  private readonly logger = new Logger(MemoryCacheProvider.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  constructor() {
    // Clean expired entries every 60 seconds
    setInterval(() => this.cleanupInternal(), 60000);
  }

  /**
   * Initialize the memory cache provider
   */
  initialize(): void {
    this.logger.log('Memory cache provider initialized');
  }

  /**
   * Check health of memory cache
   */
  checkHealth(): { healthy: boolean; latency?: number } {
    return { healthy: true, latency: 0 };
  }

  /**
   * Get value from memory cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set value in memory cache
   */
  set(key: string, value: unknown, ttl?: number): void {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });

    this.stats.sets++;
  }

  /**
   * Delete value from memory cache
   */
  del(key: string): void {
    if (this.cache.delete(key)) {
      this.stats.deletes++;
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.resetStats();
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): MemoryCacheStats {
    return {
      keys: this.cache.size,
      memoryUsage: this.calculateMemoryUsage(),
      hits: this.stats.hits,
      misses: this.stats.misses,
    };
  }

  /**
   * Clear cache entries by prefix
   */
  clearByPrefix(prefix: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.stats.deletes++;
    }
  }

  /**
   * Public cleanup method for external use
   */
  cleanup(): void {
    this.cleanupInternal();
  }

  /**
   * Clean up expired entries
   */
  private cleanupInternal(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry, now)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.logger.debug(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry, now?: number): boolean {
    if (!entry.expiresAt) {
      return false;
    }

    return (now ?? Date.now()) > entry.expiresAt;
  }

  /**
   * Calculate approximate memory usage
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Rough estimation of memory usage
      totalSize += key.length * 2; // Unicode characters are 2 bytes
      totalSize += this.getValueSize(entry.value);
      totalSize += 24; // Overhead for entry object
    }

    return totalSize;
  }

  /**
   * Estimate value size in bytes
   */
  private getValueSize(value: unknown): number {
    if (value === null || value === undefined) {
      return 8;
    }

    if (typeof value === 'string') {
      return value.length * 2;
    }

    if (typeof value === 'number') {
      return 8;
    }

    if (typeof value === 'boolean') {
      return 4;
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 100; // Fallback estimate
      }
    }

    return 100; // Default estimate
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.sets = 0;
    this.stats.deletes = 0;
  }
}

interface CacheEntry {
  value: unknown;
  expiresAt?: number;
  createdAt: number;
}

export interface MemoryCacheStats {
  keys: number;
  memoryUsage: number;
  hits: number;
  misses: number;
}
