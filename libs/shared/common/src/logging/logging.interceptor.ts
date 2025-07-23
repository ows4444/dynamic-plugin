import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { RequestWithCorrelation } from './correlation-id.middleware';
import { StructuredLoggerService } from './structured-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const contextType = context.getType();

    if (contextType === 'http') {
      return this.handleHttpRequest(context, next);
    }

    return next.handle();
  }

  private handleHttpRequest(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithCorrelation>();
    const handler = context.getHandler();
    const controller = context.getClass();
    
    const methodName = handler.name;
    const controllerName = controller.name;
    const operationName = `${controllerName}.${methodName}`;

    const startTime = Date.now();
    
    // Get request-scoped logger from middleware
    const requestLogger = request.logger ?? this.logger;

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
            responseSize: response != null ? JSON.stringify(response).length : 0,
            success: true,
          },
        });

        // Log performance metrics for slow operations
        if (duration > 500) {
          requestLogger.logPerformance(operationName, duration, {
            controller: controllerName,
            handler: methodName,
            responseSize: response != null ? JSON.stringify(response).length : 0,
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