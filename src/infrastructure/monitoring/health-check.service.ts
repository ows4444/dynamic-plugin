import { Injectable, Logger } from '@nestjs/common';

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  message?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface OverallHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
  lastChecked: Date;
}

export type HealthCheckFunction = () => Promise<{
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  metadata?: Record<string, any>;
}>;

/**
 * Health check service for monitoring system and component health
 * Provides comprehensive health monitoring with configurable checks
 */
@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private readonly healthChecks = new Map<string, HealthCheckFunction>();
  private readonly healthHistory = new Map<string, HealthCheckResult[]>();
  private isInitialized = false;
  private lastOverallStatus: OverallHealthStatus | null = null;

  /**
   * Initialize health check service
   */
  initialize(): void {
    try {
      // Register built-in health checks
      this.registerBuiltInHealthChecks();

      this.isInitialized = true;
      this.logger.log('Health check service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize health check service:', error);
      throw error;
    }
  }

  /**
   * Register built-in health checks
   */
  private registerBuiltInHealthChecks(): void {
    // System memory health check
    this.registerHealthCheck('system.memory', () => {
      const memoryUsage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const freeMemory = require('os').freemem();
      const usedMemoryPercent = ((totalMemory - freeMemory) / totalMemory) * 100;

      if (usedMemoryPercent > 90) {
        return {
          status: 'unhealthy',
          message: `High memory usage: ${usedMemoryPercent.toFixed(2)}%`,
          metadata: { usedMemoryPercent, totalMemory, freeMemory },
        };
      } else if (usedMemoryPercent > 75) {
        return {
          status: 'degraded',
          message: `Elevated memory usage: ${usedMemoryPercent.toFixed(2)}%`,
          metadata: { usedMemoryPercent, totalMemory, freeMemory },
        };
      }

      return {
        status: 'healthy',
        message: `Memory usage normal: ${usedMemoryPercent.toFixed(2)}%`,
        metadata: { usedMemoryPercent, totalMemory, freeMemory },
      };
    });

    // System CPU health check
    this.registerHealthCheck('system.cpu', async () => {
      const cpuUsage = await this.getCpuUsage();

      if (cpuUsage > 90) {
        return {
          status: 'unhealthy',
          message: `High CPU usage: ${cpuUsage.toFixed(2)}%`,
          metadata: { cpuUsage },
        };
      } else if (cpuUsage > 75) {
        return {
          status: 'degraded',
          message: `Elevated CPU usage: ${cpuUsage.toFixed(2)}%`,
          metadata: { cpuUsage },
        };
      }

      return {
        status: 'healthy',
        message: `CPU usage normal: ${cpuUsage.toFixed(2)}%`,
        metadata: { cpuUsage },
      };
    });

    // Application uptime health check
    this.registerHealthCheck('system.uptime', () => {
      const uptime = process.uptime();
      const uptimeHours = uptime / 3600;

      return {
        status: 'healthy',
        message: `Application running for ${uptimeHours.toFixed(2)} hours`,
        metadata: { uptime, uptimeHours },
      };
    });

    // Node.js event loop lag check
    this.registerHealthCheck('system.event_loop', async () => {
      const lag = await this.getEventLoopLag();

      if (lag > 100) {
        return {
          status: 'unhealthy',
          message: `High event loop lag: ${lag}ms`,
          metadata: { lag },
        };
      } else if (lag > 50) {
        return {
          status: 'degraded',
          message: `Elevated event loop lag: ${lag}ms`,
          metadata: { lag },
        };
      }

      return {
        status: 'healthy',
        message: `Event loop lag normal: ${lag}ms`,
        metadata: { lag },
      };
    });
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(name: string, checkFunction: HealthCheckFunction): void {
    this.healthChecks.set(name, checkFunction);

    // Initialize history for this check
    if (!this.healthHistory.has(name)) {
      this.healthHistory.set(name, []);
    }

    this.logger.debug(`Registered health check: ${name}`);
  }

  /**
   * Unregister a health check
   */
  unregisterHealthCheck(name: string): boolean {
    const removed = this.healthChecks.delete(name);

    if (removed) {
      this.healthHistory.delete(name);
      this.logger.debug(`Unregistered health check: ${name}`);
    }

    return removed;
  }

  /**
   * Perform a single health check
   */
  async performHealthCheck(name: string): Promise<HealthCheckResult> {
    const checkFunction = this.healthChecks.get(name);
    if (!checkFunction) {
      throw new Error(`Health check '${name}' not found`);
    }

    const startTime = Date.now();

    try {
      const result = await checkFunction();
      const responseTime = Date.now() - startTime;

      const healthResult: HealthCheckResult = {
        name,
        status: result.status,
        responseTime,
        message: result.message,
        metadata: result.metadata,
        timestamp: new Date(),
      };

      // Store in history
      this.storeHealthResult(name, healthResult);

      return healthResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseTime = Date.now() - startTime;

      const healthResult: HealthCheckResult = {
        name,
        status: 'unhealthy',
        responseTime,
        message: `Health check failed: ${errorMessage}`,
        metadata: { error: errorMessage },
        timestamp: new Date(),
      };

      // Store in history
      this.storeHealthResult(name, healthResult);

      this.logger.error(`Health check '${name}' failed:`, error);
      return healthResult;
    }
  }

  /**
   * Perform all registered health checks
   */
  async performAllHealthChecks(): Promise<OverallHealthStatus> {
    if (!this.isInitialized) {
      throw new Error('Health check service not initialized');
    }

    try {
      const checkPromises = Array.from(this.healthChecks.keys()).map((name) => this.performHealthCheck(name));

      const results = await Promise.allSettled(checkPromises);
      const checks: HealthCheckResult[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          checks.push(result.value);
        } else {
          const checkName = Array.from(this.healthChecks.keys())[index];
          checks.push({
            name: checkName,
            status: 'unhealthy',
            responseTime: 0,
            message: `Health check execution failed: ${result.reason}`,
            timestamp: new Date(),
          });
        }
      });

      // Calculate overall status
      const summary = this.calculateSummary(checks);
      const overallStatus = this.determineOverallStatus(summary);

      const healthStatus: OverallHealthStatus = {
        status: overallStatus,
        checks,
        summary,
        lastChecked: new Date(),
      };

      this.lastOverallStatus = healthStatus;
      return healthStatus;
    } catch (error) {
      this.logger.error('Failed to perform health checks:', error);
      throw error;
    }
  }

  /**
   * Get the last overall health status
   */
  getLastOverallHealthStatus(): OverallHealthStatus | null {
    return this.lastOverallStatus;
  }

  /**
   * Get overall health status (performs checks if needed)
   */
  async getOverallHealthStatus(): Promise<OverallHealthStatus> {
    if (!this.lastOverallStatus || this.isStale(this.lastOverallStatus.lastChecked)) {
      return await this.performAllHealthChecks();
    }

    return this.lastOverallStatus;
  }

  /**
   * Get health history for a specific check
   */
  getHealthHistory(name: string, limit = 50): HealthCheckResult[] {
    const history = this.healthHistory.get(name) ?? [];
    return history.slice(-limit);
  }

  /**
   * Get health trends for dashboard
   */
  getHealthTrends(): Record<string, { current: string; trend: 'improving' | 'stable' | 'degrading' }> {
    const trends: Record<string, { current: string; trend: 'improving' | 'stable' | 'degrading' }> = {};

    for (const [name, history] of this.healthHistory.entries()) {
      if (history.length < 2) {
        continue;
      }

      const recent = history.slice(-5); // Last 5 checks
      const current = recent[recent.length - 1];

      // Simple trend analysis
      const statusScores = recent.map((result) => this.getStatusScore(result.status));
      const avgScore = statusScores.reduce((a, b) => a + b, 0) / statusScores.length;
      const currentScore = this.getStatusScore(current.status);

      let trend: 'improving' | 'stable' | 'degrading';
      if (currentScore > avgScore) {
        trend = 'improving';
      } else if (currentScore < avgScore) {
        trend = 'degrading';
      } else {
        trend = 'stable';
      }

      trends[name] = {
        current: current.status,
        trend,
      };
    }

    return trends;
  }

  /**
   * Store health check result in history
   */
  private storeHealthResult(name: string, result: HealthCheckResult): void {
    if (!this.healthHistory.has(name)) {
      this.healthHistory.set(name, []);
    }

    const history = this.healthHistory.get(name)!;
    history.push(result);

    // Keep only last 100 results per check
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(checks: HealthCheckResult[]): OverallHealthStatus['summary'] {
    return {
      total: checks.length,
      healthy: checks.filter((c) => c.status === 'healthy').length,
      unhealthy: checks.filter((c) => c.status === 'unhealthy').length,
      degraded: checks.filter((c) => c.status === 'degraded').length,
    };
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(summary: OverallHealthStatus['summary']): 'healthy' | 'unhealthy' | 'degraded' {
    if (summary.unhealthy > 0) {
      return 'unhealthy';
    } else if (summary.degraded > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Get numeric score for status (for trend analysis)
   */
  private getStatusScore(status: string): number {
    switch (status) {
      case 'healthy':
        return 3;
      case 'degraded':
        return 2;
      case 'unhealthy':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Check if health status is stale
   */
  private isStale(lastChecked: Date): boolean {
    const staleThreshold = 60000; // 1 minute
    return Date.now() - lastChecked.getTime() > staleThreshold;
  }

  /**
   * Get CPU usage percentage
   */
  private getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        const totalTime = (endTime - startTime) * 1000; // Convert to microseconds

        const cpuPercent = ((endUsage.user + endUsage.system) / totalTime) * 100;
        resolve(Math.min(cpuPercent, 100)); // Cap at 100%
      }, 100);
    });
  }

  /**
   * Get event loop lag
   */
  private getEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        resolve(lag);
      });
    });
  }

  /**
   * Check if health check service is healthy
   */
  isHealthy(): boolean {
    return this.isInitialized;
  }

  /**
   * Shutdown health check service
   */
  shutdown(): void {
    try {
      this.isInitialized = false;
      this.healthChecks.clear();
      this.healthHistory.clear();
      this.lastOverallStatus = null;

      this.logger.log('Health check service shut down');
    } catch (error) {
      this.logger.error('Error during health check service shutdown:', error);
    }
  }
}
