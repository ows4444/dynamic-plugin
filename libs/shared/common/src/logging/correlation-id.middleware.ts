import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { StructuredLoggerService } from './structured-logger.service';

export interface RequestWithCorrelation extends Request {
  correlationId: string;
  logger: StructuredLoggerService;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLoggerService) {}

  use(req: RequestWithCorrelation, res: Response, next: NextFunction): void {
    // Extract correlation ID from headers or generate new one
    const correlationId = 
      req.headers['x-correlation-id'] as string ||
      req.headers['x-request-id'] as string ||
      uuidv4();

    // Set correlation ID in request
    req.correlationId = correlationId;
    
    // Create request-scoped logger
    const requestLogger = this.logger.child({
      correlationId,
      metadata: {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      },
    });

    req.logger = requestLogger;

    // Set correlation ID in response headers
    res.setHeader('x-correlation-id', correlationId);

    // Log incoming request
    requestLogger.http('Incoming request', {
      operation: 'http_request',
      metadata: {
        method: req.method,
        url: req.url,
        headers: this.sanitizeHeaders(req.headers),
        query: req.query,
        ip: req.ip,
      },
    });

    // Track request timing
    const startTime = Date.now();

    // Override res.end to log response
    const originalEnd = res.end.bind(res);
    res.end = function(...args: unknown[]): Response {
      const duration = Date.now() - startTime;
      
      requestLogger.http('Outgoing response', {
        operation: 'http_response',
        duration,
        metadata: {
          statusCode: res.statusCode,
          contentLength: res.get('content-length'),
          duration,
        },
      });

      // Log slow requests
      if (duration > 1000) {
        requestLogger.warn('Slow request detected', {
          operation: 'slow_request',
          duration,
          metadata: {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
          },
        });
      }

      // Call original end with all arguments (type assertion for complex overload)
      return (originalEnd as (...args: unknown[]) => Response).apply(this, args);
    };

    next();
  }

  private sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header] != null) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}