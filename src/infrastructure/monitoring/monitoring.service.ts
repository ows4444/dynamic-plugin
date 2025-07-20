import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { HealthCheckService } from './health-check.service';
import { TracingService } from './tracing.service';
import { AlertingService } from './alerting.service';
import { ConfigService } from '../config/config.service';

export interface MonitoringConfiguration {
  enableMetrics: boolean;
  enableHealthChecks: boolean;
  enableTracing: boolean;
  enableAlerting: boolean;
  metricsInterval: number;
  healthCheckInterval: number;
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    errorRate: number;
    responseTime: number;
  };
}

/**
 * Central monitoring service coordinating all observability components
 * Provides unified interface for metrics, health checks, tracing, and alerting
 */
@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly config: MonitoringConfiguration;
  private metricsInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly healthCheckService: HealthCheckService,
    private readonly tracingService: TracingService,
    private readonly alertingService: AlertingService,
    private readonly configService: ConfigService,
  ) {
    this.config = {
      enableMetrics: this.configService.get('MONITORING_ENABLE_METRICS', true),
      enableHealthChecks: this.configService.get('MONITORING_ENABLE_HEALTH_CHECKS', true),
      enableTracing: this.configService.get('MONITORING_ENABLE_TRACING', false),
      enableAlerting: this.configService.get('MONITORING_ENABLE_ALERTING', true),
      metricsInterval: this.configService.get('MONITORING_METRICS_INTERVAL', 30000),
      healthCheckInterval: this.configService.get('MONITORING_HEALTH_CHECK_INTERVAL', 60000),
      alertThresholds: {
        cpuUsage: this.configService.get('MONITORING_CPU_THRESHOLD', 80),
        memoryUsage: this.configService.get('MONITORING_MEMORY_THRESHOLD', 85),
        errorRate: this.configService.get('MONITORING_ERROR_RATE_THRESHOLD', 5),
        responseTime: this.configService.get('MONITORING_RESPONSE_TIME_THRESHOLD', 2000),
      },
    };
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.initializeMonitoring();
      this.logger.log('Monitoring service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize monitoring service:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.shutdownMonitoring();
      this.logger.log('Monitoring service shut down successfully');
    } catch (error) {
      this.logger.error('Error during monitoring service shutdown:', error);
    }
  }

  /**
   * Initialize all monitoring components
   */
  private async initializeMonitoring(): Promise<void> {
    const initPromises: Array<Promise<void>> = [];

    // Initialize metrics service
    if (this.config.enableMetrics) {
      this.metricsService.initialize();
    }

    // Initialize health check service
    if (this.config.enableHealthChecks) {
      this.healthCheckService.initialize();
    }

    // Initialize tracing service
    if (this.config.enableTracing) {
      initPromises.push(this.tracingService.initialize());
    }

    // Initialize alerting service
    if (this.config.enableAlerting) {
      initPromises.push(this.alertingService.initialize());
    }

    await Promise.allSettled(initPromises);

    // Start periodic monitoring tasks
    this.startPeriodicTasks();
    this.isInitialized = true;
  }

  /**
   * Start periodic monitoring tasks
   */
  private startPeriodicTasks(): void {
    // Start metrics collection
    if (this.config.enableMetrics) {
      this.metricsInterval = setInterval(() => {
        this.collectSystemMetrics().catch((error) => {
          this.logger.error('Error collecting system metrics:', error);
        });
      }, this.config.metricsInterval);
    }

    // Start health checks
    if (this.config.enableHealthChecks) {
      this.healthCheckInterval = setInterval(() => {
        this.performHealthChecks().catch((error) => {
          this.logger.error('Error performing health checks:', error);
        });
      }, this.config.healthCheckInterval);
    }
  }

  /**
   * Collect system-wide metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      // Collect basic system metrics
      const systemMetrics = await this.getSystemMetrics();

      // Record metrics
      this.metricsService.recordMetric('system.cpu.usage', systemMetrics.cpuUsage);
      this.metricsService.recordMetric('system.memory.usage', systemMetrics.memoryUsage);
      this.metricsService.recordMetric('system.memory.total', systemMetrics.totalMemory);
      this.metricsService.recordMetric('system.uptime', systemMetrics.uptime);

      // Check thresholds and trigger alerts if necessary
      if (this.config.enableAlerting) {
        await this.checkAlertThresholds(systemMetrics);
      }
    } catch (error) {
      this.logger.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * Perform comprehensive health checks
   */
  private async performHealthChecks(): Promise<void> {
    try {
      await this.healthCheckService.performAllHealthChecks();
    } catch (error) {
      this.logger.error('Health check execution failed:', error);
    }
  }

  /**
   * Check alert thresholds and trigger alerts
   */
  private async checkAlertThresholds(metrics: SystemMetrics): Promise<void> {
    const alerts: AlertCondition[] = [];

    if (metrics.cpuUsage > this.config.alertThresholds.cpuUsage) {
      alerts.push({
        type: 'high_cpu_usage',
        severity: 'warning',
        message: `CPU usage is ${metrics.cpuUsage}%, exceeding threshold of ${this.config.alertThresholds.cpuUsage}%`,
        value: metrics.cpuUsage,
        threshold: this.config.alertThresholds.cpuUsage,
      });
    }

    if (metrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'high_memory_usage',
        severity: 'warning',
        message: `Memory usage is ${metrics.memoryUsage}%, exceeding threshold of ${this.config.alertThresholds.memoryUsage}%`,
        value: metrics.memoryUsage,
        threshold: this.config.alertThresholds.memoryUsage,
      });
    }

    // Send alerts if any conditions are met
    if (alerts.length > 0) {
      const alertPromises = alerts.map((alert) =>
        this.alertingService.sendAlert({
          ruleId: 'system-monitoring',
          title: alert.message,
          severity: alert.severity,
          message: alert.message,
          value: alert.value,
          threshold: alert.threshold,
          metadata: alert.metadata,
        }),
      );
      await Promise.allSettled(alertPromises);
    }
  }

  /**
   * Get current system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const uptime = process.uptime();

    return {
      cpuUsage: await this.getCpuUsage(),
      memoryUsage: ((totalMemory - freeMemory) / totalMemory) * 100,
      totalMemory,
      freeMemory,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      uptime,
    };
  }

  /**
   * Calculate CPU usage percentage
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
   * Record plugin-specific metric
   */
  recordPluginMetric(pluginId: string, metricName: string, value: number, tags?: Record<string, string>): void {
    if (!this.config.enableMetrics) {
      return;
    }

    try {
      const fullMetricName = `plugin.${pluginId}.${metricName}`;
      this.metricsService.recordMetric(fullMetricName, value, {
        ...tags,
        plugin_id: pluginId,
      });
    } catch (error) {
      this.logger.error(`Failed to record plugin metric for ${pluginId}:`, error);
    }
  }

  /**
   * Start tracing for an operation
   */
  async startTrace(operationName: string, metadata?: Record<string, any>): Promise<string> {
    if (!this.config.enableTracing) {
      return 'tracing-disabled';
    }

    try {
      return await this.tracingService.startTrace(operationName, metadata);
    } catch (error) {
      this.logger.error(`Failed to start trace for ${operationName}:`, error);
      return 'trace-error';
    }
  }

  /**
   * End tracing for an operation
   */
  async endTrace(traceId: string, result?: any, error?: Error): Promise<void> {
    if (!this.config.enableTracing || traceId === 'tracing-disabled' || traceId === 'trace-error') {
      return;
    }

    try {
      await this.tracingService.endTrace(traceId, result, error);
    } catch (err) {
      this.logger.error(`Failed to end trace ${traceId}:`, err);
    }
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  async getDashboardData(): Promise<MonitoringDashboard> {
    try {
      const [systemMetrics, healthStatus, metricsData] = await Promise.allSettled([this.getSystemMetrics(), this.healthCheckService.getOverallHealthStatus(), this.metricsService.getMetricsSummary()]);

      return {
        systemMetrics: systemMetrics.status === 'fulfilled' ? systemMetrics.value : null,
        healthStatus: healthStatus.status === 'fulfilled' ? healthStatus.value : null,
        metricsData: metricsData.status === 'fulfilled' ? metricsData.value : null,
        configuration: this.config,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard data:', error);
      throw error;
    }
  }

  /**
   * Shutdown monitoring gracefully
   */
  private async shutdownMonitoring(): Promise<void> {
    // Clear intervals
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Shutdown services
    const shutdownPromises: Array<Promise<void>> = [];

    if (this.config.enableMetrics) {
      this.metricsService.shutdown();
    }

    if (this.config.enableHealthChecks) {
      this.healthCheckService.shutdown();
    }

    if (this.config.enableTracing) {
      shutdownPromises.push(this.tracingService.shutdown());
    }

    if (this.config.enableAlerting) {
      shutdownPromises.push(this.alertingService.shutdown());
    }

    await Promise.allSettled(shutdownPromises);
    this.isInitialized = false;
  }

  /**
   * Check if monitoring is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const healthPromises = [];

      if (this.config.enableMetrics) {
        this.metricsService.isHealthy();
      }

      if (this.config.enableHealthChecks) {
        this.healthCheckService.isHealthy();
      }

      const results = await Promise.allSettled(healthPromises);
      return results.every((result) => result.status === 'fulfilled' && result.value === true);
    } catch (error) {
      this.logger.error('Failed to check monitoring health:', error);
      return false;
    }
  }
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  totalMemory: number;
  freeMemory: number;
  heapUsed: number;
  heapTotal: number;
  uptime: number;
}

export interface AlertCondition {
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  value: number;
  threshold: number;
  metadata?: Record<string, any>;
}

export interface MonitoringDashboard {
  systemMetrics: SystemMetrics | null;
  healthStatus: any;
  metricsData: any;
  configuration: MonitoringConfiguration;
  lastUpdated: Date;
}
