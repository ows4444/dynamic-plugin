import { Global, Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from './metrics.service';
import { HealthCheckService } from './health-check.service';
import { TracingService } from './tracing.service';
import { AlertingService } from './alerting.service';

/**
 * Global monitoring module providing comprehensive observability
 * Includes metrics collection, health checks, tracing, and alerting
 */
@Global()
@Module({
  providers: [MonitoringService, MetricsService, HealthCheckService, TracingService, AlertingService],
  exports: [MonitoringService, MetricsService, HealthCheckService, TracingService, AlertingService],
})
export class MonitoringModule {}
