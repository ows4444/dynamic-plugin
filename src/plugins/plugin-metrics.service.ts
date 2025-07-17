import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface PluginMetrics {
  pluginId: string;
  performance: PerformanceMetrics;
  resource: ResourceMetrics;
  errors: ErrorMetrics;
  usage: UsageMetrics;
  timestamp: Date;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  successRate: number;
}

export interface ResourceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  fileDescriptors: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number;
  criticalErrors: number;
  warningCount: number;
  lastError: Date | null;
  errorsByType: Record<string, number>;
}

export interface UsageMetrics {
  requestCount: number;
  activeUsers: number;
  sessionsCreated: number;
  featuresUsed: string[];
  apiCallsCount: number;
  peakConcurrentUsers: number;
  dataTransferred: number;
  cacheHitRate: number;
  averageSessionDuration: number;
}

@Injectable()
export class PluginMetricsService {
  private readonly logger = new Logger(PluginMetricsService.name);
  private readonly metrics = new Map<string, PluginMetrics>();
  private readonly responseTimes = new Map<string, number[]>();
  private readonly errorCounts = new Map<string, Map<string, number>>();
  private readonly userSessions = new Map<string, Map<string, Date>>();
  private readonly featureUsage = new Map<string, Map<string, number>>();
  private readonly alertThresholds = new Map<string, any>();
  private readonly metricsHistory = new Map<string, PluginMetrics[]>();
  private metricsInterval: NodeJS.Timeout;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.startMetricsCollection();
  }

  async collectMetrics(pluginId: string): Promise<PluginMetrics> {
    const existing = this.metrics.get(pluginId);
    
    const metrics: PluginMetrics = {
      pluginId,
      performance: await this.getPerformanceMetrics(pluginId),
      resource: await this.getResourceMetrics(pluginId),
      errors: await this.getErrorMetrics(pluginId),
      usage: await this.getUsageMetrics(pluginId),
      timestamp: new Date()
    };

    this.metrics.set(pluginId, metrics);
    
    // Store in history
    if (!this.metricsHistory.has(pluginId)) {
      this.metricsHistory.set(pluginId, []);
    }
    const history = this.metricsHistory.get(pluginId);
    history.push(metrics);
    
    // Keep only last 24 hours of data (assuming 1 minute intervals)
    if (history.length > 1440) {
      history.shift();
    }
    
    // Check alerts
    this.checkAlerts(pluginId, metrics);
    
    this.emitMetricsEvent(pluginId, metrics);
    
    return metrics;
  }

  recordResponseTime(pluginId: string, responseTime: number): void {
    if (!this.responseTimes.has(pluginId)) {
      this.responseTimes.set(pluginId, []);
    }
    
    const times = this.responseTimes.get(pluginId);
    times.push(responseTime);
    
    // Keep only last 1000 response times
    if (times.length > 1000) {
      times.shift();
    }
  }

  recordError(pluginId: string, errorType: string): void {
    if (!this.errorCounts.has(pluginId)) {
      this.errorCounts.set(pluginId, new Map());
    }
    
    const errors = this.errorCounts.get(pluginId);
    const currentCount = errors.get(errorType) || 0;
    errors.set(errorType, currentCount + 1);
    
    this.logger.warn(`Error recorded for plugin ${pluginId}: ${errorType}`);
  }

  recordRequest(pluginId: string, userId?: string): void {
    const metrics = this.metrics.get(pluginId);
    if (metrics) {
      metrics.usage.requestCount++;
      metrics.usage.apiCallsCount++;
      
      if (userId) {
        // Track active users (simplified)
        metrics.usage.activeUsers++;
      }
    }
  }

  getPluginMetrics(pluginId: string): PluginMetrics | undefined {
    return this.metrics.get(pluginId);
  }

  getAllMetrics(): PluginMetrics[] {
    return Array.from(this.metrics.values());
  }

  resetMetrics(pluginId: string): void {
    this.metrics.delete(pluginId);
    this.responseTimes.delete(pluginId);
    this.errorCounts.delete(pluginId);
    this.userSessions.delete(pluginId);
    this.featureUsage.delete(pluginId);
    this.metricsHistory.delete(pluginId);
    this.logger.log(`Metrics reset for plugin: ${pluginId}`);
  }

  recordUserSession(pluginId: string, userId: string): void {
    if (!this.userSessions.has(pluginId)) {
      this.userSessions.set(pluginId, new Map());
    }
    
    const sessions = this.userSessions.get(pluginId);
    sessions.set(userId, new Date());
  }

  recordFeatureUsage(pluginId: string, feature: string): void {
    if (!this.featureUsage.has(pluginId)) {
      this.featureUsage.set(pluginId, new Map());
    }
    
    const features = this.featureUsage.get(pluginId);
    const currentCount = features.get(feature) || 0;
    features.set(feature, currentCount + 1);
  }

  setAlertThreshold(pluginId: string, metric: string, threshold: any): void {
    if (!this.alertThresholds.has(pluginId)) {
      this.alertThresholds.set(pluginId, {});
    }
    
    const thresholds = this.alertThresholds.get(pluginId);
    thresholds[metric] = threshold;
    
    this.logger.log(`Alert threshold set for ${pluginId}.${metric}: ${JSON.stringify(threshold)}`);
  }

  getMetricsHistory(pluginId: string, hours: number = 24): PluginMetrics[] {
    const history = this.metricsHistory.get(pluginId) || [];
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return history.filter(metrics => metrics.timestamp >= cutoff);
  }

  getAggregatedMetrics(pluginIds: string[]): any {
    const aggregated = {
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      totalMemoryUsage: 0,
      totalCpuUsage: 0,
      plugins: pluginIds.length
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const pluginId of pluginIds) {
      const metrics = this.metrics.get(pluginId);
      if (metrics) {
        aggregated.totalRequests += metrics.usage.requestCount;
        aggregated.totalErrors += metrics.errors.totalErrors;
        aggregated.totalMemoryUsage += metrics.resource.memoryUsage;
        aggregated.totalCpuUsage += metrics.resource.cpuUsage;
        
        if (metrics.performance.averageResponseTime > 0) {
          totalResponseTime += metrics.performance.averageResponseTime;
          responseTimeCount++;
        }
      }
    }

    aggregated.averageResponseTime = responseTimeCount > 0 
      ? totalResponseTime / responseTimeCount 
      : 0;

    return aggregated;
  }

  generateHealthReport(pluginId: string): any {
    const metrics = this.metrics.get(pluginId);
    if (!metrics) {
      return { status: 'no_data', score: 0 };
    }

    let score = 100;
    const issues = [];

    // Check error rate
    if (metrics.errors.errorRate > 5) {
      score -= 20;
      issues.push(`High error rate: ${metrics.errors.errorRate}%`);
    }

    // Check response time
    if (metrics.performance.averageResponseTime > 1000) {
      score -= 15;
      issues.push(`Slow response time: ${metrics.performance.averageResponseTime}ms`);
    }

    // Check memory usage (assuming 100MB is high)
    if (metrics.resource.memoryUsage > 100 * 1024 * 1024) {
      score -= 10;
      issues.push(`High memory usage: ${(metrics.resource.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
    }

    // Check CPU usage
    if (metrics.resource.cpuUsage > 80) {
      score -= 15;
      issues.push(`High CPU usage: ${metrics.resource.cpuUsage}%`);
    }

    // Check success rate
    if (metrics.performance.successRate < 95) {
      score -= 20;
      issues.push(`Low success rate: ${metrics.performance.successRate}%`);
    }

    const status = score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical';

    return {
      status,
      score: Math.max(0, score),
      issues,
      timestamp: new Date(),
      metrics
    };
  }

  private async getPerformanceMetrics(pluginId: string): Promise<PerformanceMetrics> {
    const responseTimes = this.responseTimes.get(pluginId) || [];
    
    if (responseTimes.length === 0) {
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        successRate: 100
      };
    }

    const sorted = [...responseTimes].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      averageResponseTime: sum / sorted.length,
      p95ResponseTime: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)] || 0,
      throughput: sorted.length,
      successRate: this.calculateSuccessRate(pluginId)
    };
  }

  private async getResourceMetrics(pluginId: string): Promise<ResourceMetrics> {
    // In a real implementation, this would collect actual resource usage
    // For now, we'll return mock data
    return {
      memoryUsage: Math.floor(Math.random() * 100) * 1024 * 1024, // Random MB
      cpuUsage: Math.floor(Math.random() * 100), // Random percentage
      diskUsage: Math.floor(Math.random() * 1000) * 1024 * 1024, // Random MB
      networkIn: Math.floor(Math.random() * 1000) * 1024, // Random KB
      networkOut: Math.floor(Math.random() * 1000) * 1024, // Random KB
      fileDescriptors: Math.floor(Math.random() * 100)
    };
  }

  private async getErrorMetrics(pluginId: string): Promise<ErrorMetrics> {
    const errors = this.errorCounts.get(pluginId) || new Map();
    const errorsByType: Record<string, number> = {};
    let totalErrors = 0;
    let criticalErrors = 0;
    let warningCount = 0;

    for (const [type, count] of errors.entries()) {
      errorsByType[type] = count;
      totalErrors += count;
      
      if (type.toLowerCase().includes('critical') || type.toLowerCase().includes('fatal')) {
        criticalErrors += count;
      } else if (type.toLowerCase().includes('warning') || type.toLowerCase().includes('warn')) {
        warningCount += count;
      }
    }

    const requestCount = this.metrics.get(pluginId)?.usage.requestCount || 0;
    const errorRate = requestCount > 0 ? (totalErrors / requestCount) * 100 : 0;

    return {
      totalErrors,
      errorRate,
      criticalErrors,
      warningCount,
      lastError: totalErrors > 0 ? new Date() : null,
      errorsByType
    };
  }

  private async getUsageMetrics(pluginId: string): Promise<UsageMetrics> {
    const existing = this.metrics.get(pluginId);
    const sessions = this.userSessions.get(pluginId) || new Map();
    const features = this.featureUsage.get(pluginId) || new Map();
    
    // Calculate active users (users active in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const activeUsers = Array.from(sessions.values())
      .filter(lastActivity => lastActivity >= oneHourAgo).length;
    
    // Calculate peak concurrent users (simplified)
    const peakConcurrentUsers = Math.max(activeUsers, existing?.usage.peakConcurrentUsers || 0);
    
    return {
      requestCount: existing?.usage.requestCount || 0,
      activeUsers,
      sessionsCreated: sessions.size,
      featuresUsed: Array.from(features.keys()),
      apiCallsCount: existing?.usage.apiCallsCount || 0,
      peakConcurrentUsers,
      dataTransferred: existing?.usage.dataTransferred || 0,
      cacheHitRate: existing?.usage.cacheHitRate || 0,
      averageSessionDuration: existing?.usage.averageSessionDuration || 0
    };
  }

  private calculateSuccessRate(pluginId: string): number {
    const errors = this.errorCounts.get(pluginId) || new Map();
    const totalErrors = Array.from(errors.values()).reduce((sum, count) => sum + count, 0);
    const requestCount = this.metrics.get(pluginId)?.usage.requestCount || 0;
    
    if (requestCount === 0) {
      return 100;
    }
    
    return ((requestCount - totalErrors) / requestCount) * 100;
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      const pluginIds = Array.from(this.metrics.keys());
      
      for (const pluginId of pluginIds) {
        try {
          await this.collectMetrics(pluginId);
        } catch (error) {
          this.logger.error(`Failed to collect metrics for plugin ${pluginId}:`, error);
        }
      }
    }, 60000); // Collect every minute
  }

  private checkAlerts(pluginId: string, metrics: PluginMetrics): void {
    const thresholds = this.alertThresholds.get(pluginId);
    if (!thresholds) return;

    const alerts = [];

    // Check error rate
    if (thresholds.errorRate && metrics.errors.errorRate > thresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        message: `Error rate ${metrics.errors.errorRate}% exceeds threshold ${thresholds.errorRate}%`,
        severity: 'high'
      });
    }

    // Check response time
    if (thresholds.responseTime && metrics.performance.averageResponseTime > thresholds.responseTime) {
      alerts.push({
        type: 'response_time',
        message: `Response time ${metrics.performance.averageResponseTime}ms exceeds threshold ${thresholds.responseTime}ms`,
        severity: 'medium'
      });
    }

    // Check memory usage
    if (thresholds.memoryUsage && metrics.resource.memoryUsage > thresholds.memoryUsage) {
      alerts.push({
        type: 'memory_usage',
        message: `Memory usage ${(metrics.resource.memoryUsage / 1024 / 1024).toFixed(1)}MB exceeds threshold`,
        severity: 'high'
      });
    }

    // Check CPU usage
    if (thresholds.cpuUsage && metrics.resource.cpuUsage > thresholds.cpuUsage) {
      alerts.push({
        type: 'cpu_usage',
        message: `CPU usage ${metrics.resource.cpuUsage}% exceeds threshold ${thresholds.cpuUsage}%`,
        severity: 'high'
      });
    }

    // Emit alerts
    for (const alert of alerts) {
      this.eventEmitter.emit('plugin.metrics.alert', {
        pluginId,
        alert,
        metrics,
        timestamp: new Date()
      });
    }
  }

  private emitMetricsEvent(pluginId: string, metrics: PluginMetrics): void {
    this.eventEmitter.emit('plugin.metrics.collected', {
      pluginId,
      metrics,
      timestamp: new Date()
    });
  }

  recordPluginLoad(pluginId: string, loadTime: number, success: boolean): void {
    this.recordResponseTime(pluginId, loadTime);
    if (!success) {
      this.recordError(pluginId, 'load_error');
    }
  }

  recordPluginUnload(pluginId: string, unloadTime: number, success: boolean): void {
    this.recordResponseTime(pluginId, unloadTime);
    if (!success) {
      this.recordError(pluginId, 'unload_error');
    }
  }

  recordPluginReload(pluginId: string, reloadTime: number, success: boolean): void {
    this.recordResponseTime(pluginId, reloadTime);
    if (!success) {
      this.recordError(pluginId, 'reload_error');
    }
  }

  recordPluginUpdate(pluginId: string, updateTime: number, success: boolean): void {
    this.recordResponseTime(pluginId, updateTime);
    if (!success) {
      this.recordError(pluginId, 'update_error');
    }
  }

  recordPluginDisable(pluginId: string, disableTime: number, success: boolean): void {
    this.recordResponseTime(pluginId, disableTime);
    if (!success) {
      this.recordError(pluginId, 'disable_error');
    }
  }

  recordPluginExecution(pluginId: string, methodName: string, executionTime: number, success: boolean): void {
    this.recordResponseTime(pluginId, executionTime);
    this.recordFeatureUsage(pluginId, methodName);
    if (!success) {
      this.recordError(pluginId, `execution_error_${methodName}`);
    }
  }

  recordHealthCheck(pluginId: string, checkTime: number, status: string): void {
    this.recordResponseTime(pluginId, checkTime);
    if (status === 'unhealthy') {
      this.recordError(pluginId, 'health_check_failed');
    }
  }

  onModuleDestroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }
}