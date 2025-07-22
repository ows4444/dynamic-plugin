import { Injectable, Logger } from '@nestjs/common';
import { performance } from 'perf_hooks';
export interface MetricDataPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}
export interface MetricConfig {
  maxDataPoints?: number;
  aggregationWindow?: number;
  autoCleanup?: boolean;
}
export interface MetricStatistics {
  average: number;
  min: number;
  max: number;
  count: number;
  p95: number;
  p99: number;
}
export interface PerformanceTimer {
  stop(): number;
  elapsed(): number;
}


@Injectable()
export class PerformanceMetricsService {
  private readonly logger = new Logger(PerformanceMetricsService.name);
  private readonly metrics = new Map<string, MetricDataPoint[]>();
  private readonly configs = new Map<string, MetricConfig>();
  private readonly defaultConfig: MetricConfig = {
    maxDataPoints: 1000,
    aggregationWindow: 300000, // 5 minutes
    autoCleanup: true,
  };

  recordMetric(metricName: string, value: number, tags?: Record<string, string>): void {
    const dataPoint: MetricDataPoint = {
      timestamp: performance.now(),
      value,
      tags: tags ?? {},
    };

    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }

    const metricData = this.metrics.get(metricName)!;
    metricData.push(dataPoint);

    // Cleanup if needed
    const config = this.getMetricConfig(metricName);
    if ((config.autoCleanup ?? false) && metricData.length > config.maxDataPoints!) {
      this.cleanupOldDataPoints(metricName);
    }
  }

  startTimer(metricName: string, tags?: Record<string, string>): PerformanceTimer {
    const startTime = performance.now();

    return {
      stop: (): number => {
        const elapsed = performance.now() - startTime;
        this.recordMetric(metricName, elapsed, tags);
        return elapsed;
      },
      elapsed: (): number => {
        return performance.now() - startTime;
      },
    };
  }

  getStatistics(metricName: string, timeWindow?: number): MetricStatistics | null {
    const metricData = this.metrics.get(metricName);
    if (!metricData || metricData.length === 0) {
      return null;
    }

    const config = this.getMetricConfig(metricName);
    const window = timeWindow ?? config.aggregationWindow!;
    const cutoffTime = performance.now() - window;

    const relevantData = metricData.filter(point => point.timestamp >= cutoffTime);
    
    if (relevantData.length === 0) {
      return null;
    }

    const values = relevantData.map(point => point.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      average: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      count: values.length,
      p95: this.calculatePercentile(values, 0.95),
      p99: this.calculatePercentile(values, 0.99),
    };
  }

  getRecentData(metricName: string, limit = 100): MetricDataPoint[] {
    const metricData = this.metrics.get(metricName);
    if (!metricData) {
      return [];
    }

    return metricData
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  configureMetric(metricName: string, config: MetricConfig): void {
    this.configs.set(metricName, { ...this.defaultConfig, ...config });
  }

  clearMetric(metricName: string): void {
    this.metrics.delete(metricName);
  }

  clearAllMetrics(): void {
    this.metrics.clear();
  }

  getMemoryUsage(): { metricCount: number; dataPointCount: number; estimatedMemoryMB: number } {
    let totalDataPoints = 0;
    for (const data of this.metrics.values()) {
      totalDataPoints += data.length;
    }

    const estimatedMemoryMB = (totalDataPoints * 100) / (1024 * 1024);

    return {
      metricCount: this.metrics.size,
      dataPointCount: totalDataPoints,
      estimatedMemoryMB: Math.round(estimatedMemoryMB * 100) / 100,
    };
  }

  performMaintenance(): void {
    this.logger.debug('Performing performance metrics maintenance...');
    
    for (const metricName of this.metrics.keys()) {
      this.cleanupOldDataPoints(metricName);
    }

    const usage = this.getMemoryUsage();
    this.logger.debug(`Metrics maintenance completed. Memory usage: ${usage.estimatedMemoryMB}MB`);
  }

  private getMetricConfig(metricName: string): MetricConfig {
    return this.configs.get(metricName) ?? this.defaultConfig;
  }

  private cleanupOldDataPoints(metricName: string): void {
    const metricData = this.metrics.get(metricName);
    if (!metricData) return;

    const config = this.getMetricConfig(metricName);
    const maxPoints = config.maxDataPoints!;
    const window = config.aggregationWindow!;
    const cutoffTime = performance.now() - window;

    if (metricData.length > maxPoints) {
      const recentData = metricData
        .filter(point => point.timestamp >= cutoffTime)
        .slice(-maxPoints);

      this.metrics.set(metricName, recentData);
    }
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];

    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }
}