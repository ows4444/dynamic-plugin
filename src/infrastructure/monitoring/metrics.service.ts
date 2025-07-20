import { Injectable, Logger } from '@nestjs/common';

export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export interface MetricsSummary {
  totalMetrics: number;
  metricsCollected: number;
  lastCollectionTime: Date;
  topMetrics: Array<{
    name: string;
    value: number;
    count: number;
  }>;
}

/**
 * Metrics collection and aggregation service
 * Provides Prometheus-style metrics with support for multiple metric types
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly metrics = new Map<string, MetricData[]>();
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly histograms = new Map<string, number[]>();
  private isInitialized = false;
  private totalMetricsCollected = 0;

  /**
   * Initialize metrics service
   */
  initialize(): void {
    try {
      // Initialize built-in metrics
      this.initializeBuiltInMetrics();

      this.isInitialized = true;
      this.logger.log('Metrics service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize metrics service:', error);
      throw error;
    }
  }

  /**
   * Initialize built-in system metrics
   */
  private initializeBuiltInMetrics(): void {
    const builtInMetrics = [
      { name: 'system.cpu.usage', type: 'gauge' as const },
      { name: 'system.memory.usage', type: 'gauge' as const },
      { name: 'system.memory.total', type: 'gauge' as const },
      { name: 'system.uptime', type: 'counter' as const },
      { name: 'plugin.operations.total', type: 'counter' as const },
      { name: 'plugin.operations.duration', type: 'histogram' as const },
      { name: 'plugin.errors.total', type: 'counter' as const },
      { name: 'cache.hits.total', type: 'counter' as const },
      { name: 'cache.misses.total', type: 'counter' as const },
      { name: 'api.requests.total', type: 'counter' as const },
      { name: 'api.response.duration', type: 'histogram' as const },
    ];

    for (const metric of builtInMetrics) {
      this.metrics.set(metric.name, []);
    }
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>, type: 'counter' | 'gauge' | 'histogram' | 'summary' = 'gauge'): void {
    if (!this.isInitialized) {
      this.logger.warn('Metrics service not initialized, skipping metric recording');
      return;
    }

    try {
      const metric: MetricData = {
        name,
        value,
        timestamp: new Date(),
        tags,
        type,
      };

      // Store in historical data
      if (!this.metrics.has(name)) {
        this.metrics.set(name, []);
      }

      const metricHistory = this.metrics.get(name)!;
      metricHistory.push(metric);

      // Keep only last 1000 data points per metric
      if (metricHistory.length > 1000) {
        metricHistory.splice(0, metricHistory.length - 1000);
      }

      // Update aggregated values based on type
      switch (type) {
        case 'counter':
          this.updateCounter(name, value);
          break;
        case 'gauge':
          this.updateGauge(name, value);
          break;
        case 'histogram':
          this.updateHistogram(name, value);
          break;
        case 'summary': {
          throw new Error('Not implemented yet: "summary" case');
        }
      }

      this.totalMetricsCollected++;

      this.logger.debug(`Recorded ${type} metric: ${name} = ${value}`);
    } catch (error) {
      this.logger.error(`Failed to record metric ${name}:`, error);
    }
  }

  /**
   * Update counter value
   */
  private updateCounter(name: string, value: number): void {
    const currentValue = this.counters.get(name) ?? 0;
    this.counters.set(name, currentValue + value);
  }

  /**
   * Update gauge value
   */
  private updateGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /**
   * Update histogram values
   */
  private updateHistogram(name: string, value: number): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }

    const values = this.histograms.get(name)!;
    values.push(value);

    // Keep only last 1000 values
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, tags?: Record<string, string>): void {
    this.recordMetric(name, 1, tags, 'counter');
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, tags, 'gauge');
  }

  /**
   * Record histogram value
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, tags, 'histogram');
  }

  /**
   * Get current value of a metric
   */
  getMetricValue(name: string): number | null {
    // Check counters first
    if (this.counters.has(name)) {
      return this.counters.get(name)!;
    }

    // Check gauges
    if (this.gauges.has(name)) {
      return this.gauges.get(name)!;
    }

    // For histograms, return the latest value
    if (this.histograms.has(name)) {
      const values = this.histograms.get(name)!;
      return values.length > 0 ? values[values.length - 1] : null;
    }

    return null;
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(name: string): HistogramStats | null {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const count = values.length;

    return {
      count,
      sum,
      avg: sum / count,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.getPercentile(sorted, 0.5),
      p95: this.getPercentile(sorted, 0.95),
      p99: this.getPercentile(sorted, 0.99),
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[index] || 0;
  }

  /**
   * Get all metrics for a specific prefix
   */
  getMetricsByPrefix(prefix: string): Map<string, number> {
    const result = new Map<string, number>();

    // Check counters
    for (const [name, value] of this.counters.entries()) {
      if (name.startsWith(prefix)) {
        result.set(name, value);
      }
    }

    // Check gauges
    for (const [name, value] of this.gauges.entries()) {
      if (name.startsWith(prefix)) {
        result.set(name, value);
      }
    }

    return result;
  }

  /**
   * Get metrics summary for dashboard
   */
  getMetricsSummary(): MetricsSummary {
    try {
      const topMetrics: Array<{ name: string; value: number; count: number }> = [];

      // Get top counters
      for (const [name, value] of this.counters.entries()) {
        topMetrics.push({ name, value, count: 1 });
      }

      // Get top gauges
      for (const [name, value] of this.gauges.entries()) {
        topMetrics.push({ name, value, count: 1 });
      }

      // Sort by value and take top 10
      topMetrics.sort((a, b) => b.value - a.value);
      const top10Metrics = topMetrics.slice(0, 10);

      return {
        totalMetrics: this.metrics.size,
        metricsCollected: this.totalMetricsCollected,
        lastCollectionTime: new Date(),
        topMetrics: top10Metrics,
      };
    } catch (error) {
      this.logger.error('Failed to get metrics summary:', error);
      throw error;
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];

    try {
      // Export counters
      for (const [name, value] of this.counters.entries()) {
        lines.push(`# TYPE ${name} counter`);
        lines.push(`${name} ${value}`);
      }

      // Export gauges
      for (const [name, value] of this.gauges.entries()) {
        lines.push(`# TYPE ${name} gauge`);
        lines.push(`${name} ${value}`);
      }

      // Export histogram summaries
      for (const [name, values] of this.histograms.entries()) {
        if (values.length > 0) {
          const stats = this.getHistogramStats(name);
          if (stats) {
            lines.push(`# TYPE ${name} histogram`);
            lines.push(`${name}_count ${stats.count}`);
            lines.push(`${name}_sum ${stats.sum}`);
            lines.push(`${name}_avg ${stats.avg}`);
          }
        }
      }

      return `${lines.join('\n')}\n`;
    } catch (error) {
      this.logger.error('Failed to export Prometheus metrics:', error);
      return '# Error exporting metrics\n';
    }
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    try {
      this.metrics.clear();
      this.counters.clear();
      this.gauges.clear();
      this.histograms.clear();
      this.totalMetricsCollected = 0;

      // Reinitialize built-in metrics
      this.initializeBuiltInMetrics();

      this.logger.log('All metrics cleared');
    } catch (error) {
      this.logger.error('Failed to clear metrics:', error);
      throw error;
    }
  }

  /**
   * Get metric history for a specific metric
   */
  getMetricHistory(name: string, limit = 100): MetricData[] {
    const history = this.metrics.get(name) ?? [];
    return history.slice(-limit);
  }

  /**
   * Check if metrics service is healthy
   */
  isHealthy(): boolean {
    return this.isInitialized;
  }

  /**
   * Shutdown metrics service
   */
  shutdown(): void {
    try {
      // Export final metrics before shutdown
      const finalMetrics = this.exportPrometheusMetrics();
      this.logger.debug('Final metrics export:', finalMetrics);

      this.isInitialized = false;
      this.logger.log('Metrics service shut down');
    } catch (error) {
      this.logger.error('Error during metrics service shutdown:', error);
    }
  }
}

export interface HistogramStats {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}
