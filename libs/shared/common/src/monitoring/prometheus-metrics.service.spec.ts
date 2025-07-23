import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrometheusMetricsService } from './prometheus-metrics.service';

describe('PrometheusMetricsService', () => {
  let service: PrometheusMetricsService;
  let _configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        SERVICE_NAME: 'test-service',
        NODE_ENV: 'test',
        LOG_LEVEL: 'info',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrometheusMetricsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PrometheusMetricsService>(PrometheusMetricsService);
    _configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear metrics registry
    service.getRegistry().clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMetrics', () => {
    it('should return metrics in Prometheus format', async () => {
      const metrics = await service.getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
    });
  });

  describe('recordHttpRequest', () => {
    it('should record HTTP request metrics', () => {
      const method = 'GET';
      const route = '/api/plugins';
      const statusCode = 200;
      const duration = 150;
      const serviceName = 'test-service';

      expect(() => {
        service.recordHttpRequest(method, route, statusCode, duration, serviceName);
      }).not.toThrow();
    });

    it('should sanitize routes with dynamic segments', () => {
      const route = '/api/plugins/123/versions/1.0.0';
      
      expect(() => {
        service.recordHttpRequest('GET', route, 200, 100);
      }).not.toThrow();
    });
  });

  describe('recordPluginOperation', () => {
    it('should record plugin operation metrics', () => {
      const pluginId = 'test-plugin';
      const operation = 'install';
      const status = 'success';
      const duration = 2000;

      expect(() => {
        service.recordPluginOperation(pluginId, operation, status, duration);
      }).not.toThrow();
    });

    it('should handle failure status', () => {
      const pluginId = 'failing-plugin';
      const operation = 'start';
      const status = 'failure';
      const duration = 1000;

      expect(() => {
        service.recordPluginOperation(pluginId, operation, status, duration);
      }).not.toThrow();
    });

    it('should handle timeout status', () => {
      const pluginId = 'slow-plugin';
      const operation = 'load';
      const status = 'timeout';
      const duration = 30000;

      expect(() => {
        service.recordPluginOperation(pluginId, operation, status, duration);
      }).not.toThrow();
    });
  });

  describe('setActivePluginsCount', () => {
    it('should set active plugins count', () => {
      const count = 5;
      const serviceName = 'plugin-host';

      expect(() => {
        service.setActivePluginsCount(count, serviceName);
      }).not.toThrow();
    });

    it('should handle zero plugins', () => {
      expect(() => {
        service.setActivePluginsCount(0);
      }).not.toThrow();
    });
  });

  describe('recordCacheOperation', () => {
    it('should record cache hit', () => {
      expect(() => {
        service.recordCacheOperation('get', 'hit', 'cache-service');
      }).not.toThrow();
    });

    it('should record cache miss', () => {
      expect(() => {
        service.recordCacheOperation('get', 'miss', 'cache-service');
      }).not.toThrow();
    });

    it('should record cache set operation', () => {
      expect(() => {
        service.recordCacheOperation('set', 'success', 'cache-service');
      }).not.toThrow();
    });

    it('should record cache error', () => {
      expect(() => {
        service.recordCacheOperation('delete', 'error', 'cache-service');
      }).not.toThrow();
    });
  });

  describe('recordError', () => {
    it('should record low severity error', () => {
      expect(() => {
        service.recordError('validation_error', 'low', 'api-service');
      }).not.toThrow();
    });

    it('should record critical error', () => {
      expect(() => {
        service.recordError('database_connection_failed', 'critical', 'db-service');
      }).not.toThrow();
    });
  });

  describe('setDatabaseConnections', () => {
    it('should set database connection count', () => {
      expect(() => {
        service.setDatabaseConnections(10, 'postgresql', 'api-service');
      }).not.toThrow();
    });
  });

  describe('custom metrics creation', () => {
    it('should create custom counter', () => {
      const counter = service.createCounter('test_counter_total', 'Test counter', ['label1']);
      expect(counter).toBeDefined();
      
      counter.inc({ label1: 'value1' });
      expect(() => counter.get()).not.toThrow();
    });

    it('should create custom histogram', () => {
      const histogram = service.createHistogram(
        'test_histogram_duration', 
        'Test histogram', 
        ['operation'],
        [0.1, 1, 5, 10]
      );
      expect(histogram).toBeDefined();
      
      histogram.observe({ operation: 'test' }, 2.5);
      expect(() => histogram.get()).not.toThrow();
    });

    it('should create custom gauge', () => {
      const gauge = service.createGauge('test_gauge_value', 'Test gauge', ['type']);
      expect(gauge).toBeDefined();
      
      gauge.set({ type: 'memory' }, 1024);
      expect(() => gauge.get()).not.toThrow();
    });
  });

  describe('onModuleInit', () => {
    it('should initialize without errors', async () => {
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('should cleanup without errors', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('integration test', () => {
    it('should record multiple metrics and generate output', async () => {
      // Record various metrics
      service.recordHttpRequest('POST', '/api/plugins', 201, 250, 'registry');
      service.recordHttpRequest('GET', '/api/plugins/123', 200, 100, 'registry');
      service.recordPluginOperation('test-plugin', 'install', 'success', 3000, 'host');
      service.recordPluginOperation('test-plugin', 'start', 'success', 1000, 'host');
      service.setActivePluginsCount(2, 'host');
      service.recordCacheOperation('get', 'hit', 'cache');
      service.recordCacheOperation('set', 'success', 'cache');
      service.recordError('validation_error', 'low', 'api');
      service.setDatabaseConnections(5, 'postgres', 'registry');

      // Get metrics
      const metrics = await service.getMetrics();
      
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('plugin_operations_total');
      expect(metrics).toContain('active_plugins_count');
      expect(metrics).toContain('cache_operations_total');
      expect(metrics).toContain('errors_total');
      expect(metrics).toContain('database_connections_active');
    });
  });
});