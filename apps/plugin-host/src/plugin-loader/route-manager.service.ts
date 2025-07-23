import { Injectable, Logger, type Type } from '@nestjs/common';
import { getErrorMessage } from '@lib/shared/common';

// HTTP methods supported by the plugin system
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

// Generic request/response types for route handlers
export interface RouteRequest {
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

export interface RouteResponse<T = unknown> {
  statusCode?: number;
  data?: T;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

// Route handler function type with proper typing
export type RouteHandler<TRequest = RouteRequest, TResponse = unknown> = (
  request: TRequest,
  ...args: unknown[]
) => Promise<TResponse> | TResponse;

// Middleware function type with cleanup capability
export interface MiddlewareFunction {
  (request: RouteRequest, response: RouteResponse, next: () => void): Promise<void> | void;
  cleanup?(): void | Promise<void>;
}

// Plugin route definition used by the route manager
export interface PluginRoute {
  path: string;
  method: HttpMethod;
  handler: RouteHandler;
  middleware?: MiddlewareFunction[];
  guards?: string[];
  description?: string;
  tags?: string[];
}

// Route metadata extracted from decorators
interface RouteMetadata {
  path: string;
  method: HttpMethod;
  middleware?: MiddlewareFunction[];
  guards?: string[];
  description?: string;
  tags?: string[];
}

// NestJS controller constructor type
export interface ControllerConstructor extends Type<unknown> {
  prototype: ControllerPrototype;
}

// Controller prototype with method definitions
interface ControllerPrototype {
  [methodName: string]: unknown;
  constructor: ControllerConstructor;
}

// Plugin module structure that can contain routes and controllers
export interface PluginModuleWithRoutes {
  routes?: PluginRoute[];
  controllers?: ControllerConstructor[];
  default?: ControllerConstructor | Record<string, unknown>;
  [key: string]: unknown;
}

@Injectable()
export class RouteManagerService {
  private readonly logger = new Logger(RouteManagerService.name);
  private readonly pluginRoutes: Map<string, PluginRoute[]> = new Map();

  async registerRoutes(pluginId: string, module: PluginModuleWithRoutes): Promise<PluginRoute[]> {
    this.logger.log(`Registering routes for plugin: ${pluginId}`);

    try {
      const routes: PluginRoute[] = [];

      // Extract routes from the plugin module
      if (module.routes && Array.isArray(module.routes)) {
        routes.push(...(module.routes));
      }

      // Extract routes from controllers
      if (module.controllers && Array.isArray(module.controllers)) {
        for (const controller of module.controllers) {
          const controllerRoutes = this.extractRoutesFromController(controller);
          routes.push(...controllerRoutes);
        }
      }

      // Extract routes from default export if it's a controller
      if (module.default && typeof module.default === 'function') {
        const controllerRoutes = this.extractRoutesFromController(
          module.default,
        );
        routes.push(...controllerRoutes);
      }

      // Store routes for this plugin
      this.pluginRoutes.set(pluginId, routes);

      this.logger.log(
        `Registered ${routes.length} routes for plugin: ${pluginId}`,
      );
      return Promise.resolve(routes);
    } catch (error) {
      this.logger.error(
        `Failed to register routes for plugin ${pluginId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async unregisterRoutes(pluginId: string): Promise<void> {
    this.logger.log(`Unregistering routes for plugin: ${pluginId}`);

    const routes = this.pluginRoutes.get(pluginId);
    if (!routes) {
      this.logger.warn(`No routes found for plugin: ${pluginId}`);
      return;
    }

    try {
      // Clean up route handlers and middleware
      for (const route of routes) {
        // Perform any necessary cleanup
        if (route.middleware) {
          route.middleware.forEach((middleware) => {
            if (middleware.cleanup) {
              // Call cleanup method - could be async or sync
              const cleanupResult = middleware.cleanup();
              if (cleanupResult instanceof Promise) {
                cleanupResult.catch((error) => {
                  this.logger.warn(
                    `Middleware cleanup failed for plugin ${pluginId}: ${getErrorMessage(error)}`,
                  );
                });
              }
            }
          });
        }
      }

      // Remove routes from registry
      this.pluginRoutes.delete(pluginId);

      this.logger.log(
        `Unregistered ${routes.length} routes for plugin: ${pluginId}`,
      );
      await Promise.resolve();
    } catch (error) {
      this.logger.error(
        `Failed to unregister routes for plugin ${pluginId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  getPluginRoutes(pluginId: string): PluginRoute[] {
    return this.pluginRoutes.get(pluginId) ?? [];
  }

  getAllRoutes(): Map<string, PluginRoute[]> {
    return new Map(this.pluginRoutes);
  }

  private extractRoutesFromController(controller: ControllerConstructor): PluginRoute[] {
    const routes: PluginRoute[] = [];

    try {
      // This is a simplified implementation
      // In a real system, you would use reflection to extract
      // routes from NestJS controllers with decorators

      const prototype = controller.prototype;
      const methods = Object.getOwnPropertyNames(prototype);

      for (const methodName of methods) {
        if (methodName === 'constructor') continue;

        const method = prototype[methodName];
        if (typeof method === 'function') {
          // Check for route metadata (this would be extracted from decorators)
          const routeMetadata = this.getRouteMetadata(controller, methodName);

          if (routeMetadata) {
            // Create a properly typed route handler with type guard
            const routeHandler: RouteHandler = this.createTypedRouteHandler(method, controller);
            
            routes.push({
              path: routeMetadata.path,
              method: routeMetadata.method,
              handler: routeHandler,
              ...(routeMetadata.middleware && { middleware: routeMetadata.middleware }),
              ...(routeMetadata.guards && { guards: routeMetadata.guards }),
              ...((routeMetadata.description != null) && { description: routeMetadata.description }),
              ...(routeMetadata.tags && { tags: routeMetadata.tags }),
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to extract routes from controller: ${getErrorMessage(error)}`,
      );
    }

    return routes;
  }

  private getRouteMetadata(
    _controller: ControllerConstructor, 
    _methodName: string
  ): RouteMetadata | null {
    // This would extract metadata from decorators using reflection
    // In a real implementation, this would use Reflect.getMetadata() to extract
    // decorator information like @Get(), @Post(), @Middleware(), etc.
    // For now, return null as this requires reflection metadata
    return null;
  }

  /**
   * Creates a type-safe route handler from a method with proper binding
   */
  private createTypedRouteHandler(method: unknown, controller: unknown): RouteHandler {
    if (typeof method !== 'function') {
      throw new Error('Method must be a function');
    }
    
    // Type assertion with runtime validation
    const boundMethod = method.bind(controller) as RouteHandler;
    
    // Wrap to ensure proper typing
    return async (req: RouteRequest, ...args: unknown[]) => {
      return await boundMethod(req, ...args);
    };
  }
}
