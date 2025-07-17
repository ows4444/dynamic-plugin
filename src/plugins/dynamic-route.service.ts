import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PluginManagerService } from './plugin-manager.service';
import { PluginMetricsService } from './plugin-metrics.service';
import { RouteDefinition } from '../common/interfaces/plugin.interface';

@Injectable()
export class DynamicRouteService {
  private readonly logger = new Logger(DynamicRouteService.name);
  private readonly pluginRoutes = new Map<string, RouteDefinition[]>();
  private readonly pluginInstances = new Map<string, any>();

  constructor(
    @Inject(forwardRef(() => PluginManagerService))
    private readonly pluginManager: PluginManagerService,
    private readonly metricsService: PluginMetricsService
  ) {}

  async handlePluginRoute(
    pluginId: string,
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const plugin = this.pluginManager.getPlugin(pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      // Get plugin routes
      const routes = this.getPluginRoutes(pluginId);
      
      // Extract the route path (remove /plugin/:pluginId prefix)
      const routePath = req.path.replace(`/plugin/${pluginId}`, '') || '/';
      const method = req.method.toUpperCase();

      this.logger.log(`Matching route: ${routePath} ${method} against ${routes.length} routes`);
      routes.forEach(route => {
        this.logger.log(`  Route: ${route.path} ${route.method}`);
      });

      // Find matching route
      const matchingRoute = routes.find(route => 
        route.path === routePath && route.method === method
      );

      if (!matchingRoute) {
        res.status(404).json({
          error: 'Route not found',
          pluginId,
          path: routePath,
          method
        });
        return;
      }

      // Apply middleware if defined
      if (matchingRoute.middleware) {
        await this.applyMiddleware(pluginId, matchingRoute.middleware, req, res, next);
      }

      // Apply guards if defined
      if (matchingRoute.guards) {
        const guardsPassed = await this.applyGuards(pluginId, matchingRoute.guards, req, res);
        if (!guardsPassed) {
          res.status(403).json({
            error: 'Access denied',
            pluginId,
            path: routePath
          });
          return;
        }
      }

      // Execute route handler
      await this.executeRouteHandler(pluginId, matchingRoute.handler, req, res);

      // Record metrics
      const responseTime = Date.now() - startTime;
      this.metricsService.recordResponseTime(pluginId, responseTime);
      this.metricsService.recordRequest(pluginId, req.headers['user-id'] as string);

    } catch (error) {
      this.logger.error(`Error in plugin route ${pluginId}:`, error);
      this.metricsService.recordError(pluginId, error.constructor.name);
      
      const responseTime = Date.now() - startTime;
      this.metricsService.recordResponseTime(pluginId, responseTime);

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Plugin execution error',
          message: error.message,
          pluginId
        });
      }
    }
  }

  registerPluginRoutes(pluginId: string): void {
    const plugin = this.pluginManager.getPlugin(pluginId);
    if (!plugin || !plugin.getRoutes) {
      return;
    }

    try {
      const routes = plugin.getRoutes();
      this.pluginRoutes.set(pluginId, routes);
      this.pluginInstances.set(pluginId, plugin);
      this.logger.log(`Registered ${routes.length} routes for plugin: ${pluginId}`);
      
      // Debug log routes
      routes.forEach(route => {
        this.logger.debug(`  Registered route: ${route.path} ${route.method} -> ${route.handler}`);
      });
    } catch (error) {
      this.logger.error(`Failed to register routes for plugin ${pluginId}:`, error);
    }
  }

  unregisterPluginRoutes(pluginId: string): void {
    this.pluginRoutes.delete(pluginId);
    this.pluginInstances.delete(pluginId);
    this.logger.log(`Unregistered routes for plugin: ${pluginId}`);
  }

  getPluginRoutes(pluginId: string): RouteDefinition[] {
    return this.pluginRoutes.get(pluginId) || [];
  }

  private async applyMiddleware(
    pluginId: string,
    middlewareNames: string[],
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const plugin = this.pluginManager.getPlugin(pluginId);
    if (!plugin || !plugin.getMiddleware) {
      return;
    }

    try {
      const middleware = plugin.getMiddleware();
      
      for (const middlewareName of middlewareNames) {
        const middlewareDefinition = middleware.find(m => m.name === middlewareName);
        if (middlewareDefinition) {
          await new Promise<void>((resolve, reject) => {
            middlewareDefinition.handler(req, res, (error?: any) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          });
        }
      }
    } catch (error) {
      this.logger.error(`Middleware error in plugin ${pluginId}:`, error);
      throw error;
    }
  }

  private async applyGuards(
    pluginId: string,
    guardNames: string[],
    req: Request,
    res: Response
  ): Promise<boolean> {
    const plugin = this.pluginManager.getPlugin(pluginId);
    if (!plugin || !plugin.getGuards) {
      return true;
    }

    try {
      const guards = plugin.getGuards();
      
      for (const guardName of guardNames) {
        const guardClass = guards.find(g => g.name === guardName);
        if (guardClass) {
          const guardInstance = new guardClass();
          const context = {
            switchToHttp: () => ({
              getRequest: () => req,
              getResponse: () => res
            })
          };
          
          const canActivate = await guardInstance.canActivate(context as any);
          if (!canActivate) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Guard error in plugin ${pluginId}:`, error);
      return false;
    }
  }

  private async executeRouteHandler(
    pluginId: string,
    handlerName: string,
    req: Request,
    res: Response
  ): Promise<void> {
    const plugin = this.pluginInstances.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    try {
      // Get controllers from plugin
      const controllers = plugin.getControllers ? plugin.getControllers() : [];
      
      // Find the handler in plugin controllers
      let handler: Function | undefined;
      
      for (const controllerClass of controllers) {
        const controllerInstance = new controllerClass();
        
        if (typeof controllerInstance[handlerName] === 'function') {
          handler = controllerInstance[handlerName].bind(controllerInstance);
          break;
        }
      }

      if (!handler) {
        throw new Error(`Handler ${handlerName} not found in plugin ${pluginId}`);
      }

      // Execute the handler
      const result = await handler(req, res);
      
      // If result is returned and response not sent, send it
      if (result && !res.headersSent) {
        res.json(result);
      }
      
    } catch (error) {
      this.logger.error(`Handler execution error in plugin ${pluginId}:`, error);
      throw error;
    }
  }

  getAllRoutes(): Map<string, RouteDefinition[]> {
    return new Map(this.pluginRoutes);
  }

  getRoutesByPath(path: string): Array<{ pluginId: string; route: RouteDefinition }> {
    const results: Array<{ pluginId: string; route: RouteDefinition }> = [];
    
    for (const [pluginId, routes] of this.pluginRoutes) {
      const matchingRoutes = routes.filter(route => route.path === path);
      matchingRoutes.forEach(route => {
        results.push({ pluginId, route });
      });
    }
    
    return results;
  }
}