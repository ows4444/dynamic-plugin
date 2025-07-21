import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage, getErrorStack } from '@lib/shared/common';
import * as os from 'os';

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface PluginMetrics {
  pluginName: string;
  instanceId: string;
  requests: RequestMetrics;
  performance: PerformanceMetrics;
  errors: ErrorMetrics;
  resource: ResourceMetrics;
}

export interface RequestMetrics {
  total: number;
  successful: number;
  failed: number;
  averageResponseTime: number;
  requestsPerMinute: number;
  lastRequest?: Date;
}

export interface PerformanceMetrics {
  averageExecutionTime: number;
  slowestRequest: number;
  fastestRequest: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface ErrorMetrics {
  total: number;
  last24Hours: number;
  lastError?: {
    message: string;
    timestamp: Date;
    stack?: string;
  };
  errorRate: number;
}

export interface ResourceMetrics {
  memoryUsage: number;
  diskUsage: number;
  networkIO: {
    bytesIn: number;
    bytesOut: number;
  };
}

export interface MetricsSnapshot {
  timestamp: Date;
  system: SystemMetrics;
  plugins: PluginMetrics[];
  metrics: Record<string, Metric[]>;
}

export interface CSVExportData {
  metrics: Record<string, Metric[]>;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  plugins: {
    total: number;
    active: number;
    inactive: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly metrics = new Map<string, Metric[]>();
  private readonly pluginMetrics = new Map<string, PluginMetrics>();
  private readonly maxMetricsHistory = 10000;
  private collectionInterval: NodeJS.Timeout;

  constructor() {
    this.startMetricsCollection();
  }

  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
  ): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      tags,
    };

    const metricHistory = this.metrics.get(name) ?? [];
    metricHistory.push(metric);

    if (metricHistory.length > this.maxMetricsHistory) {
      metricHistory.shift();
    }

