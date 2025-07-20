import { Injectable, Logger, RequestMethod } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { Type } from '@nestjs/common';
import type { PluginModule } from '@types';
import { PluginErrorCodes, PluginErrorHandler } from '@/shared/utils/error-handler.util';
import { PluginValidationUtil } from '@/shared/utils/validation.util';

/**
 * Enhanced dynamic route interface with better typing
 */
export interface DynamicRoute {
  path: string;
  method: string;
  handler: (...args: unknown[]) => unknown;
  paramTypes: Array<Type<unknown>>;
  pluginId: string;
  controllerName: string;
  methodName: string;
  middlewares?: string[];
  guards?: string[];
  interceptors?: string[];
  permissions?: string[];
}

/**
 * Route registration result
 */
export interface RouteRegistrationResult {
  success: boolean;
  routesRegistered: number;
  controllersProcessed: number;
  errors: string[];
  warnings: string[];
}

/**
 * Enhanced plugin router service with improved type safety and error handling
 */
@Injectable()
export class PluginRouterService {
  private readonly logger = new Logger(PluginRouterService.name);
  private readonly dynamicRoutes = new Map<string, DynamicRoute[]>();
  private readonly pluginControllers = new Map<string, unknown[]>();
  private readonly routeIndex = new Map<string, DynamicRoute>(); // For faster route lookup

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Registers routes for a plugin module with comprehensive error handling
   */
  registerPluginRoutes(pluginModule: PluginModule): RouteRegistrationResult {
    try {
      PluginErrorHandler.validatePluginId(pluginModule.id, 'route registration');

      this.logger.log(`Registering routes for plugin: ${pluginModule.id}`);

      const result: RouteRegistrationResult = {
        success: true,
        routesRegistered: 0,
        controllersProcessed: 0,
        errors: [],
        warnings: [],
      };

      if (!pluginModule.exports?.controllers || pluginModule.exports.controllers.length === 0) {
        result.warnings.push(`No controllers found in plugin: ${pluginModule.id}`);
        this.logger.warn(`No controllers found in plugin: ${pluginModule.id}`);
        return result;
      }

      const routes: DynamicRoute[] = [];
      const controllers: unknown[] = [];

      for (const controllerInstance of pluginModule.exports.controllers) {
        if (!controllerInstance) {
          result.warnings.push(`Null controller instance found in plugin: ${pluginModule.id}`);
          continue;
        }

        try {
          const controllerRoutes = this.processController(controllerInstance, pluginModule.id);
          routes.push(...controllerRoutes);
          controllers.push(controllerInstance);
          result.controllersProcessed++;

          this.logger.debug(`Processed controller: ${this.getControllerName(controllerInstance)} - ${controllerRoutes.length} routes`);
        } catch (error) {
          const errorMsg = `Failed to process controller in plugin ${pluginModule.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, error);
          result.success = false;
        }
      }

      // Store routes and controllers
      this.dynamicRoutes.set(pluginModule.id, routes);
      this.pluginControllers.set(pluginModule.id, controllers);

      // Update route index for faster lookup
      this.updateRouteIndex(pluginModule.id, routes);

      result.routesRegistered = routes.length;

      this.logger.log(`Successfully registered ${result.routesRegistered} routes from ${result.controllersProcessed} controllers for plugin: ${pluginModule.id}`);

      return result;
    } catch (error) {
      const errorMsg = `Failed to register routes for plugin ${pluginModule.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(errorMsg, error);

      return {
        success: false,
        routesRegistered: 0,
        controllersProcessed: 0,
        errors: [errorMsg],
        warnings: [],
      };
    }
  }

  /**
   * Unregisters routes for a plugin
   */
  unregisterPluginRoutes(pluginId: string): void {
    try {
      PluginErrorHandler.validatePluginId(pluginId, 'route unregistration');

      this.logger.log(`Unregistering routes for plugin: ${pluginId}`);

      const routes = this.dynamicRoutes.get(pluginId);
      if (routes) {
        // Remove from route index
        for (const route of routes) {
          const routeKey = this.createRouteKey(route.method, route.path);
          this.routeIndex.delete(routeKey);
        }

        this.dynamicRoutes.delete(pluginId);
        this.logger.log(`Removed ${routes.length} routes for plugin: ${pluginId}`);
      }

      const controllers = this.pluginControllers.get(pluginId);
      if (controllers) {
        this.pluginControllers.delete(pluginId);
      }

      this.logger.log(`Successfully unregistered routes for plugin: ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to unregister routes for plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Finds a route with optimized lookup
   */
  findRoute(method: string, path: string): DynamicRoute | null {
    try {
      // Fast lookup using index
      const routeKey = this.createRouteKey(method, path);
      const indexedRoute = this.routeIndex.get(routeKey);
      if (indexedRoute) {
        return indexedRoute;
      }

      // Fallback to pattern matching for dynamic routes
      for (const [_pluginId, routes] of this.dynamicRoutes) {
        for (const route of routes) {
          if (this.matchRoute(route, method, path)) {
            return route;
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error finding route ${method} ${path}:`, error);
      return null;
    }
  }

  /**
   * Gets all routes with detailed information
   */
  getAllRoutes(): Array<{ pluginId: string; routes: DynamicRoute[] }> {
    return Array.from(this.dynamicRoutes.entries()).map(([pluginId, routes]) => ({
      pluginId,
      routes: routes.map((route) => ({ ...route })), // Return copies to prevent mutation
    }));
  }

  /**
   * Gets routes for a specific plugin
   */
  getPluginRoutes(pluginId: string): DynamicRoute[] {
    const routes = this.dynamicRoutes.get(pluginId);
    return routes ? routes.map((route) => ({ ...route })) : [];
  }

  /**
   * Gets route statistics
   */
  getRouteStatistics(): {
    totalRoutes: number;
    totalPlugins: number;
    routesByPlugin: Record<string, number>;
    routesByMethod: Record<string, number>;
  } {
    const routesByPlugin: Record<string, number> = {};
    const routesByMethod: Record<string, number> = {};
    let totalRoutes = 0;

    for (const [pluginId, routes] of this.dynamicRoutes) {
      routesByPlugin[pluginId] = routes.length;
      totalRoutes += routes.length;

      for (const route of routes) {
        routesByMethod[route.method] = (routesByMethod[route.method] || 0) + 1;
      }
    }

    return {
      totalRoutes,
      totalPlugins: this.dynamicRoutes.size,
      routesByPlugin,
      routesByMethod,
    };
  }

  /**
   * Validates route configuration
   */
  validateRoute(route: DynamicRoute): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!route.path || typeof route.path !== 'string') {
      errors.push('Route path is required and must be a string');
    } else if (!PluginValidationUtil.validateFilePath(route.path, ['/'])) {
      errors.push('Route path contains invalid characters');
    }

    if (!route.method || typeof route.method !== 'string') {
      errors.push('Route method is required and must be a string');
    }

    if (!route.handler || typeof route.handler !== 'function') {
      errors.push('Route handler is required and must be a function');
    }

    if (!route.pluginId || typeof route.pluginId !== 'string') {
      errors.push('Route pluginId is required and must be a string');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private processController(controllerInstance: unknown, pluginId: string): DynamicRoute[] {
    const routes: DynamicRoute[] = [];

    if (!controllerInstance || typeof controllerInstance !== 'object') {
      throw PluginErrorHandler.createPluginError(pluginId, PluginErrorCodes.INVALID_CONFIGURATION, 'Controller instance must be a valid object');
    }

    const controllerName = this.getControllerName(controllerInstance);
    const controllerPath = this.getControllerPath(controllerInstance);

    // Extract route methods from the controller instance
    const routeMethods = this.extractRouteMethodsFromInstance(controllerInstance);

    for (const routeMethod of routeMethods) {
      try {
        const fullPath = this.buildFullPath(controllerPath, routeMethod.path);

        const route: DynamicRoute = {
          path: fullPath,
          method: routeMethod.method,
          handler: routeMethod.handler,
          paramTypes: routeMethod.paramTypes,
          pluginId,
          controllerName,
          methodName: routeMethod.methodName,
          middlewares: routeMethod.middlewares ?? [],
          guards: routeMethod.guards ?? [],
          interceptors: routeMethod.interceptors ?? [],
          permissions: routeMethod.permissions ?? [],
        };

        // Validate route before adding
        const validation = this.validateRoute(route);
        if (!validation.valid) {
          this.logger.warn(`Invalid route configuration: ${validation.errors.join(', ')}`);
          continue;
        }

        routes.push(route);
        this.logger.debug(`Registered route: ${route.method} ${route.path} -> ${controllerName}.${route.methodName}`);
      } catch (error) {
        this.logger.error(`Failed to process route method ${routeMethod.methodName}:`, error);
      }
    }

    return routes;
  }

  private getControllerName(controllerInstance: unknown): string {
    if (controllerInstance && typeof controllerInstance === 'object' && 'constructor' in controllerInstance) {
      const constructor = controllerInstance.constructor as { name?: string };
      return constructor.name ?? 'UnknownController';
    }
    return 'UnknownController';
  }

  private getControllerPath(controllerInstance: unknown): string {
    if (!controllerInstance || typeof controllerInstance !== 'object' || !('constructor' in controllerInstance)) {
      return '';
    }

    const ControllerClass = controllerInstance.constructor as Type<unknown>;

    // Get path from @Controller decorator
    const controllerPath = this.reflector.get('path', ControllerClass) ?? '';

    // Also check for @PluginController decorator
    const pluginControllerPath = this.reflector.get('plugin:controller:path', ControllerClass);

    return pluginControllerPath ?? controllerPath ?? '';
  }

  private extractRouteMethodsFromInstance(controllerInstance: unknown): RouteMethodInfo[] {
    const methods: RouteMethodInfo[] = [];

    if (!controllerInstance || typeof controllerInstance !== 'object') {
      return methods;
    }

    // Get all method names from the controller prototype
    const prototype = Object.getPrototypeOf(controllerInstance) as object;
    const methodNames = Object.getOwnPropertyNames(prototype).filter((name) => name !== 'constructor' && typeof (prototype as Record<string, unknown>)[name] === 'function');

    this.logger.debug(`Found ${methodNames.length} methods in controller: ${methodNames.join(', ')}`);

    for (const methodName of methodNames) {
      const method = (controllerInstance as Record<string, unknown>)[methodName];
      if (typeof method !== 'function') continue;

      // Check for HTTP method decorators
      const httpMethod = this.getHttpMethod(prototype, methodName);
      if (!httpMethod) {
        this.logger.debug(`No HTTP method found for: ${methodName}`);
        continue;
      }

      // Get route path
      const routePath = this.getRoutePath(prototype, methodName);

      // Get parameter types
      const paramTypes = this.getParameterTypes(prototype, methodName);

      // Get additional metadata
      const middlewares = this.getMiddlewares(prototype, methodName);
      const guards = this.getGuards(prototype, methodName);
      const interceptors = this.getInterceptors(prototype, methodName);
      const permissions = this.getPermissions(prototype, methodName);

      this.logger.debug(`Found route method: ${httpMethod} ${routePath} -> ${methodName}`);

      methods.push({
        methodName,
        method: httpMethod,
        path: routePath,
        handler: method.bind(controllerInstance) as (...args: unknown[]) => unknown,
        paramTypes,
        middlewares,
        guards,
        interceptors,
        permissions,
      });
    }

    return methods;
  }

  private getHttpMethod(prototype: object, methodName: string): string | null {
    // Check for standard HTTP method decorators
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

    for (const method of methods) {
      if (this.reflector.get(method.toLowerCase(), (prototype as Record<string, unknown>)[methodName] as Function) !== undefined) {
        return method;
      }
    }

    // Check for @RequestMapping decorator
    const requestMapping = this.reflector.get('method', (prototype as Record<string, unknown>)[methodName] as Function);
    if (requestMapping !== undefined) {
      return RequestMethod[requestMapping] ?? 'GET';
    }

    return null;
  }

  private getRoutePath(prototype: object, methodName: string): string {
    // Get path from route decorators
    const path = this.reflector.get('path', (prototype as Record<string, unknown>)[methodName] as Function);

    // Also check for plugin route decorator
    const pluginRoute = this.reflector.get('plugin:route:config', (prototype as Record<string, unknown>)[methodName] as Function);

    return pluginRoute?.path ?? path ?? '';
  }

  private getParameterTypes(prototype: object, methodName: string): Array<Type<unknown>> {
    // Get parameter metadata for proper request handling
    const paramTypes = this.reflector.get('design:paramtypes', (prototype as Record<string, unknown>)[methodName] as Function);
    return paramTypes ?? [];
  }

  private getMiddlewares(prototype: object, methodName: string): string[] {
    const middlewares = this.reflector.get('middlewares', (prototype as Record<string, unknown>)[methodName] as Function);
    return middlewares ?? [];
  }

  private getGuards(prototype: object, methodName: string): string[] {
    const guards = this.reflector.get('guards', (prototype as Record<string, unknown>)[methodName] as Function);
    return guards ?? [];
  }

  private getInterceptors(prototype: object, methodName: string): string[] {
    const interceptors = this.reflector.get('interceptors', (prototype as Record<string, unknown>)[methodName] as Function);
    return interceptors ?? [];
  }

  private getPermissions(prototype: object, methodName: string): string[] {
    const permissions = this.reflector.get('plugin:permission:required', (prototype as Record<string, unknown>)[methodName] as Function);
    return permissions ?? [];
  }

  private buildFullPath(controllerPath: string, methodPath: string): string {
    const cleanControllerPath = controllerPath.replace(/^\/+|\/+$/g, '');
    const cleanMethodPath = methodPath.replace(/^\/+|\/+$/g, '');

    if (!cleanControllerPath && !cleanMethodPath) {
      return '/';
    }

    if (!cleanControllerPath) {
      return `/${cleanMethodPath}`;
    }

    if (!cleanMethodPath) {
      return `/${cleanControllerPath}`;
    }

    return `/${cleanControllerPath}/${cleanMethodPath}`;
  }

  private matchRoute(route: DynamicRoute, method: string, path: string): boolean {
    // Enhanced route matching with parameter support
    if (route.method.toLowerCase() !== method.toLowerCase()) {
      return false;
    }

    // Exact match first
    if (route.path === path) {
      return true;
    }

    // Pattern matching for parameterized routes
    return this.matchParameterizedRoute(route.path, path);
  }

  private matchParameterizedRoute(routePattern: string, requestPath: string): boolean {
    // Convert route pattern to regex (simplified version)
    // This would need a more sophisticated implementation for full parameter support
    const regexPattern = routePattern
      .replace(/:[^/]+/g, '([^/]+)') // Replace :param with capture group
      .replace(/\*/g, '.*'); // Replace * with wildcard

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(requestPath);
  }

  private createRouteKey(method: string, path: string): string {
    return `${method.toUpperCase()}:${path}`;
  }

  private updateRouteIndex(pluginId: string, routes: DynamicRoute[]): void {
    for (const route of routes) {
      const routeKey = this.createRouteKey(route.method, route.path);
      this.routeIndex.set(routeKey, route);
    }
  }
}

/**
 * Interface for route method information
 */
interface RouteMethodInfo {
  methodName: string;
  method: string;
  path: string;
  handler: (...args: unknown[]) => unknown;
  paramTypes: Array<Type<unknown>>;
  middlewares?: string[];
  guards?: string[];
  interceptors?: string[];
  permissions?: string[];
}
