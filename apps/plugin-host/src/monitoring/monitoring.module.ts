import { Module } from '@nestjs/common';
import { HealthCheckService } from './health-check.service';
import { MetricsService } from './metrics.service';
import { AuditService } from './audit.service';
import { PluginRuntimeModule } from '../plugin-runtime/plugin-runtime.module';

@Module({
  imports: [PluginRuntimeModule],
  providers: [HealthCheckService, MetricsService, AuditService],
  exports: [HealthCheckService, MetricsService, AuditService],
})
export class MonitoringModule {}