    this.metrics.set(name, metricHistory);
    this.logger.debug(`Recorded metric: ${name} = ${value}`);
  }

  recordPluginRequest(
    pluginName: string,
    instanceId: string,
    responseTime: number,
    success: boolean,
  ): void {
    const key = `${pluginName}:${instanceId}`;
    let pluginMetric = this.pluginMetrics.get(key);

    if (!pluginMetric) {
      pluginMetric = this.createEmptyPluginMetrics(pluginName, instanceId);
      this.pluginMetrics.set(key, pluginMetric);
    }

    pluginMetric.requests.total++;

    if (success) {
      pluginMetric.requests.successful++;
    } else {
      pluginMetric.requests.failed++;
      pluginMetric.errors.total++;
    }

    const totalTime =
      pluginMetric.performance.averageExecutionTime *
      (pluginMetric.requests.total - 1);
    pluginMetric.performance.averageExecutionTime =
      (totalTime + responseTime) / pluginMetric.requests.total;

    if (responseTime > pluginMetric.performance.slowestRequest) {
      pluginMetric.performance.slowestRequest = responseTime;
    }

    if (
      pluginMetric.performance.fastestRequest === 0 ||
      responseTime < pluginMetric.performance.fastestRequest
    ) {
      pluginMetric.performance.fastestRequest = responseTime;
    }

    pluginMetric.requests.lastRequest = new Date();
    this.calculateRequestsPerMinute(pluginMetric);
  }

  recordPluginError(
    pluginName: string,
    instanceId: string,
    error: Error,
  ): void {
    const key = `${pluginName}:${instanceId}`;
    let pluginMetric = this.pluginMetrics.get(key);

    if (!pluginMetric) {
      pluginMetric = this.createEmptyPluginMetrics(pluginName, instanceId);
      this.pluginMetrics.set(key, pluginMetric);
    }

    pluginMetric.errors.total++;
    pluginMetric.errors.lastError = {
      message: getErrorMessage(error),
      timestamp: new Date(),
      stack: getErrorStack(error),
    };

    this.calculateErrorRate(pluginMetric);
  }

  getMetric(name: string, limit = 100): Metric[] {
    const metrics = this.metrics.get(name) ?? [];
    return metrics.slice(-limit);
  }

  getPluginMetrics(pluginName?: string, instanceId?: string): PluginMetrics[] {
    if (pluginName && instanceId) {
      const key = `${pluginName}:${instanceId}`;
      const metric = this.pluginMetrics.get(key);
      return metric ? [metric] : [];
    }

    if (pluginName) {
      return Array.from(this.pluginMetrics.values()).filter(
        (m) => m.pluginName === pluginName,
      );
    }

    return Array.from(this.pluginMetrics.values());
  }

  getSystemMetrics(): SystemMetrics {
    const now = new Date();
    const _memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const pluginMetrics = Array.from(this.pluginMetrics.values());
    const totalRequests = pluginMetrics.reduce(
      (sum, m) => sum + m.requests.total,
      0,
    );
    const successfulRequests = pluginMetrics.reduce(
      (sum, m) => sum + m.requests.successful,
      0,
    );
    const failedRequests = pluginMetrics.reduce(
      (sum, m) => sum + m.requests.failed,
      0,
    );
    const averageResponseTime =
      pluginMetrics.length > 0
        ? pluginMetrics.reduce(
            (sum, m) => sum + m.performance.averageExecutionTime,
            0,
          ) / pluginMetrics.length
        : 0;

    return {
      timestamp: now,
      cpu: {
        usage: 0, // Would need CPU monitoring implementation
        loadAverage: os.loadavg(),
      },
      memory: {
        used: usedMemory,
        free: freeMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100,
      },
      plugins: {
        total: pluginMetrics.length,
        active: pluginMetrics.filter(
          (m) =>
            m.requests.lastRequest &&
            Date.now() - m.requests.lastRequest.getTime() < 60000,
        ).length,
        inactive: pluginMetrics.filter(
          (m) =>
            !m.requests.lastRequest ||
            Date.now() - m.requests.lastRequest.getTime() >= 60000,
        ).length,
      },
      requests: {
        total: totalRequests,
        successful: successfulRequests,
        failed: failedRequests,
        averageResponseTime,
      },
    };
  }

  getMetricsSnapshot(): MetricsSnapshot {
    const systemMetrics = this.getSystemMetrics();
    const allPluginMetrics = this.getPluginMetrics();
    const recentMetrics: Record<string, Metric[]> = {};

    for (const [name, metrics] of this.metrics.entries()) {
      recentMetrics[name] = metrics.slice(-10); // Last 10 measurements
    }

    return {
      timestamp: new Date(),
      system: systemMetrics,
      plugins: allPluginMetrics,
      metrics: recentMetrics,
    };
  }

  async exportMetrics(format: 'json' | 'csv' = 'json'): Promise<string> {
    const snapshot = this.getMetricsSnapshot();

    if (format === 'csv') {
      return this.convertToCSV({ metrics: snapshot.metrics });
    }

    return Promise.resolve(JSON.stringify(snapshot, null, 2));
  }

  clearMetrics(pluginName?: string, instanceId?: string): void {
    if (pluginName && instanceId) {
      const key = `${pluginName}:${instanceId}`;
      this.pluginMetrics.delete(key);
      this.logger.log(`Cleared metrics for plugin: ${key}`);
      return;
    }

    if (pluginName) {
      const keysToDelete: string[] = [];
      for (const key of this.pluginMetrics.keys()) {
        if (key.startsWith(`${pluginName}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => this.pluginMetrics.delete(key));
      this.logger.log(`Cleared metrics for plugin: ${pluginName}`);
      return;
    }

    this.metrics.clear();
    this.pluginMetrics.clear();
    this.logger.log('Cleared all metrics');
  }

  private createEmptyPluginMetrics(
    pluginName: string,
    instanceId: string,
  ): PluginMetrics {
    return {
      pluginName,
      instanceId,
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        requestsPerMinute: 0,
      },
      performance: {
        averageExecutionTime: 0,
        slowestRequest: 0,
        fastestRequest: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      },
      errors: {
        total: 0,
        last24Hours: 0,
        errorRate: 0,
      },
      resource: {
        memoryUsage: 0,
        diskUsage: 0,
        networkIO: {
          bytesIn: 0,
          bytesOut: 0,
        },
      },
    };
  }

  private calculateRequestsPerMinute(pluginMetric: PluginMetrics): void {
    if (!pluginMetric.requests.lastRequest) return;

    // Calculate based on requests in the last minute
    // This is a simplified calculation
    const _oneMinuteAgo = Date.now() - 60000;
    const recentRequests = pluginMetric.requests.total; // Simplified
    pluginMetric.requests.requestsPerMinute = recentRequests;
  }

  private calculateErrorRate(pluginMetric: PluginMetrics): void {
    if (pluginMetric.requests.total === 0) {
      pluginMetric.errors.errorRate = 0;
      return;
    }

    pluginMetric.errors.errorRate =
      (pluginMetric.errors.total / pluginMetric.requests.total) * 100;
  }

  private convertToCSV(data: CSVExportData): string {
    // Simplified CSV conversion
    const lines: string[] = [];
    lines.push('timestamp,metric,value,plugin,instance');

    for (const [metricName, metrics] of Object.entries(data.metrics)) {
      for (const metric of metrics) {
        const pluginTag = metric.tags?.plugin ?? '';
        const instanceTag = metric.tags?.instance ?? '';
        lines.push(
          `${metric.timestamp.toISOString()},${metricName},${metric.value},${pluginTag},${instanceTag}`,
        );
      }
    }

    return lines.join('\n');
  }

  private startMetricsCollection(): void {
    this.collectionInterval = setInterval(() => {
      try {
        this.recordMetric('system.memory.used', process.memoryUsage().heapUsed);
        this.recordMetric('system.uptime', process.uptime());

        const pluginCount = this.pluginMetrics.size;
        this.recordMetric('plugins.total', pluginCount);
      } catch (error) {
        this.logger.error(`Metrics collection failed: ${getErrorMessage(error)}`);
      }
    }, 30000); // Collect system metrics every 30 seconds
  }

  onApplicationShutdown(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
    this.logger.log('Metrics service shutdown complete');
  }
}
