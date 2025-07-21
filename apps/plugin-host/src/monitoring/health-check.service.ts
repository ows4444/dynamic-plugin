import { Injectable, Logger } from '@nestjs/common';
import { PluginInstanceService } from '../plugin-runtime/plugin-instance.service';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  details: HealthDetails;
  timestamp: Date;
}

export interface HealthDetails {
  plugins: PluginHealthSummary;
  system: SystemHealth;
  services: ServiceHealth[];
}

export interface PluginHealthSummary {
  total: number;
  healthy: number;
  unhealthy: number;
  unknown: number;
  details: PluginHealthDetail[];
}

export interface PluginHealthDetail {
  id: string;
  name: string;
  version: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  error?: string;
  responseTime?: number;
}

export interface SystemHealth {
  memory: MemoryUsage;
  cpu: CpuUsage;
  disk: DiskUsage;
  uptime: number;
}

export interface MemoryUsage {
  used: number;
  free: number;
  total: number;
  percentage: number;
}

export interface CpuUsage {
  percentage: number;
  loadAverage: number[];
}

export interface DiskUsage {
  used: number;
  free: number;
  total: number;
  percentage: number;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  lastCheck: Date;
  error?: string;
}

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private checkInterval: NodeJS.Timeout;
  private readonly checkIntervalMs = 30000; // 30 seconds

  constructor(private readonly instanceService: PluginInstanceService) {
    this.startPeriodicChecks();
  }

  async getOverallHealth(): Promise<HealthStatus> {
    const timestamp = new Date();

    try {
      const plugins = await this.checkPluginHealth();
      const system = await this.checkSystemHealth();
      const services = await this.checkServiceHealth();

      const overallStatus = this.determineOverallStatus(
        plugins,
        system,
        services,
      );

      return {
        status: overallStatus,
        details: {
          plugins,
          system,
          services,
        },
        timestamp,
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);

      return {
        status: 'unhealthy',
        details: {
          plugins: {
            total: 0,
            healthy: 0,
            unhealthy: 0,
            unknown: 0,
            details: [],
          },
          system: await this.getEmptySystemHealth(),
          services: [],
        },
        timestamp,
      };
    }
  }

  async checkPluginHealth(): Promise<PluginHealthSummary> {
    const instances = this.instanceService.getAllInstances();
    const details: PluginHealthDetail[] = [];

    let healthy = 0;
    let unhealthy = 0;
    let unknown = 0;

    for (const instance of instances) {
      try {
        const startTime = Date.now();
        await this.instanceService.updateInstanceHealth(instance.id);
        const responseTime = Date.now() - startTime;

        const healthDetail: PluginHealthDetail = {
          id: instance.id,
          name: instance.name,
          version: instance.version,
          status: instance.health,
          lastCheck: new Date(),
          responseTime,
        };

        if (instance.health === 'healthy') {
          healthy++;
        } else if (instance.health === 'unhealthy') {
          unhealthy++;
          healthDetail.error = 'Health check failed';
        } else {
          unknown++;
        }

        details.push(healthDetail);
      } catch (error) {
        unhealthy++;
        details.push({
          id: instance.id,
          name: instance.name,
          version: instance.version,
          status: 'unhealthy',
          lastCheck: new Date(),
          error: error.message,
        });
      }
    }

    return {
      total: instances.length,
      healthy,
      unhealthy,
      unknown,
      details,
    };
  }

  async checkSystemHealth(): Promise<SystemHealth> {
    const _memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    // Memory usage
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const usedMemory = totalMemory - freeMemory;

    const memory: MemoryUsage = {
      used: usedMemory,
      free: freeMemory,
      total: totalMemory,
      percentage: (usedMemory / totalMemory) * 100,
    };

    // CPU usage
    const loadAverage = require('os').loadavg();
    const cpu: CpuUsage = {
      percentage: (cpuUsage.user + cpuUsage.system) / 1000, // Convert to percentage
      loadAverage,
    };

    // Disk usage (simplified - would need more sophisticated implementation)
    const disk: DiskUsage = {
      used: 0,
      free: 0,
      total: 0,
      percentage: 0,
    };

    return Promise.resolve({
      memory,
      cpu,
      disk,
      uptime,
    });
  }

  async checkServiceHealth(): Promise<ServiceHealth[]> {
    const services: ServiceHealth[] = [];

    try {
      const databaseHealth = await this.checkDatabaseHealth();
      services.push(databaseHealth);
    } catch (error) {
      services.push({
        name: 'database',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error.message,
      });
    }

    try {
      const cacheHealth = await this.checkCacheHealth();
      services.push(cacheHealth);
    } catch (error) {
      services.push({
        name: 'cache',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error.message,
      });
    }

    return services;
  }

  private checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    // Placeholder for database health check
    // In real implementation, this would ping the database

    return Promise.resolve({
      name: 'database',
      status: 'healthy',
      responseTime: Date.now() - startTime,
      lastCheck: new Date(),
    });
  }

  private async checkCacheHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    // Placeholder for cache health check
    // In real implementation, this would check cache connectivity

    return Promise.resolve({
      name: 'cache',
      status: 'healthy',
      responseTime: Date.now() - startTime,
      lastCheck: new Date(),
    });
  }

  private determineOverallStatus(
    plugins: PluginHealthSummary,
    system: SystemHealth,
    services: ServiceHealth[],
  ): 'healthy' | 'unhealthy' | 'degraded' {
    const unhealthyServices = services.filter(
      (s) => s.status === 'unhealthy',
    ).length;

    if (unhealthyServices > 0 || plugins.unhealthy > 0) {
      return plugins.unhealthy > plugins.healthy ? 'unhealthy' : 'degraded';
    }

    if (system.memory.percentage > 90 || system.cpu.percentage > 90) {
      return 'degraded';
    }

    return 'healthy';
  }

  private async getEmptySystemHealth(): Promise<SystemHealth> {
    return Promise.resolve({
      memory: { used: 0, free: 0, total: 0, percentage: 0 },
      cpu: { percentage: 0, loadAverage: [0, 0, 0] },
      disk: { used: 0, free: 0, total: 0, percentage: 0 },
      uptime: 0,
    });
  }

  private startPeriodicChecks(): void {
    this.checkInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        this.logger.error(`Periodic health check failed: ${error.message}`);
      });
    }, this.checkIntervalMs);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.getOverallHealth();
      if (health.status !== 'healthy') {
        this.logger.warn(`System health status: ${health.status}`);
      }
    } catch (error) {
      this.logger.error(`Periodic health check failed: ${error.message}`);
    }
  }

  onApplicationShutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.logger.log('Health check service shutdown complete');
  }
}
