import { Logger } from '@nestjs/common';
import { performance } from 'perf_hooks';


export interface PerformanceMonitoringOptions {

  metricName?: string;

  tags?: Record<string, string>;

  logSlowOperations?: boolean;

  slowThreshold?: number;

  includeArgs?: boolean;

  includeResult?: boolean;
}
class PerformanceMonitoringRegistry {
  private static instance: PerformanceMonitoringRegistry | null = null;
  private readonly metrics = new Map<string, Array<{ timestamp: number; duration: number; tags?: Record<string, string> }>>();
  private readonly logger = new Logger('PerformanceMonitoring');

  static getInstance(): PerformanceMonitoringRegistry {
    PerformanceMonitoringRegistry.instance ??= new PerformanceMonitoringRegistry();
    return PerformanceMonitoringRegistry.instance;
  }

  recordMetric(name: string, duration: number, tags?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const measurements = this.metrics.get(name)!;
    measurements.push({
      timestamp: performance.now(),
      duration,
      tags,
    });

    // Keep only last 1000 measurements per metric to prevent memory leaks
    if (measurements.length > 1000) {
      measurements.splice(0, measurements.length - 1000);
    }
  }

  getMetrics(): Record<string, Array<{ timestamp: number; duration: number; tags?: Record<string, string> }>> {
    const result: Record<string, Array<{ timestamp: number; duration: number; tags?: Record<string, string> }>> = {};
    for (const [name, measurements] of this.metrics.entries()) {
      result[name] = [...measurements];
    }
    return result;
  }

  getMetricStatistics(name: string): { count: number; average: number; min: number; max: number } | null {
    const measurements = this.metrics.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const durations = measurements.map(m => m.duration);
    return {
      count: durations.length,
      average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
    };
  }

  logSlowOperation(metricName: string, duration: number, threshold: number, context?: string): void {
    if (duration > threshold) {
      this.logger.warn(`Slow operation detected: ${metricName} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)${(context != null) ? ` - ${context}` : ''}`);
    }
  }
}

export function MonitorPerformance(options: PerformanceMonitoringOptions = {}) {
  return function (target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const className = (target as { constructor: { name: string } }).constructor.name;
    const methodName = String(propertyKey);
    
    const {
      metricName = `${className}.${methodName}`,
      tags = {},
      logSlowOperations = true,
      slowThreshold = 1000,
      includeArgs = false,
      includeResult = false,
    } = options;

    const registry = PerformanceMonitoringRegistry.getInstance();
    const logger = new Logger(`${className}.${methodName}`);

    descriptor.value = function (this: unknown, ...args: unknown[]): unknown {
      const startTime = performance.now();
      const contextTags = { 
        ...tags, 
        className, 
        methodName,
      };

      try {
        const result = originalMethod.apply(this, args);

        // Handle both sync and async methods
        if ((Boolean(result)) && typeof result === 'object' && 'then' in result && typeof result.then === 'function') {
          // Async method
          return (result as Promise<unknown>)
            .then((resolvedResult) => {
              const duration = performance.now() - startTime;
              registry.recordMetric(metricName, duration, contextTags);

              if (logSlowOperations) {
                registry.logSlowOperation(metricName, duration, slowThreshold, 
                  `Arguments: ${includeArgs ? JSON.stringify(args) : '[hidden]'}`);
              }

              if (includeResult) {
                logger.debug(`Method completed in ${duration.toFixed(2)}ms with result:`, resolvedResult);
              } else {
                logger.debug(`Method completed in ${duration.toFixed(2)}ms`);
              }

              return resolvedResult;
            })
            .catch((error) => {
              const duration = performance.now() - startTime;
              const errorTags = { ...contextTags, error: 'true', errorType: (Boolean((error?.constructor?.name))) || 'Unknown' };
              registry.recordMetric(metricName, duration, errorTags);

              if (logSlowOperations) {
                registry.logSlowOperation(metricName, duration, slowThreshold, 
                  `Failed with error: ${(Boolean((error?.message))) || 'Unknown error'}`);
              }

              logger.error(`Method failed after ${duration.toFixed(2)}ms:`, error);
              throw error;
            });
        } else {
          // Sync method
          const duration = performance.now() - startTime;
          registry.recordMetric(metricName, duration, contextTags);

          if (logSlowOperations) {
            registry.logSlowOperation(metricName, duration, slowThreshold,
              `Arguments: ${includeArgs ? JSON.stringify(args) : '[hidden]'}`);
          }

          if (includeResult) {
            logger.debug(`Method completed in ${duration.toFixed(2)}ms with result:`, result);
          } else {
            logger.debug(`Method completed in ${duration.toFixed(2)}ms`);
          }

          return result;
        }
      } catch (error) {
        const duration = performance.now() - startTime;
        const errorTags = { ...contextTags, error: 'true', errorType: (error as Error)?.constructor?.name || 'Unknown' };
        registry.recordMetric(metricName, duration, errorTags);

        if (logSlowOperations) {
          registry.logSlowOperation(metricName, duration, slowThreshold, 
            `Failed with error: ${(error as Error)?.message ?? 'Unknown error'}`);
        }

        logger.error(`Method failed after ${duration.toFixed(2)}ms:`, error);
        throw error;
      }
    };

    return descriptor;
  };
}

