import { Module } from '@nestjs/common';
import { PrometheusMetricsService } from '@lib/shared/common';
import { HealthCheckService } from './health-check.service';
import { MetricsService } from './metrics.service';
import { AuditService } from './audit.service';
import { MetricsController } from './metrics.controller';
import { PluginRuntimeModule } from '../plugin-runtime/plugin-runtime.module';

@Module({
  imports: [PluginRuntimeModule],
  controllers: [MetricsController],
  providers: [HealthCheckService, MetricsService, AuditService, PrometheusMetricsService],
  exports: [HealthCheckService, MetricsService, AuditService, PrometheusMetricsService],
})
export class MonitoringModule {}
