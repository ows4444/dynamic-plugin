import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

export interface CacheResponseOptions {
  ttl?: number; // Time to live in seconds
  key?: string; // Custom cache key
  keyGenerator?: (...args: any[]) => string; // Custom key generator function
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
  if (options.key) {
    decorators.push(CacheKey(options.key));
  }

  return applyDecorators(...decorators);
}

/**
 * Quick cache decorators for common use cases
 */
export const CacheResponse5Minutes = () => CacheResponse({ ttl: 300 });
export const CacheResponse1Minute = () => CacheResponse({ ttl: 60 });
export const CacheResponse10Minutes = () => CacheResponse({ ttl: 600 });
export const CacheResponse1Hour = () => CacheResponse({ ttl: 3600 });