import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PluginError } from '../errors/plugin.errors';

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, error } = this.getErrorResponse(exception);

    // SECURITY: Sanitize path to prevent information disclosure
    const sanitizedPath = this.sanitizePath(request.url);

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: sanitizedPath,
      method: request.method,
      message,
      error,
      // SECURITY: Only include stack traces in development mode and sanitize them
      ...(process.env['NODE_ENV'] === 'development' && {
        stack: exception instanceof Error ? this.sanitizeStackTrace(exception.stack) : undefined,
      }),
    };

    // Log the error with appropriate level (with full context for internal logs)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${this.getInternalErrorMessage(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} - ${status} - ${message}`,
      );
    }

    response.status(status).json(errorResponse);
  }

  private getErrorResponse(exception: unknown): {
    status: number;
    message: string;
    error: string;
  } {
    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        message: this.sanitizeErrorMessage(exception.message),
        error: exception.name,
      };
    }

    if (exception instanceof PluginError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: this.sanitizeErrorMessage(exception.message),
        error: exception.name,
      };
    }

    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message:
          process.env['NODE_ENV'] === 'production'
            ? 'Internal server error'
            : this.sanitizeErrorMessage(exception.message),
        error: 'InternalServerError', // Don't expose actual error class names
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'UnknownError',
    };
  }

  /**
   * SECURITY: Sanitize error messages to prevent information disclosure
   */
  private sanitizeErrorMessage(message: string): string {
    if (!message || typeof message !== 'string') {
      return 'An error occurred';
    }

    // Remove potentially sensitive information
    const sanitized = message
      // Remove file paths
      .replace(/\/[^\s]+/g, '[PATH]')
      .replace(/[A-Z]:\\[^\s]+/g, '[PATH]')
      // Remove potential database connection strings
      .replace(/\b(?:postgres|mysql|mongodb):\/\/[^\s]+/gi, '[CONNECTION_STRING]')
      // Remove IP addresses
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_ADDRESS]')
      // Remove tokens/keys (sequences of 20+ alphanumeric characters)
      .replace(/\b[a-zA-Z0-9]{20,}\b/g, '[TOKEN]')
      // Remove environment variables
      .replace(/\b[A-Z_]{2,}=[^\s]+/g, '[ENV_VAR]')
      // Limit length
      .substring(0, 500);

    return sanitized || 'An error occurred';
  }

  /**
   * SECURITY: Sanitize stack traces to remove sensitive paths
   */
  private sanitizeStackTrace(stack?: string): string | undefined {
    if (!stack || stack.length === 0) return undefined;

    return stack
      .split('\n')
      .map(line => {
        // Replace file paths with generic placeholders
        return line
          .replace(/\/[^\s:]+/g, '[PATH]')
          .replace(/[A-Z]:\\[^\s:]+/g, '[PATH]')
          .replace(/at [^\s]+ \([^)]+\)/g, 'at [FUNCTION] ([LOCATION])');
      })
      .slice(0, 10) // Limit stack trace length
      .join('\n');
  }

  /**
   * SECURITY: Sanitize request paths to prevent information disclosure
   */
  private sanitizePath(path: string): string {
    if (!path || typeof path !== 'string') {
      return '/unknown';
    }

    // Remove query parameters that might contain sensitive data
    const pathWithoutQuery = path.split('?')[0] ?? '/';
    
    // Replace potential sensitive path segments
    return pathWithoutQuery
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/[UUID]')
      .replace(/\/\d{10,}/g, '/[ID]')
      .substring(0, 200); // Limit length
  }

  /**
   * Get detailed error message for internal logging (not exposed to users)
   */
  private getInternalErrorMessage(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.message;
    }
    return 'Unknown error occurred';
  }
}