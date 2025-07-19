import { Module } from '@nestjs/common';
import type { PluginConfiguration } from '@/shared/interfaces/plugin.interface';

/**
 * Plugin decorator to mark a class as a plugin module
 * Extends the NestJS @Module decorator with plugin-specific metadata
 */
export function Plugin(config: PluginConfiguration) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    // Store plugin configuration in metadata
    Reflect.defineMetadata('plugin:config', config, constructor);

    // Store plugin ID for easy lookup
    Reflect.defineMetadata('plugin:id', config.id, constructor);

    // Store plugin name for easy lookup
    Reflect.defineMetadata('plugin:name', config.name, constructor);

    // Store plugin version for compatibility checks
    Reflect.defineMetadata('plugin:version', config.version, constructor);

    // Store plugin capabilities
    Reflect.defineMetadata('plugin:capabilities', config.capabilities ?? [], constructor);

    // Store plugin permissions
    Reflect.defineMetadata('plugin:permissions', config.permissions ?? {}, constructor);

    // Store plugin dependencies
    Reflect.defineMetadata('plugin:dependencies', config.dependencies ?? {}, constructor);

    // Store plugin events
    Reflect.defineMetadata('plugin:events', config.events ?? [], constructor);

    // Apply the standard NestJS Module decorator
    const moduleDecorator = Module({
      imports: [],
      controllers: [],
      providers: [],
      exports: [],
    });

    return moduleDecorator(constructor);
  };
}

/**
 * Plugin service decorator to mark a class as a plugin service
 */
export function PluginService(config?: { name?: string; singleton?: boolean; lazy?: boolean }) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    // Store service configuration
    Reflect.defineMetadata('plugin:service:config', config ?? {}, constructor);

    // Mark as plugin service
    Reflect.defineMetadata('plugin:service', true, constructor);

    return constructor;
  };
}

/**
 * Plugin controller decorator to mark a class as a plugin controller
 */
export function PluginController(
  path?: string,
  config?: {
    permissions?: string[];
    middleware?: string[];
  },
) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    // Store controller configuration
    Reflect.defineMetadata('plugin:controller:config', config ?? {}, constructor);

    // Store controller path
    Reflect.defineMetadata('plugin:controller:path', path ?? '', constructor);

    // Mark as plugin controller
    Reflect.defineMetadata('plugin:controller', true, constructor);

    return constructor;
  };
}

/**
 * Plugin event handler decorator
 */
export function PluginEventHandler(eventType: string | string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const eventTypes = Array.isArray(eventType) ? eventType : [eventType];

    // Store event handler metadata
    Reflect.defineMetadata('plugin:event:types', eventTypes, target, propertyKey);
    Reflect.defineMetadata('plugin:event:handler', true, target, propertyKey);

    return descriptor;
  };
}

/**
 * Plugin hook handler decorator
 */
export function PluginHook(hookName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Store hook handler metadata
    Reflect.defineMetadata('plugin:hook:name', hookName, target, propertyKey);
    Reflect.defineMetadata('plugin:hook:handler', true, target, propertyKey);

    return descriptor;
  };
}

/**
 * Plugin permission decorator for methods
 */
export function PluginPermission(permission: string | string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const permissions = Array.isArray(permission) ? permission : [permission];

    // Store permission metadata
    Reflect.defineMetadata('plugin:permission:required', permissions, target, propertyKey);

    return descriptor;
  };
}

/**
 * Plugin route decorator
 */
export function PluginRoute(config: { path?: string; method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; permissions?: string[]; middleware?: string[] }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Store route configuration
    Reflect.defineMetadata('plugin:route:config', config, target, propertyKey);
    Reflect.defineMetadata('plugin:route', true, target, propertyKey);

    return descriptor;
  };
}

/**
 * Plugin configuration decorator for properties
 */
export function PluginConfig(key?: string, defaultValue?: any) {
  return function (target: any, propertyKey: string) {
    const configKey = key ?? propertyKey;

    // Store config metadata
    Reflect.defineMetadata('plugin:config:key', configKey, target, propertyKey);
    Reflect.defineMetadata('plugin:config:default', defaultValue, target, propertyKey);
    Reflect.defineMetadata('plugin:config:property', true, target, propertyKey);
  };
}

