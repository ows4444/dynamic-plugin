import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PerformanceMonitorService } from './performance-monitor.service';

export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description: string;
  labels?: string[];
  unit?: string;
}

export interface MetricValue {
  name: string;
  value: number;
  labels?: Record<string, string> | undefined;
  timestamp: Date;
}

export interface MetricsSnapshot {
  timestamp: Date;
  metrics: MetricValue[];
  metadata: {
    service: string;
    version: string;
    environment: string;
    instance: string;
  };
}

@Injectable()
export class MetricsCollectorService {
  private readonly logger = new Logger(MetricsCollectorService.name);
  private readonly metrics = new Map<string, MetricDefinition>();
  private readonly values = new Map<string, MetricValue[]>();
  private readonly maxValuesPerMetric = 1000;
  private collectionInterval?: NodeJS.Timeout | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {
    this.initializeDefaultMetrics();
    this.startCollection();
  }

  /**
   * Register a new metric
   */
  registerMetric(definition: MetricDefinition): void {
    this.metrics.set(definition.name, definition);
    this.values.set(definition.name, []);
    this.logger.debug(`Registered metric: ${definition.name}`);
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      this.logger.warn(`Metric not found: ${name}`);
      return;
    }

    const metricValue: MetricValue = {
      name,
      value,
      labels,
      timestamp: new Date(),
    };

    const values = this.values.get(name) ?? [];
    values.push(metricValue);

    // Keep only recent values
    if (values.length > this.maxValuesPerMetric) {
      values.shift();
    }

