import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { applyDecorators, UseInterceptors } from '@nestjs/common';

export interface CacheResponseOptions {
  ttl?: number; // Time to live in seconds
  key?: string; // Custom cache key
  keyGenerator?: (...args: unknown[]) => string; // Custom key generator function
}

/**
 * Decorator that enables response caching for controller endpoints
 * @param options - Caching configuration options
 */
export function CacheResponse(options: CacheResponseOptions = {}) {
  const decorators = [UseInterceptors(CacheInterceptor)];

  // Set custom TTL if provided
  if (options.ttl !== undefined) {
    decorators.push(CacheTTL(options.ttl));
  }

  // Set custom cache key if provided
  if (options.key != null) {
    decorators.push(CacheKey(options.key));
  }

  return applyDecorators(...decorators);
}
