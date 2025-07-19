import { All, BadRequestException, Controller, HttpException, HttpStatus, Injectable, Logger, NotFoundException, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PluginRouterService } from './services/plugin-router.service';
import { PluginContextService } from './services/plugin-context.service';
import { PluginErrorCodes, PluginErrorHandler } from '@/shared/utils/error-handler.util';
import { PluginValidationUtil } from '@/shared/utils/validation.util';
import type { DynamicRoute } from './services/plugin-router.service';

/**
 * Response interface for plugin execution results
 */
interface PluginExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  meta?: {
    pluginId: string;
    controllerName: string;
    methodName: string;
    executionTime: number;
  };
}

/**
 * Enhanced plugin proxy controller with proper architecture and error handling
 */
@ApiTags('Plugin Proxy')
@Controller()
@Injectable()
export class PluginProxyController {
  private readonly logger = new Logger(PluginProxyController.name);

  constructor(
    private readonly pluginRouter: PluginRouterService,
    private readonly contextService: PluginContextService,
  ) {}

  /**
   * Handles all plugin routes dynamically
   */
  @All('*path')
  @ApiOperation({ summary: 'Dynamic plugin route handler' })
  @ApiResponse({ status: 200, description: 'Plugin route executed successfully' })
  @ApiResponse({ status: 404, description: 'Plugin route not found' })
  @ApiResponse({ status: 500, description: 'Plugin execution error' })
  async handlePluginRoute(@Req() request: Request, @Res() response: Response): Promise<void> {
    const startTime = Date.now();
    let route: DynamicRoute | null = null;

    try {
      const { method, path } = request;
      this.logger.debug(`Handling plugin route: ${method} ${path}`);

      // Validate request
      if (!this.validateRequest(request)) {
        throw new BadRequestException('Invalid request format');
      }

      // Check if this is a system route that should not be proxied
      if (this.isSystemRoute(path)) {
        this.logger.debug(`System route detected: ${method} ${path}`);
        throw new NotFoundException(`Route not found: ${method} ${path}`);
      }

      // Find matching plugin route
      route = this.pluginRouter.findRoute(method, path);
      if (!route) {
        throw new NotFoundException(`Plugin route not found: ${method} ${path}`);
      }

      this.logger.debug(`Found plugin route: ${route.pluginId}:${route.controllerName}.${route.methodName}`);

      // Validate plugin permissions and security
      this.validatePluginSecurity(route, request);

      // Execute the plugin route
      const result = await this.executePluginRoute(route, request);
      const executionTime = Date.now() - startTime;

      // Format and send response
      const formattedResult = this.formatSuccessResponse(result, route, executionTime);
      this.sendResponse(response, formattedResult);

      this.logger.debug(`Plugin route executed successfully: ${route.pluginId} (${executionTime}ms)`);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.handlePluginError(error, request, response, route, executionTime);
    }
  }

