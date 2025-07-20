import { Controller, Injectable } from '@nestjs/common';
import type { PluginConfiguration, PluginRouteConfig } from '@/shared/interfaces/plugin.interface';
import type { Type } from '@nestjs/common';
import 'reflect-metadata';

// Type definitions for better decorator typing
type Constructor<TObject = object> = new (...args: unknown[]) => TObject;
type PluginClassDecorator = <TFunction extends Constructor>(target: TFunction) => TFunction | void;
type PluginPropertyDecorator = (target: object, propertyKey: string | symbol) => void;

/**
 * Plugin decorator to mark a class as a plugin module
 * Extends the NestJS @Module decorator with plugin-specific metadata
 */
export function Plugin(config: PluginConfiguration): PluginClassDecorator {
  return function <TConstructor extends Constructor>(constructor: TConstructor): TConstructor {
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

    return constructor;
  };
}

/**
 * Plugin service decorator to mark a class as a plugin service
 */
export function PluginService(config?: { name?: string; singleton?: boolean; lazy?: boolean }): PluginClassDecorator {
  return function <TConstructor extends Constructor>(constructor: TConstructor): TConstructor {
    // Store service configuration
    Reflect.defineMetadata('plugin:service:config', config ?? {}, constructor);

    // Mark as plugin service
    Reflect.defineMetadata('plugin:service', true, constructor);

    // Apply @Injectable decorator
    Injectable()(constructor);

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
): ClassDecorator {
  return function (constructor: Function): void {
    // Store controller configuration
    Reflect.defineMetadata('plugin:controller:config', config ?? {}, constructor);

    // Store controller path
    Reflect.defineMetadata('plugin:controller:path', path ?? '', constructor);

    // Mark as plugin controller
    Reflect.defineMetadata('plugin:controller', true, constructor);

    // Apply @Controller decorator if path is provided
    if (path) {
      Controller(path)(constructor);
    } else {
      Controller()(constructor);
    }
  };
}

/**
 * Plugin event handler decorator
 */
export function PluginEventHandler(eventType: string | string[]) {
  return function <T>(target: object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void {
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
  return function <T>(target: object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void {
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
  return function <T>(target: object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void {
    const permissions = Array.isArray(permission) ? permission : [permission];

    // Store permission metadata
    Reflect.defineMetadata('plugin:permission:required', permissions, target, propertyKey);

    return descriptor;
  };
}

/**
 * Plugin route decorator
 */
export function PluginRoute(config: Pick<PluginRouteConfig, 'path' | 'method' | 'permissions' | 'middleware'>) {
  return function <T>(target: object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void {
    // Store route configuration
    Reflect.defineMetadata('plugin:route:config', config, target, propertyKey);
    Reflect.defineMetadata('plugin:route', true, target, propertyKey);

    return descriptor;
  };
}

/**
 * Plugin configuration decorator for properties
 */
export function PluginConfig(key?: string, defaultValue?: unknown): PluginPropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    const configKey = key ?? String(propertyKey);

    // Store config metadata
    Reflect.defineMetadata('plugin:config:key', configKey, target, propertyKey);
    Reflect.defineMetadata('plugin:config:default', defaultValue, target, propertyKey);
    Reflect.defineMetadata('plugin:config:property', true, target, propertyKey);
  };
}

/**
 * Plugin logger decorator
 */
export function PluginLogger(context?: string): PluginPropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
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
  static getPluginConfig(target: Type<object> | Constructor | object): PluginConfiguration | undefined {
    return Reflect.getMetadata('plugin:config', target) as PluginConfiguration | undefined;
  }

  /**
   * Get plugin ID from a class
   */
  static getPluginId(target: Type<object> | Constructor | object): string | undefined {
    return Reflect.getMetadata('plugin:id', target) as string | undefined;
  }

  /**
   * Get plugin name from a class
   */
  static getPluginName(target: Type<object> | Constructor | object): string | undefined {
    return Reflect.getMetadata('plugin:name', target) as string | undefined;
  }

  /**
   * Get plugin version from a class
   */
  static getPluginVersion(target: Type<object> | Constructor | object): string | undefined {
    return Reflect.getMetadata('plugin:version', target) as string | undefined;
  }

  /**
   * Get plugin capabilities from a class
   */
  static getPluginCapabilities(target: Type<object> | Constructor | object): string[] {
    return (Reflect.getMetadata('plugin:capabilities', target) as string[] | undefined) ?? [];
  }

  /**
   * Get plugin permissions from a class
   */
  static getPluginPermissions(target: Type<object> | Constructor | object): Record<string, string[]> {
    return (Reflect.getMetadata('plugin:permissions', target) as Record<string, string[]> | undefined) ?? {};
  }

  /**
   * Get plugin dependencies from a class
   */
  static getPluginDependencies(target: Type<object> | Constructor | object): Record<string, string> {
    return (Reflect.getMetadata('plugin:dependencies', target) as Record<string, string> | undefined) ?? {};
  }

  /**
   * Get plugin events from a class
   */
  static getPluginEvents(target: Type<object> | Constructor | object): string[] {
    return (Reflect.getMetadata('plugin:events', target) as string[] | undefined) ?? [];
  }

  /**
   * Check if a class is a plugin
   */
  static isPlugin(target: Type<object> | Constructor | object): boolean {
    return Boolean(Reflect.getMetadata('plugin:config', target));
  }

  /**
   * Check if a class is a plugin service
   */
  static isPluginService(target: Type<object> | Constructor | object): boolean {
    return Boolean(Reflect.getMetadata('plugin:service', target));
  }

  /**
   * Check if a class is a plugin controller
   */
  static isPluginController(target: Type<object> | Constructor | object): boolean {
    return Boolean(Reflect.getMetadata('plugin:controller', target));
  }

  /**
   * Get event handlers from a class
   */
  static getEventHandlers(target: Type<object> | Constructor | object): Array<{ method: string; eventTypes: string[] }> {
    const handlers: Array<{ method: string; eventTypes: string[] }> = [];
    let prototypeTarget: object;

    if ('prototype' in target && target.prototype) {
      prototypeTarget = target.prototype as object;
    } else {
      prototypeTarget = target as object;
    }

    const methodNames = Object.getOwnPropertyNames(prototypeTarget).filter((name) => name !== 'constructor' && typeof (prototypeTarget as Record<string, unknown>)[name] === 'function');
    for (const methodName of methodNames) {
      if (Reflect.getMetadata('plugin:event:handler', prototypeTarget, methodName) as boolean | undefined) {
        const eventTypes = (Reflect.getMetadata('plugin:event:types', prototypeTarget, methodName) as string[] | undefined) ?? [];
        handlers.push({ method: methodName, eventTypes });
      }
    }

    return handlers;
  }

  /**
   * Get hook handlers from a class
   */
  static getHookHandlers(target: Type<object> | Constructor | object): Array<{ method: string; hookName: string }> {
    const handlers: Array<{ method: string; hookName: string }> = [];
    let prototypeTarget: object;

    if ('prototype' in target && target.prototype) {
      prototypeTarget = target.prototype as object;
    } else {
      prototypeTarget = target as object;
    }

    const methodNames = Object.getOwnPropertyNames(prototypeTarget).filter((name) => name !== 'constructor' && typeof (prototypeTarget as Record<string, unknown>)[name] === 'function');
    for (const methodName of methodNames) {
      if (Reflect.getMetadata('plugin:hook:handler', prototypeTarget, methodName) as boolean | undefined) {
        const hookName = Reflect.getMetadata('plugin:hook:name', prototypeTarget, methodName) as string;
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
  static getMethodPermissions(target: object, methodName: string | symbol): string[] {
    return (Reflect.getMetadata('plugin:permission:required', target, methodName) as string[] | undefined) ?? [];
  }

  /**
   * Get route configuration for a method
   */
  static getRouteConfig(target: object, methodName: string | symbol): Pick<PluginRouteConfig, 'path' | 'method' | 'permissions' | 'middleware'> | undefined {
    return Reflect.getMetadata('plugin:route:config', target, methodName) as Pick<PluginRouteConfig, 'path' | 'method' | 'permissions' | 'middleware'> | undefined;
  }
}
