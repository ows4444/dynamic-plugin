import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import * as process from 'process';

export interface PerformanceMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    used: number;
    free: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    percentage: number;
  };
  network: {
    connections: number;
    activeRequests: number;
  };
  custom: Record<string, number>;
}

export interface ApplicationMetrics {
  uptime: number;
  version: string;
  environment: string;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  peakMemoryUsage: number;
  totalPluginsLoaded: number;
  activePlugins: number;
}

export interface PluginMetrics {
  pluginId: string;
  loadTime: number;
  executionTime: number;
  memoryUsage: number;
  errorCount: number;
  requestCount: number;
  lastActivity: Date;
  status: 'active' | 'idle' | 'error';
}

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  private readonly metrics: PerformanceMetrics[] = [];
  private readonly applicationMetrics: ApplicationMetrics;
  private readonly pluginMetrics = new Map<string, PluginMetrics>();
  private readonly maxMetricsHistory = 1000;
  private readonly customMetrics = new Map<string, number>();
  private readonly requestTimes: number[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private startTime = Date.now();

  constructor(private readonly configService: ConfigService) {
    this.applicationMetrics = {
      uptime: 0,
      version: this.configService.get('npm_package_version', '1.0.0'),
      environment: this.configService.get('NODE_ENV', 'development'),
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      peakMemoryUsage: 0,
      totalPluginsLoaded: 0,
      activePlugins: 0,
    };

    this.startMonitoring();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs = 30000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    this.logger.log('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.logger.log('Performance monitoring stopped');
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return {
      timestamp: new Date(),
      cpu: this.getCpuMetrics(),
      memory: this.getMemoryMetrics(),
      network: this.getNetworkMetrics(),
      custom: Object.fromEntries(this.customMetrics),
    };
  }

  /**
   * Get application metrics
   */
  getApplicationMetrics(): ApplicationMetrics {
    this.applicationMetrics.uptime = Date.now() - this.startTime;
    this.applicationMetrics.averageResponseTime = this.calculateAverageResponseTime();
    this.applicationMetrics.activePlugins = Array.from(this.pluginMetrics.values())
      .filter(plugin => plugin.status === 'active').length;

    return { ...this.applicationMetrics };
  }

  /**
   * Get plugin-specific metrics
   */
  getPluginMetrics(pluginId?: string): PluginMetrics | PluginMetrics[] {
    if (pluginId) {
      return this.pluginMetrics.get(pluginId) || this.createEmptyPluginMetrics(pluginId);
    }

    return Array.from(this.pluginMetrics.values());
  }

  /**
   * Track plugin performance
   */
  trackPluginExecution(pluginId: string, executionTime: number, memoryUsage?: number): void {
    const existing = this.pluginMetrics.get(pluginId) || this.createEmptyPluginMetrics(pluginId);
    
    existing.executionTime = (existing.executionTime + executionTime) / 2; // Moving average
    existing.requestCount++;
    existing.lastActivity = new Date();
    existing.status = 'active';

    if (memoryUsage) {
      existing.memoryUsage = memoryUsage;
    }

    this.pluginMetrics.set(pluginId, existing);
  }

  /**
   * Track plugin load time
   */
  trackPluginLoad(pluginId: string, loadTime: number): void {
    const existing = this.pluginMetrics.get(pluginId) || this.createEmptyPluginMetrics(pluginId);
    existing.loadTime = loadTime;
    this.pluginMetrics.set(pluginId, existing);
    this.applicationMetrics.totalPluginsLoaded++;
  }

  /**
   * Track plugin error
   */
  trackPluginError(pluginId: string): void {
    const existing = this.pluginMetrics.get(pluginId) || this.createEmptyPluginMetrics(pluginId);
    existing.errorCount++;
    existing.status = 'error';
    this.pluginMetrics.set(pluginId, existing);
    this.applicationMetrics.errorCount++;
  }

  /**
   * Track HTTP request
   */
  trackRequest(responseTime: number): void {
    this.applicationMetrics.requestCount++;
    this.requestTimes.push(responseTime);

    // Keep only recent request times
    if (this.requestTimes.length > 100) {
      this.requestTimes.shift();
    }
  }

  /**
   * Set custom metric
   */
  setCustomMetric(name: string, value: number): void {
    this.customMetrics.set(name, value);
  }

  /**
   * Increment custom metric
   */
  incrementCustomMetric(name: string, increment = 1): void {
    const current = this.customMetrics.get(name) || 0;
    this.customMetrics.set(name, current + increment);
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: ApplicationMetrics;
    currentPerformance: PerformanceMetrics;
    pluginPerformance: PluginMetrics[];
    alerts: string[];
    recommendations: string[];
  } {
    const currentMetrics = this.getCurrentMetrics();
    const appMetrics = this.getApplicationMetrics();
    const pluginMetrics = this.getPluginMetrics() as PluginMetrics[];

    const alerts = this.generateAlerts(currentMetrics, appMetrics, pluginMetrics);
    const recommendations = this.generateRecommendations(currentMetrics, appMetrics, pluginMetrics);

    return {
      summary: appMetrics,
      currentPerformance: currentMetrics,
      pluginPerformance: pluginMetrics,
      alerts,
      recommendations,
    };
  }

  /**
   * Check system health
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; message: string }>;
  } {
    const checks = [];
    let score = 100;

    // CPU check
    const cpuUsage = this.getCpuMetrics().usage;
    if (cpuUsage > 90) {
      checks.push({ name: 'CPU Usage', status: 'fail', message: `High CPU usage: ${cpuUsage.toFixed(1)}%` });
      score -= 30;
    } else if (cpuUsage > 70) {
      checks.push({ name: 'CPU Usage', status: 'warn', message: `Elevated CPU usage: ${cpuUsage.toFixed(1)}%` });
      score -= 15;
    } else {
      checks.push({ name: 'CPU Usage', status: 'pass', message: `CPU usage normal: ${cpuUsage.toFixed(1)}%` });
    }

    // Memory check
    const memoryMetrics = this.getMemoryMetrics();
    if (memoryMetrics.percentage > 90) {
      checks.push({ name: 'Memory Usage', status: 'fail', message: `High memory usage: ${memoryMetrics.percentage.toFixed(1)}%` });
      score -= 30;
    } else if (memoryMetrics.percentage > 75) {
      checks.push({ name: 'Memory Usage', status: 'warn', message: `Elevated memory usage: ${memoryMetrics.percentage.toFixed(1)}%` });
      score -= 15;
    } else {
      checks.push({ name: 'Memory Usage', status: 'pass', message: `Memory usage normal: ${memoryMetrics.percentage.toFixed(1)}%` });
    }

    // Error rate check
    const errorRate = this.calculateErrorRate();
    if (errorRate > 10) {
      checks.push({ name: 'Error Rate', status: 'fail', message: `High error rate: ${errorRate.toFixed(1)}%` });
      score -= 25;
    } else if (errorRate > 5) {
      checks.push({ name: 'Error Rate', status: 'warn', message: `Elevated error rate: ${errorRate.toFixed(1)}%` });
      score -= 10;
    } else {
      checks.push({ name: 'Error Rate', status: 'pass', message: `Error rate normal: ${errorRate.toFixed(1)}%` });
    }

    // Response time check
    const avgResponseTime = this.calculateAverageResponseTime();
    if (avgResponseTime > 2000) {
      checks.push({ name: 'Response Time', status: 'fail', message: `Slow response time: ${avgResponseTime.toFixed(0)}ms` });
      score -= 20;
    } else if (avgResponseTime > 1000) {
      checks.push({ name: 'Response Time', status: 'warn', message: `Elevated response time: ${avgResponseTime.toFixed(0)}ms` });
      score -= 10;
    } else {
      checks.push({ name: 'Response Time', status: 'pass', message: `Response time good: ${avgResponseTime.toFixed(0)}ms` });
    }

    let status: 'healthy' | 'warning' | 'critical';
    if (score >= 80) {
      status = 'healthy';
    } else if (score >= 60) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    return { status, score, checks };
  }

  private collectMetrics(): void {
    const metrics = this.getCurrentMetrics();
    this.metrics.push(metrics);

    // Update peak memory usage
    if (metrics.memory.percentage > this.applicationMetrics.peakMemoryUsage) {
      this.applicationMetrics.peakMemoryUsage = metrics.memory.percentage;
    }

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    // Update plugin statuses
    this.updatePluginStatuses();
  }

  private getCpuMetrics() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // Calculate CPU usage (simplified)
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return {
      usage,
      loadAverage: loadAvg,
      cores: cpus.length,
    };
  }

  private getMemoryMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = process.memoryUsage();

    return {
      used: usedMemory,
      free: freeMemory,
      total: totalMemory,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      percentage: (usedMemory / totalMemory) * 100,
    };
  }

  private getNetworkMetrics() {
    // Simplified network metrics
    // In a real implementation, you'd track actual network connections
    return {
      connections: 0,
      activeRequests: 0,
    };
  }

  private calculateAverageResponseTime(): number {
    if (this.requestTimes.length === 0) return 0;
    return this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length;
  }

  private calculateErrorRate(): number {
    if (this.applicationMetrics.requestCount === 0) return 0;
    return (this.applicationMetrics.errorCount / this.applicationMetrics.requestCount) * 100;
  }

  private createEmptyPluginMetrics(pluginId: string): PluginMetrics {
    return {
      pluginId,
      loadTime: 0,
      executionTime: 0,
      memoryUsage: 0,
      errorCount: 0,
      requestCount: 0,
      lastActivity: new Date(),
      status: 'idle',
    };
  }

  private updatePluginStatuses(): void {
    const now = Date.now();
    const idleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [pluginId, metrics] of this.pluginMetrics) {
      if (metrics.status === 'active' && now - metrics.lastActivity.getTime() > idleThreshold) {
        metrics.status = 'idle';
      }
    }
  }

  private generateAlerts(
    currentMetrics: PerformanceMetrics,
    appMetrics: ApplicationMetrics,
    pluginMetrics: PluginMetrics[],
  ): string[] {
    const alerts = [];

    // High CPU usage alert
    if (currentMetrics.cpu.usage > 85) {
      alerts.push(`HIGH CPU USAGE: ${currentMetrics.cpu.usage.toFixed(1)}% - Consider scaling or optimizing`);
    }

    // High memory usage alert
    if (currentMetrics.memory.percentage > 85) {
      alerts.push(`HIGH MEMORY USAGE: ${currentMetrics.memory.percentage.toFixed(1)}% - Memory leak possible`);
    }

    // High error rate alert
    const errorRate = this.calculateErrorRate();
    if (errorRate > 5) {
      alerts.push(`HIGH ERROR RATE: ${errorRate.toFixed(1)}% - Check application logs`);
    }

    // Slow response time alert
    if (appMetrics.averageResponseTime > 1500) {
      alerts.push(`SLOW RESPONSE TIME: ${appMetrics.averageResponseTime.toFixed(0)}ms - Performance degradation detected`);
    }

    // Plugin errors alert
    const errorPlugins = pluginMetrics.filter(p => p.errorCount > 5);
    if (errorPlugins.length > 0) {
      alerts.push(`PLUGIN ERRORS: ${errorPlugins.length} plugins with high error rates`);
    }

    return alerts;
  }

  private generateRecommendations(
    currentMetrics: PerformanceMetrics,
    appMetrics: ApplicationMetrics,
    pluginMetrics: PluginMetrics[],
  ): string[] {
    const recommendations = [];

    // CPU recommendations
    if (currentMetrics.cpu.usage > 70) {
      recommendations.push('Consider implementing request throttling or scaling horizontally');
    }

    // Memory recommendations
    if (currentMetrics.memory.percentage > 70) {
      recommendations.push('Monitor for memory leaks and consider garbage collection tuning');
    }

    // Plugin recommendations
    const slowPlugins = pluginMetrics.filter(p => p.executionTime > 1000);
    if (slowPlugins.length > 0) {
      recommendations.push(`Optimize ${slowPlugins.length} slow-performing plugins`);
    }

    // Response time recommendations
    if (appMetrics.averageResponseTime > 800) {
      recommendations.push('Implement response caching and database query optimization');
    }

    // Load balancing recommendations
    if (appMetrics.requestCount > 1000 && currentMetrics.cpu.usage > 60) {
      recommendations.push('Consider implementing load balancing for better performance');
    }

    return recommendations;
  }
}