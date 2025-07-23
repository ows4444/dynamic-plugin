import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class PrometheusMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly registry: Registry;
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly pluginOperationsTotal: Counter<string>;
  private readonly pluginOperationDuration: Histogram<string>;
  private readonly activePlugins: Gauge<string>;
  private readonly memoryUsage: Gauge<string>;
  private readonly cpuUsage: Gauge<string>;
  private readonly databaseConnections: Gauge<string>;
  private readonly cacheOperationsTotal: Counter<string>;
  private readonly errorCountTotal: Counter<string>;

  constructor(private readonly configService: ConfigService) {
    this.registry = new Registry();
    
    // Enable collection of default metrics
    collectDefaultMetrics({ register: this.registry });

    // HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.1, 5, 15, 50, 100, 500, 1000, 5000],
      registers: [this.registry],
    });

    // Plugin metrics
    this.pluginOperationsTotal = new Counter({
      name: 'plugin_operations_total',
      help: 'Total number of plugin operations',
      labelNames: ['plugin_id', 'operation', 'status', 'service'],
      registers: [this.registry],
    });

    this.pluginOperationDuration = new Histogram({
      name: 'plugin_operation_duration_ms',
      help: 'Plugin operation duration in milliseconds',
      labelNames: ['plugin_id', 'operation', 'service'],
      buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000],
      registers: [this.registry],
    });

    this.activePlugins = new Gauge({
      name: 'active_plugins_count',
      help: 'Number of currently active plugins',
      labelNames: ['service'],
      registers: [this.registry],
    });

    // System metrics
    this.memoryUsage = new Gauge({
      name: 'memory_usage_bytes',
      help: 'Current memory usage in bytes',
      labelNames: ['type', 'service'],
      registers: [this.registry],
    });

    this.cpuUsage = new Gauge({
      name: 'cpu_usage_percent',
      help: 'Current CPU usage percentage',
      labelNames: ['service'],
      registers: [this.registry],
    });

    this.databaseConnections = new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      labelNames: ['database', 'service'],
      registers: [this.registry],
    });

    // Cache metrics
    this.cacheOperationsTotal = new Counter({
      name: 'cache_operations_total',
      help: 'Total number of cache operations',
      labelNames: ['operation', 'result', 'service'],
      registers: [this.registry],
    });

    // Error metrics
    this.errorCountTotal = new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'service', 'severity'],
      registers: [this.registry],
    });
  }

  async onModuleInit(): Promise<void> {
    // Start collecting system metrics
    this.startSystemMetricsCollection();
    await Promise.resolve(); // Simulate async initialization if needed
  }

  async onModuleDestroy(): Promise<void> {
    // Clean up metrics collection
    this.registry.clear();
        await Promise.resolve(); // Simulate async initialization if needed
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
        await Promise.resolve(); // Simulate async initialization if needed
  }

  /**
   * Get registry for custom metrics
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    service = 'unknown'
  ): void {
    const labels = {
      method: method.toLowerCase(),
      route: this.sanitizeRoute(route),
      status_code: statusCode.toString(),
      service,
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, duration);
  }

  /**
   * Record plugin operation metrics
   */
  recordPluginOperation(
    pluginId: string,
    operation: string,
    status: 'success' | 'failure' | 'timeout',
    duration: number,
    service = 'plugin-host'
  ): void {
    const operationLabels = {
      plugin_id: pluginId,
      operation,
      status,
      service,
    };

    const durationLabels = {
      plugin_id: pluginId,
      operation,
      service,
    };

    this.pluginOperationsTotal.inc(operationLabels);
    this.pluginOperationDuration.observe(durationLabels, duration);
  }

  /**
   * Update active plugins count
   */
  setActivePluginsCount(count: number, service = 'plugin-host'): void {
    this.activePlugins.set({ service }, count);
  }

  /**
   * Record cache operation metrics
   */
  recordCacheOperation(
    operation: 'get' | 'set' | 'delete' | 'clear',
    result: 'hit' | 'miss' | 'success' | 'error',
    service = 'unknown'
  ): void {
    this.cacheOperationsTotal.inc({
      operation,
      result,
      service,
    });
  }

  /**
   * Record error metrics
   */
  recordError(
    errorType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    service = 'unknown'
  ): void {
    this.errorCountTotal.inc({
      type: errorType,
      service,
      severity,
    });
  }

  /**
   * Update database connection metrics
   */
  setDatabaseConnections(count: number, database: string, service = 'unknown'): void {
    this.databaseConnections.set({ database, service }, count);
  }

  /**
   * Create a custom counter metric
   */
  createCounter(name: string, help: string, labelNames: string[] = []): Counter<string> {
    return new Counter({
      name,
      help,
      labelNames,
      registers: [this.registry],
    });
  }

  /**
   * Create a custom histogram metric
   */
  createHistogram(
    name: string, 
    help: string, 
    labelNames: string[] = [],
    buckets: number[] = [0.1, 5, 15, 50, 100, 500, 1000, 5000]
  ): Histogram<string> {
    return new Histogram({
      name,
      help,
      labelNames,
      buckets,
      registers: [this.registry],
    });
  }

  /**
   * Create a custom gauge metric
   */
  createGauge(name: string, help: string, labelNames: string[] = []): Gauge<string> {
    return new Gauge({
      name,
      help,
      labelNames,
      registers: [this.registry],
    });
  }

  private startSystemMetricsCollection(): void {
    const service = this.configService.get('SERVICE_NAME', 'unknown');
    
    // Collect memory metrics every 30 seconds
    setInterval(() => {
      const memUsage = process.memoryUsage();
      
      this.memoryUsage.set({ type: 'rss', service }, memUsage.rss);
      this.memoryUsage.set({ type: 'heapTotal', service }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'heapUsed', service }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'external', service }, memUsage.external);
      
      if ('arrayBuffers' in memUsage) {
        this.memoryUsage.set({ type: 'arrayBuffers', service }, memUsage.arrayBuffers);
      }
    }, 30000);

    // Collect CPU metrics every 60 seconds
    let lastCpuUsage = process.cpuUsage();
    setInterval(() => {
      const currentCpuUsage = process.cpuUsage(lastCpuUsage);
      const cpuPercent = (currentCpuUsage.user + currentCpuUsage.system) / 1000000; // Convert to seconds
      
      this.cpuUsage.set({ service }, cpuPercent * 100); // Convert to percentage
      lastCpuUsage = process.cpuUsage();
    }, 60000);
  }

  private sanitizeRoute(route: string): string {
    // Replace dynamic route segments with placeholders
    return route
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-zA-Z0-9_-]+@\d+\.\d+\.\d+/g, '/:plugin@version');
  }
}