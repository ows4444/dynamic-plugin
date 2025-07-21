import { Injectable, Logger } from '@nestjs/common';

export interface PluginRoute {
  path: string;
  method: string;
  handler: (...args: any[]) => any;
  middleware?: ((...args: any[]) => any)[];
}

@Injectable()
export class RouteManagerService {
  private readonly logger = new Logger(RouteManagerService.name);
  private pluginRoutes: Map<string, PluginRoute[]> = new Map();

  async registerRoutes(pluginId: string, module: any): Promise<PluginRoute[]> {
    this.logger.log(`Registering routes for plugin: ${pluginId}`);

    try {
      const routes: PluginRoute[] = [];

      // Extract routes from the plugin module
      if (module.routes && Array.isArray(module.routes)) {
        routes.push(...(module.routes as PluginRoute[]));
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
        `Failed to register routes for plugin ${pluginId}: ${error.message}`,
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
            if (
              middleware &&
              typeof (middleware as any).cleanup === 'function'
            ) {
              (middleware as any).cleanup();
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
        `Failed to unregister routes for plugin ${pluginId}: ${error.message}`,
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

  private extractRoutesFromController(controller: any): PluginRoute[] {
    const routes: PluginRoute[] = [];

    try {
      // This is a simplified implementation
      // In a real system, you would use reflection to extract
      // routes from NestJS controllers with decorators

      const prototype = controller.prototype ?? controller;
      const methods = Object.getOwnPropertyNames(prototype);

      for (const methodName of methods) {
        if (methodName === 'constructor') continue;

        const method = prototype[methodName];
        if (typeof method === 'function') {
          // Check for route metadata (this would be extracted from decorators)
          const routeMetadata = this.getRouteMetadata(controller, methodName);

          if (routeMetadata) {
            routes.push({
              path: routeMetadata.path,
              method: routeMetadata.method,
              handler: method.bind(controller),
              middleware: routeMetadata.middleware,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to extract routes from controller: ${error.message}`,
      );
    }

    return routes;
  }

  private getRouteMetadata(_controller: any, _methodName: string): any {
    // This would extract metadata from decorators
    // For now, return null as this requires reflection metadata
    return null;
  }
}