    this.values.set(name, values);
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, increment = 1, labels?: Record<string, string>): void {
    const currentValue = this.getLatestValue(name) ?? 0;
    this.recordMetric(name, currentValue + increment, labels);
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  /**
   * Get current snapshot of all metrics
   */
  getMetricsSnapshot(): MetricsSnapshot {
    const allMetrics: MetricValue[] = [];

    for (const [metricName, values] of this.values) {
      this.logger.debug(`Collecting metric: ${metricName}`);
      const latestValue = values[values.length - 1];
      if (latestValue) {
        allMetrics.push(latestValue);
      }
    }

    return {
      timestamp: new Date(),
      metrics: allMetrics,
      metadata: {
        service: 'plugin-system',
        version: this.configService.get('npm_package_version', '1.0.0'),
        environment: this.configService.get('NODE_ENV', 'development'),
        instance: this.configService.get('HOSTNAME', 'localhost'),
      },
    };
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    let output = '';

    for (const [metricName, definition] of this.metrics) {
      const values = this.values.get(metricName) ?? [];
      const latestValue = values[values.length - 1];

      if (!latestValue) continue;

      // Add metric help and type
      output += `# HELP ${metricName} ${definition.description}\n`;
      output += `# TYPE ${metricName} ${definition.type}\n`;

      // Add metric value with labels
      if (latestValue.labels && Object.keys(latestValue.labels).length > 0) {
        const labelString = Object.entries(latestValue.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        output += `${metricName}{${labelString}} ${latestValue.value}\n`;
      } else {
        output += `${metricName} ${latestValue.value}\n`;
      }
    }

    return output;
  }

  /**
   * Get metrics for a specific time range
   */
  getMetricsInRange(
    metricName: string,
    startTime: Date,
    endTime: Date,
  ): MetricValue[] {
    const values = this.values.get(metricName) ?? [];
    return values.filter(
      value => value.timestamp >= startTime && value.timestamp <= endTime,
    );
  }

  /**
   * Calculate metric statistics
   */
  calculateStatistics(metricName: string, timeRange?: { start: Date; end: Date }): {
    count: number;
    sum: number;
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    let values = this.values.get(metricName) ?? [];

    if (timeRange) {
      values = values.filter(
        value => value.timestamp >= timeRange.start && value.timestamp <= timeRange.end,
      );
    }

    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const numbers = values.map(v => v.value).sort((a, b) => a - b);
    const sum = numbers.reduce((a, b) => a + b, 0);

    return {
      count: numbers.length,
      sum,
      average: sum / numbers.length,
      min: Number(numbers[0]?? 0),
      max: Number(numbers[numbers.length - 1]?? 0),
      p50: this.percentile(numbers, 50),
      p95: this.percentile(numbers, 95),
      p99: this.percentile(numbers, 99),
    };
  }

  /**
   * Export metrics to external system
   */
  async exportMetrics(format: 'json' | 'prometheus' | 'influxdb'): Promise<string> {
    switch (format) {
      case 'json':
        return Promise.resolve(JSON.stringify(this.getMetricsSnapshot(), null, 2));
      case 'prometheus':
        return Promise.resolve(this.getPrometheusMetrics());
      case 'influxdb':
        return Promise.resolve(this.getInfluxDBFormat());
      default:
        throw new Error(`Unsupported export format: ${String(format)}`);
    }
  }

  /**
   * Start automatic metrics collection
   */
  private startCollection(intervalMs = 15000): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }

    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);

    this.logger.log('Metrics collection started');
  }

  /**
   * Stop automatic metrics collection
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }

    this.logger.log('Metrics collection stopped');
  }

  private initializeDefaultMetrics(): void {
    // System metrics
    this.registerMetric({
      name: 'system_cpu_usage_percent',
      type: 'gauge',
      description: 'Current CPU usage percentage',
      unit: 'percent',
    });

    this.registerMetric({
      name: 'system_memory_usage_bytes',
      type: 'gauge',
      description: 'Current memory usage in bytes',
      unit: 'bytes',
    });

    this.registerMetric({
      name: 'system_memory_usage_percent',
      type: 'gauge',
      description: 'Current memory usage percentage',
      unit: 'percent',
    });

    // Application metrics
    this.registerMetric({
      name: 'app_requests_total',
      type: 'counter',
      description: 'Total number of HTTP requests',
      labels: ['method', 'status_code', 'endpoint'],
    });

    this.registerMetric({
      name: 'app_request_duration_seconds',
      type: 'histogram',
      description: 'HTTP request duration in seconds',
      labels: ['method', 'endpoint'],
      unit: 'seconds',
    });

    this.registerMetric({
      name: 'app_errors_total',
      type: 'counter',
      description: 'Total number of application errors',
      labels: ['error_type', 'severity'],
    });

    // Plugin metrics
    this.registerMetric({
      name: 'plugins_loaded_total',
      type: 'counter',
      description: 'Total number of plugins loaded',
    });

    this.registerMetric({
      name: 'plugins_active_count',
      type: 'gauge',
      description: 'Number of currently active plugins',
    });

    this.registerMetric({
      name: 'plugin_execution_duration_seconds',
      type: 'histogram',
      description: 'Plugin execution duration in seconds',
      labels: ['plugin_id', 'operation'],
      unit: 'seconds',
    });

    this.registerMetric({
      name: 'plugin_memory_usage_bytes',
      type: 'gauge',
      description: 'Plugin memory usage in bytes',
      labels: ['plugin_id'],
      unit: 'bytes',
    });

    this.registerMetric({
      name: 'plugin_errors_total',
      type: 'counter',
      description: 'Total number of plugin errors',
      labels: ['plugin_id', 'error_type'],
    });
  }

  private collectSystemMetrics(): void {
    const performanceMetrics = this.performanceMonitor.getCurrentMetrics();
    const appMetrics = this.performanceMonitor.getApplicationMetrics();

    // System metrics
    this.setGauge('system_cpu_usage_percent', performanceMetrics.cpu.usage);
    this.setGauge('system_memory_usage_bytes', performanceMetrics.memory.used);
    this.setGauge('system_memory_usage_percent', performanceMetrics.memory.percentage);

    // Application metrics
    this.setGauge('plugins_loaded_total', appMetrics.totalPluginsLoaded);
    this.setGauge('plugins_active_count', appMetrics.activePlugins);

    // Custom metrics from performance monitor
    for (const [name, value] of Object.entries(performanceMetrics.custom)) {
      this.setGauge(`custom_${name}`, value);
    }
  }

  private getLatestValue(metricName: string): number | undefined {
    const values = this.values.get(metricName) ?? [];
    const latest = values[values.length - 1];
    return latest?.value;
  }

  private percentile(sortedArray: number[], p: number): number {
    const index = (p / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1] ?? 0;
    return (sortedArray[lower] ?? 0) * (1 - weight) + (sortedArray[upper] ?? 0) * weight;
  }

  private getInfluxDBFormat(): string {
    const snapshot = this.getMetricsSnapshot();
    let output = '';

    for (const metric of snapshot.metrics) {
      const tags = metric.labels
        ? Object.entries(metric.labels)
            .map(([key, value]) => `${key}=${value}`)
            .join(',')
        : '';

      const tagString = tags ? `,${tags}` : '';
      const timestamp = metric.timestamp.getTime() * 1000000; // Convert to nanoseconds

      output += `${metric.name}${tagString} value=${metric.value} ${timestamp}\n`;
    }

    return output;
  }
}