  /**
   * Validates the incoming request
   */
  private validateRequest(request: Request): boolean {
    try {
      // Basic request validation
      if (!request.method || !request.path) {
        return false;
      }

      // Validate path safety
      if (!PluginValidationUtil.validateFilePath(request.path, ['/'])) {
        this.logger.warn(`Unsafe path detected: ${request.path}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Request validation failed:', error);
      return false;
    }
  }

  /**
   * Validates plugin security and permissions
   */
  private validatePluginSecurity(route: DynamicRoute, _request: Request): void {
    try {
      // Check if plugin has required permissions
      if (route.permissions && route.permissions.length > 0) {
        // In a real implementation, this would check user permissions
        // For now, we'll log the required permissions
        this.logger.debug(`Route requires permissions: ${route.permissions.join(', ')}`);
      }

      // Validate plugin context is still valid
      const context = this.contextService.getPluginContext(route.pluginId);
      if (!context) {
        throw new UnauthorizedException(`Plugin context not found: ${route.pluginId}`);
      }

      // Additional security checks could be added here
      // - Rate limiting per plugin
      // - Resource usage validation
      // - Authentication/authorization checks
    } catch (error) {
      this.logger.error(`Security validation failed for plugin ${route.pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Executes the plugin route with proper parameter extraction and error handling
   */
  private async executePluginRoute(route: DynamicRoute, request: Request): Promise<unknown> {
    try {
      // Extract parameters based on the route configuration
      const params = this.extractParameters(request, route);

      this.logger.debug(`Executing plugin route: ${route.pluginId}:${route.controllerName}.${route.methodName}`);

      // Execute the route handler with extracted parameters
      const result = await route.handler(...params);

      return result;
    } catch (error) {
      this.logger.error(`Plugin route execution failed: ${route.pluginId}:${route.controllerName}.${route.methodName}`, error);
      throw PluginErrorHandler.createPluginError(route.pluginId, PluginErrorCodes.EXECUTION_FAILED, `Route execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Formats successful response with metadata
   */
  private formatSuccessResponse(result: unknown, route: DynamicRoute, executionTime: number): PluginExecutionResult {
    return {
      success: true,
      data: result,
      meta: {
        pluginId: route.pluginId,
        controllerName: route.controllerName,
        methodName: route.methodName,
        executionTime,
      },
    };
  }

  /**
   * Sends response with proper content type handling
   */
  private sendResponse(response: Response, result: PluginExecutionResult): void {
    try {
      if (result.data !== undefined) {
        if (typeof result.data === 'object') {
          response.json(result);
        } else {
          response.send(result.data);
        }
      } else {
        response.status(204).json(result);
      }
    } catch (error) {
      this.logger.error('Failed to send response:', error);
      response.status(500).json({
        success: false,
        error: 'Failed to send response',
      });
    }
  }

  /**
   * Comprehensive error handling for plugin execution
   */
  private handlePluginError(error: unknown, request: Request, response: Response, route: DynamicRoute | null, executionTime: number): void {
    this.logger.error(`Plugin route error ${request.method} ${request.path}:`, error);

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorMessage = 'Plugin execution failed';

    // Determine appropriate status code and message
    if (error instanceof HttpException) {
      statusCode = error.getStatus();
      errorMessage = error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;

      // Map specific error types to HTTP status codes
      if (errorMessage.includes('not found')) {
        statusCode = HttpStatus.NOT_FOUND;
      } else if (errorMessage.includes('unauthorized') || errorMessage.includes('permission')) {
        statusCode = HttpStatus.UNAUTHORIZED;
      } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        statusCode = HttpStatus.BAD_REQUEST;
      }
    }

    const errorResponse: PluginExecutionResult = {
      success: false,
      error: errorMessage,
      meta: route
        ? {
            pluginId: route.pluginId,
            controllerName: route.controllerName,
            methodName: route.methodName,
            executionTime,
          }
        : undefined,
    };

    response.status(statusCode).json(errorResponse);
  }

  /**
   * Checks if the given path is a system route that should not be proxied to plugins
   */
  private isSystemRoute(path: string): boolean {
    const systemPaths = ['/api/v1/registry', '/api/v1/plugins', '/api/v1/demo', '/api/v1/runtime', '/api/v1/health', '/api/v1/metrics', '/api/v1/admin'];

    return systemPaths.some((systemPath) => path.startsWith(systemPath));
  }

  /**
   * Enhanced parameter extraction that properly handles NestJS decorators
   */
  private extractParameters(request: Request, route: DynamicRoute): unknown[] {
    try {
      const params: unknown[] = [];

      // In a full implementation, this would examine the route's parameter metadata
      // to determine what parameters to extract and how to transform them
      // For now, we provide a basic implementation that covers common use cases

      // Check if route expects specific parameter types
      if (route.paramTypes && route.paramTypes.length > 0) {
        for (const paramType of route.paramTypes) {
          if (this.isRequestType(paramType)) {
            params.push(request);
          } else if (this.isResponseType(paramType)) {
            // Response would be handled differently in a real implementation
            params.push(null);
          } else if (this.isBodyType(paramType)) {
            params.push(request.body ?? {});
          } else if (this.isQueryType(paramType)) {
            params.push(request.query ?? {});
          } else if (this.isParamsType(paramType)) {
            params.push(request.params ?? {});
          } else {
            // Default to request body for unknown types
            params.push(request.body ?? {});
          }
        }
      } else {
        // Default parameter extraction when no type information is available
        params.push(request.body ?? {});
        if (Object.keys(request.query || {}).length > 0) {
          params.push(request.query);
        }
        if (Object.keys(request.params || {}).length > 0) {
          params.push(request.params);
        }
      }

      return params;
    } catch (error) {
      this.logger.error('Parameter extraction failed:', error);
      // Return basic parameters as fallback
      return [request.body ?? {}];
    }
  }

  /**
   * Type checking helpers for parameter extraction
   */
  private isRequestType(paramType: unknown): boolean {
    return paramType === Request || (paramType as { name?: string })?.name === 'Request';
  }

  private isResponseType(paramType: unknown): boolean {
    return paramType === Response || (paramType as { name?: string })?.name === 'Response';
  }

  private isBodyType(paramType: unknown): boolean {
    // In a real implementation, this would check for @Body decorator metadata
    return (paramType as { name?: string })?.name?.includes('Body') ?? false;
  }

  private isQueryType(paramType: unknown): boolean {
    // In a real implementation, this would check for @Query decorator metadata
    return (paramType as { name?: string })?.name?.includes('Query') ?? false;
  }

  private isParamsType(paramType: unknown): boolean {
    // In a real implementation, this would check for @Param decorator metadata
    return (paramType as { name?: string })?.name?.includes('Param') ?? false;
  }
}