/**
 * Plugin logger decorator
 */
export function PluginLogger(context?: string) {
  return function (target: any, propertyKey: string) {
    // Store logger metadata
    Reflect.defineMetadata('plugin:logger:context', context, target, propertyKey);
    Reflect.defineMetadata('plugin:logger', true, target, propertyKey);
  };
}

/**
 * Utility functions for reading plugin metadata
 */
export class PluginMetadataReader {
  /**
   * Get plugin configuration from a class
   */
  static getPluginConfig(target: any): PluginConfiguration | undefined {
    return Reflect.getMetadata('plugin:config', target);
  }

  /**
   * Get plugin ID from a class
   */
  static getPluginId(target: any): string | undefined {
    return Reflect.getMetadata('plugin:id', target);
  }

  /**
   * Get plugin name from a class
   */
  static getPluginName(target: any): string | undefined {
    return Reflect.getMetadata('plugin:name', target);
  }

  /**
   * Get plugin version from a class
   */
  static getPluginVersion(target: any): string | undefined {
    return Reflect.getMetadata('plugin:version', target);
  }

  /**
   * Get plugin capabilities from a class
   */
  static getPluginCapabilities(target: any): string[] {
    return Reflect.getMetadata('plugin:capabilities', target) ?? [];
  }

  /**
   * Get plugin permissions from a class
   */
  static getPluginPermissions(target: any): Record<string, string[]> {
    return Reflect.getMetadata('plugin:permissions', target) ?? {};
  }

  /**
   * Get plugin dependencies from a class
   */
  static getPluginDependencies(target: any): Record<string, string> {
    return Reflect.getMetadata('plugin:dependencies', target) ?? {};
  }

  /**
   * Get plugin events from a class
   */
  static getPluginEvents(target: any): string[] {
    return Reflect.getMetadata('plugin:events', target) ?? [];
  }

  /**
   * Check if a class is a plugin
   */
  static isPlugin(target: any): boolean {
    return Boolean(Reflect.getMetadata('plugin:config', target));
  }

  /**
   * Check if a class is a plugin service
   */
  static isPluginService(target: any): boolean {
    return Boolean(Reflect.getMetadata('plugin:service', target));
  }

  /**
   * Check if a class is a plugin controller
   */
  static isPluginController(target: any): boolean {
    return Boolean(Reflect.getMetadata('plugin:controller', target));
  }

  /**
   * Get event handlers from a class
   */
  static getEventHandlers(target: any): { method: string; eventTypes: string[] }[] {
    const handlers: { method: string; eventTypes: string[] }[] = [];
    const prototype = target.prototype ?? target;

    const methodNames = Object.getOwnPropertyNames(prototype);
    for (const methodName of methodNames) {
      if (Reflect.getMetadata('plugin:event:handler', prototype, methodName)) {
        const eventTypes = Reflect.getMetadata('plugin:event:types', prototype, methodName) ?? [];
        handlers.push({ method: methodName, eventTypes });
      }
    }

    return handlers;
  }

  /**
   * Get hook handlers from a class
   */
  static getHookHandlers(target: any): { method: string; hookName: string }[] {
    const handlers: { method: string; hookName: string }[] = [];
    const prototype = target.prototype ?? target;

    const methodNames = Object.getOwnPropertyNames(prototype);
    for (const methodName of methodNames) {
      if (Reflect.getMetadata('plugin:hook:handler', prototype, methodName)) {
        const hookName = Reflect.getMetadata('plugin:hook:name', prototype, methodName);
        if (hookName) {
          handlers.push({ method: methodName, hookName });
        }
      }
    }

    return handlers;
  }

  /**
   * Get required permissions for a method
   */
  static getMethodPermissions(target: any, methodName: string): string[] {
    return Reflect.getMetadata('plugin:permission:required', target, methodName) ?? [];
  }

  /**
   * Get route configuration for a method
   */
  static getRouteConfig(target: any, methodName: string): any {
    return Reflect.getMetadata('plugin:route:config', target, methodName);
  }
}
