import { getErrorMessage } from '@lib/shared/common';
import { Injectable, Logger } from '@nestjs/common';
import { CacheEntry, CacheOptions } from './storage.interface';

@Injectable()
export class PluginCacheService {
  private readonly logger = new Logger(PluginCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly defaultTTL = 30 * 60 * 1000; // 30 minutes
  private readonly maxCacheSize = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupCleanupInterval();
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.logger.debug(`Cache entry expired and removed: ${key}`);
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = new Date();

    this.logger.debug(`Cache hit: ${key}`);
    return Promise.resolve(entry.value as T) ;
  }

  async set<T = unknown>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<void> {
    const ttl = options?.ttl ?? this.defaultTTL;
    const expiresAt = new Date(Date.now() + ttl);

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: new Date(),
      expiresAt,
      accessCount: 0,
      lastAccessed: new Date(),
    };

    if (this.cache.size >= this.maxCacheSize) {
      await this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, entry);
    this.logger.debug(
      `Cache entry set: ${key} (expires: ${expiresAt.toISOString()})`,
    );
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug(`Cache entry deleted: ${key}`);
    }
    return Promise.resolve(deleted);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return Promise.resolve(true);
  }

  async clear(pattern?: string): Promise<number> {
    let deletedCount = 0;

    if (pattern == null) {
      deletedCount = this.cache.size;
      this.cache.clear();
      this.logger.log(`Cleared entire cache (${deletedCount} entries)`);
      return deletedCount;
    }

    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      deletedCount++;
    }

    this.logger.log(
      `Cleared ${deletedCount} cache entries matching pattern: ${pattern}`,
    );
    return Promise.resolve(deletedCount);
  }

  async getStats(): Promise<{
    size: number;
    hitRate: number;
    averageAccessCount: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
    expiringEntries: number;
  }> {
    const entries = Array.from(this.cache.values());
    const totalAccess = entries.reduce(
      (sum, entry) => sum + entry.accessCount,
      0,
    );
    const now = new Date();
    const expiringEntries = entries.filter(
      (entry) =>
        (entry.expiresAt &&
        entry.expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) ?? false,
    ).length;

    const creationTimes = entries.map((entry) => entry.createdAt);
    const oldestEntry =
      creationTimes.length > 0
        ? new Date(Math.min(...creationTimes.map((d) => d.getTime())))
        : null;
    const newestEntry =
      creationTimes.length > 0
        ? new Date(Math.max(...creationTimes.map((d) => d.getTime())))
        : null;

    return Promise.resolve({
      size: this.cache.size,
      hitRate: this.cache.size > 0 ? totalAccess / this.cache.size : 0,
      averageAccessCount:
        this.cache.size > 0 ? totalAccess / this.cache.size : 0,
      oldestEntry,
      newestEntry,
      expiringEntries,
    });
  }

  async getMemoryUsage(): Promise<number> {
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      totalSize += this.estimateEntrySize(entry);
    }

    return Promise.resolve(totalSize);
  }

  async cleanupExpired(): Promise<number> {
    let cleanedCount = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      cleanedCount++;
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }

    return Promise.resolve(cleanedCount);
  }

  async getEntryInfo(key: string): Promise<{
    exists: boolean;
    createdAt?: Date;
    expiresAt?: Date;
    accessCount?: number;
    lastAccessed?: Date;
    size?: number;
  }> {
    const entry = this.cache.get(key);

    if (!entry || this.isExpired(entry)) {
      return { exists: false };
    }

    return Promise.resolve({
      exists: true,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed,
      size: this.estimateEntrySize(entry),
    });
  }

  onApplicationShutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.logger.log('Cache service shutdown complete');
  }

  private isExpired(entry: CacheEntry): boolean {
    if (!entry.expiresAt) {
      return false;
    }
    return new Date() > entry.expiresAt;
  }

  private async evictLeastRecentlyUsed(): Promise<void> {
    let lruKey: string | null = null;
    let oldestAccess = new Date();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey != null) {
      this.cache.delete(lruKey);
      this.logger.debug(`Evicted LRU cache entry: ${lruKey}`);
    }
    await Promise.resolve()
  }

  private estimateEntrySize(entry: CacheEntry): number {
    try {
      const serialized = JSON.stringify(entry);
      return serialized.length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1000; // Default estimate if serialization fails
    }
  }

  private setupCleanupInterval(): void {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpired().catch((error) => {
          this.logger.error(`Cache cleanup failed: ${getErrorMessage(error)}`);
        });
      },
      5 * 60 * 1000,
    ); // Run cleanup every 5 minutes
  }
}
