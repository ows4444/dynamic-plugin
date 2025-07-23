import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import * as winston from 'winston';
import { type LogContext, LogLevel, StructuredLoggerService } from './structured-logger.service';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    log: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
  })),
  format: {
    combine: jest.fn(() => 'combined-format'),
    colorize: jest.fn(() => 'colorize-format'),
    timestamp: jest.fn(() => 'timestamp-format'),
    printf: jest.fn(() => 'printf-format'),
    errors: jest.fn(() => 'errors-format'),
    json: jest.fn(() => 'json-format'),
  },
  transports: {
    console: jest.fn(),
    file: jest.fn(),
  },
}));

describe('StructuredLoggerService', () => {
  let service: StructuredLoggerService;
  let mockLogger: jest.Mocked<winston.Logger>;
  let _configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        switch (key) {
          case 'NODE_ENV':
            return 'test';
          case 'LOG_LEVEL':
            return 'info';
          default:
            return defaultValue;
        }
      }),
    };

    mockLogger = {
      log: jest.fn(),
      on: jest.fn(),
      end: jest.fn(),
    } as jest.Mocked<winston.Logger>;

    (winston.createLogger as jest.Mock).mockReturnValue(mockLogger);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: StructuredLoggerService,
          useFactory: (configService: ConfigService) => new StructuredLoggerService(configService, 'test-service'),
          inject: [ConfigService],
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StructuredLoggerService>(StructuredLoggerService);
    _configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('correlation ID management', () => {
    it('should set and get correlation ID', () => {
      const correlationId = 'test-correlation-id';
      service.setCorrelationId(correlationId);
      
      expect(service.getCorrelationId()).toBe(correlationId);
    });

    it('should generate new correlation ID', () => {
      const correlationId = service.generateCorrelationId();
      
      expect(correlationId).toBeDefined();
      expect(typeof correlationId).toBe('string');
      expect(service.getCorrelationId()).toBe(correlationId);
    });
  });

  describe('logging methods', () => {
    it('should log error messages', () => {
      const message = 'Test error message';
      const context: LogContext = { userId: 'user123' };
      
      service.error(message, new Error('Test error'), context);
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        LogLevel.ERROR,
        expect.objectContaining({
          level: LogLevel.ERROR,
          message,
          context: expect.objectContaining({
            userId: 'user123',
            stack: expect.any(String),
          }),
          service: 'test-service',
          environment: 'test',
        }),
      );
    });

    it('should log warning messages', () => {
      const message = 'Test warning message';
      const context: LogContext = { operation: 'test-operation' };
      
      service.warn(message, context);
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        LogLevel.WARN,
        expect.objectContaining({
          level: LogLevel.WARN,
          message,
          context: expect.objectContaining({
            operation: 'test-operation',
          }),
        }),
      );
    });

    it('should log info messages', () => {
      const message = 'Test info message';
      
      service.log(LogLevel.INFO, message);
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        expect.objectContaining({
          level: LogLevel.INFO,
          message,
        }),
      );
    });

    it('should log debug messages', () => {
      const message = 'Test debug message';
      const context: LogContext = { pluginId: 'plugin123' };
      
      service.debug(message, context);
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        LogLevel.DEBUG,
        expect.objectContaining({
          level: LogLevel.DEBUG,
          message,
          context: expect.objectContaining({
            pluginId: 'plugin123',
          }),
        }),
      );
    });
  });

  describe('specialized logging methods', () => {
    it('should log plugin events', () => {
      const pluginId = 'test-plugin';
      const event = 'plugin-loaded';
      const message = 'Plugin loaded successfully';
      const metadata = { version: '1.0.0' };
      
      service.logPluginEvent(pluginId, event, message, metadata);
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        expect.objectContaining({
          message,
          context: expect.objectContaining({
            pluginId,
            operation: event,
            metadata,
          }),
        }),
      );
    });

    it('should log performance metrics', () => {
      const operation = 'database-query';
      const duration = 150;
      const metadata = { query: 'SELECT * FROM users' };
      
      service.logPerformance(operation, duration, metadata);
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        expect.objectContaining({
          message: `Performance: ${operation}`,
          context: expect.objectContaining({
            operation,
            duration,
            metadata: expect.objectContaining({
              ...metadata,
              performanceLog: true,
            }),
          }),
        }),
      );
    });

    it('should log security events with correct severity', () => {
      const event = 'unauthorized-access';
      const message = 'Unauthorized access attempt';
      const severity = 'high';
      const metadata = { ip: '192.168.1.1' };
      
      service.logSecurityEvent(event, message, severity, metadata);
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        LogLevel.ERROR,
        expect.objectContaining({
          message: `Security: ${message}`,
          context: expect.objectContaining({
            operation: event,
            metadata: expect.objectContaining({
              ...metadata,
              securityEvent: true,
              severity,
            }),
          }),
        }),
      );
    });

    it('should log audit events', () => {
      const action = 'user-created';
      const resource = 'users';
      const userId = 'admin123';
      const metadata = { newUserId: 'user456' };
      
      service.logAudit(action, resource, userId, metadata);
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        expect.objectContaining({
          message: `Audit: ${action} on ${resource}`,
          context: expect.objectContaining({
            userId,
            operation: action,
            metadata: expect.objectContaining({
              ...metadata,
              auditLog: true,
              resource,
            }),
          }),
        }),
      );
    });
  });

  describe('child logger', () => {
    it('should create child logger with additional context', () => {
      const parentContext: LogContext = { pluginId: 'parent-plugin' };
      const childLogger = service.child(parentContext);
      
      expect(childLogger).toBeInstanceOf(StructuredLoggerService);
      
      // Test that child logger includes parent context
      childLogger.log(LogLevel.INFO, 'Child message', { userId: 'user123' });
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        expect.objectContaining({
          context: expect.objectContaining({
            pluginId: 'parent-plugin',
            userId: 'user123',
          }),
        }),
      );
    });
  });

  describe('flush', () => {
    it('should flush pending logs', async () => {
      const flushPromise = service.flush();
      
      // Simulate logger finish event
      const onCall = mockLogger.on.mock.calls.find((call: unknown[]) => call[0] === 'finish');
      if (onCall?.[1]) {
        onCall[1]();
      }
      
      await flushPromise;
      
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockLogger.on).toHaveBeenCalledWith('finish', expect.any(Function));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockLogger.end).toHaveBeenCalled();
    });
  });

  describe('context enrichment', () => {
    it('should enrich context with correlation ID', () => {
      const correlationId = 'test-correlation';
      service.setCorrelationId(correlationId);
      
      service.log(LogLevel.INFO, 'Test message');
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        expect.objectContaining({
          context: expect.objectContaining({
            correlationId,
            timestamp: expect.any(String),
          }),
        }),
      );
    });
  });
});