export function MonitorClassPerformance(options: PerformanceMonitoringOptions = {}) {
  return function <T extends { new (...args: unknown[]): unknown }>(constructor: T): T {
    const className = constructor.name;

    // Get all method names from prototype
    const prototype = constructor.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype)
      .filter((name): boolean => {
        // Exclude constructor and private methods (conventionally starting with _)
        if (name === 'constructor' || name.startsWith('_')) {
          return false;
        }

        const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
        return descriptor && typeof descriptor.value === 'function';
      });

    // Apply performance monitoring to each public method
    methodNames.forEach(methodName => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      if (descriptor) {
        const methodOptions = {
          ...options,
          metricName: options.metricName ?? `${className}.${methodName}`,
          tags: { ...options.tags, className, methodName },
        };

        MonitorPerformance(methodOptions)(prototype, methodName, descriptor);
        Object.defineProperty(prototype, methodName, descriptor);
      }
    });

    return constructor;
  };
}

export function getPerformanceMetrics(): Record<string, Array<{ timestamp: number; duration: number; tags?: Record<string, string> }>> {
  return PerformanceMonitoringRegistry.getInstance().getMetrics();
}

export function getPerformanceStatistics(metricName: string): { count: number; average: number; min: number; max: number } | null {
  return PerformanceMonitoringRegistry.getInstance().getMetricStatistics(metricName);
}

export function withPerformanceMonitoring<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: PerformanceMonitoringOptions = {}
): T {
  const {
    metricName = fn.name || 'anonymous.function',
    tags = {},
    logSlowOperations = true,
    slowThreshold = 1000,
  } = options;

  const registry = PerformanceMonitoringRegistry.getInstance();
  const logger = new Logger('PerformanceMonitoring');

  return ((...args: Parameters<T>): ReturnType<T> => {
    const startTime = performance.now();

    try {
      const result = fn(...args);

      // Handle both sync and async functions
      if ((Boolean(result)) && typeof result === 'object' && 'then' in result && typeof result.then === 'function') {
        // Async function
        return (result as Promise<unknown>)
          .then((resolvedResult) => {
            const duration = performance.now() - startTime;
            registry.recordMetric(metricName, duration, tags);

            if (logSlowOperations) {
              registry.logSlowOperation(metricName, duration, slowThreshold);
            }

            return resolvedResult;
          })
          .catch((error) => {
            const duration = performance.now() - startTime;
            const errorTags = { ...tags, error: 'true' };
            registry.recordMetric(metricName, duration, errorTags);

            if (logSlowOperations) {
              registry.logSlowOperation(metricName, duration, slowThreshold, `Error: ${error?.message}`);
            }

            throw error;
          }) as ReturnType<T>;
      } else {
        // Sync function
        const duration = performance.now() - startTime;
        registry.recordMetric(metricName, duration, tags);

        if (logSlowOperations) {
          registry.logSlowOperation(metricName, duration, slowThreshold);
        }

        return result as ReturnType<T>;
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorTags = { ...tags, error: 'true' };
      registry.recordMetric(metricName, duration, errorTags);

      if (logSlowOperations) {
        registry.logSlowOperation(metricName, duration, slowThreshold, `Error: ${(error as Error)?.message}`);
      }

      throw error;
    }
  }) as T;
}