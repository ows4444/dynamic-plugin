import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PerformanceMonitorService } from './performance-monitor.service';
import { MetricsCollectorService } from './metrics-collector.service';

@Global()
@Module({
  providers: [
    PerformanceMonitorService,
    {
      provide: MetricsCollectorService,
      useFactory: (
        configService: ConfigService,
        performanceMonitor: PerformanceMonitorService,
      ) => {
        return new MetricsCollectorService(configService, performanceMonitor);
      },
      inject: [ConfigService, PerformanceMonitorService],
    },
  ],
  exports: [PerformanceMonitorService, MetricsCollectorService],
})
export class MonitoringModule {}