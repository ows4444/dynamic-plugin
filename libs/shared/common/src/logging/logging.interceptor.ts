import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { StructuredLoggerService } from './structured-logger.service';
import { RequestWithCorrelation } from './correlation-id.middleware';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType();

    if (contextType === 'http') {
      return this.handleHttpRequest(context, next);
    }

    return next.handle();
  }

  private handleHttpRequest(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithCorrelation>();
    const handler = context.getHandler();
    const controller = context.getClass();
    
    const methodName = handler.name;
    const controllerName = controller.name;
    const operationName = `${controllerName}.${methodName}`;

    const startTime = Date.now();
    
    // Get request-scoped logger from middleware
    const requestLogger = request.logger || this.logger;

    requestLogger.debug(`Executing ${operationName}`, {
      operation: operationName,
      metadata: {
        controller: controllerName,
        handler: methodName,
        method: request.method,
        url: request.url,
      },
    });

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - startTime;
        
        requestLogger.debug(`Completed ${operationName}`, {
          operation: operationName,
          duration,
          metadata: {
            controller: controllerName,
            handler: methodName,
            responseSize: response ? JSON.stringify(response).length : 0,
            success: true,
          },
        });

        // Log performance metrics for slow operations
        if (duration > 500) {
          requestLogger.logPerformance(operationName, duration, {
            controller: controllerName,
            handler: methodName,
            responseSize: response ? JSON.stringify(response).length : 0,
          });
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        requestLogger.error(`Failed ${operationName}`, error, {
          operation: operationName,
          duration,
          metadata: {
            controller: controllerName,
            handler: methodName,
            errorType: error.constructor.name,
            errorMessage: error.message,
            success: false,
          },
        });

        return throwError(() => error);
      }),
    );
  }
}