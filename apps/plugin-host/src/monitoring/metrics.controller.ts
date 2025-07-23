import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrometheusMetricsService } from '@lib/shared/common';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly prometheusMetricsService: PrometheusMetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description: 'Returns metrics in Prometheus format for scraping',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics data in Prometheus format',
    content: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'text/plain': {
        example: `# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="get",route="/api/plugins",status_code="200",service="plugin-host"} 42

# HELP http_request_duration_ms HTTP request duration in milliseconds  
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{method="get",route="/api/plugins",status_code="200",service="plugin-host",le="0.1"} 0
http_request_duration_ms_bucket{method="get",route="/api/plugins",status_code="200",service="plugin-host",le="5"} 5
http_request_duration_ms_bucket{method="get",route="/api/plugins",status_code="200",service="plugin-host",le="15"} 15`,
      },
    },
  })
  async getMetrics(): Promise<string> {
    return this.prometheusMetricsService.getMetrics();
  }
}