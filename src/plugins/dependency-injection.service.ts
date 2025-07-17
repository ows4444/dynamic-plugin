import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PluginDependency } from '../common/interfaces/plugin.interface';

export interface DependencyProvider {
  provide: string | symbol | Type<any>;
  useClass?: Type<any>;
  useValue?: any;
  useFactory?: (...args: any[]) => any;
  inject?: any[];
  scope?: 'singleton' | 'transient' | 'request';
}

export interface CircularDependencyDetection {
  path: string[];
  cycle: string[];
  detected: boolean;
}

export interface LazyProvider {
  token: string | symbol;
  factory: () => Promise<any>;
  loaded: boolean;
  instance?: any;
}

export interface DependencyGraph {
  node: string;
  dependencies: string[];
  dependents: string[];
}

@Injectable()
export class DependencyInjectionService {
  private readonly logger = new Logger(DependencyInjectionService.name);
  private readonly providers = new Map<string, DependencyProvider>();
  private readonly instances = new Map<string, any>();
  private readonly lazyProviders = new Map<string, LazyProvider>();
  private readonly resolutionStack = new Set<string>();
  private readonly dependencyGraph = new Map<string, DependencyGraph>();
  private readonly circularDependencies = new Map<string, CircularDependencyDetection>();

  constructor(
    private readonly moduleRef: ModuleRef
  ) {}

  async registerProvider(pluginId: string, provider: DependencyProvider): Promise<void> {
    this.logger.log(`Registering provider for plugin ${pluginId}: ${String(provider.provide)}`);
    
    const token = this.getProviderToken(provider.provide);
    const key = `${pluginId}:${token}`;
    
    this.providers.set(key, provider);
    this.updateDependencyGraph(key, provider);
    
    // Check for circular dependencies
    const circularCheck = await this.detectCircularDependencies(key);
    if (circularCheck.detected) {
      this.circularDependencies.set(key, circularCheck);
      this.logger.warn(`Circular dependency detected for ${key}:`, circularCheck.cycle);
    }
  }

  async registerLazyProvider(pluginId: string, token: string | symbol, factory: () => Promise<any>): Promise<void> {
    this.logger.log(`Registering lazy provider for plugin ${pluginId}: ${String(token)}`);
    
    const key = `${pluginId}:${this.getProviderToken(token)}`;
    
    this.lazyProviders.set(key, {
      token,
      factory,
      loaded: false
    });
  }

  async resolveProvider<T>(pluginId: string, token: string | symbol): Promise<T> {
    const key = `${pluginId}:${this.getProviderToken(token)}`;
    
    // Check if already resolved
    if (this.instances.has(key)) {
      return this.instances.get(key);
    }

    // Check for circular dependency
    if (this.resolutionStack.has(key)) {
      const circular = this.circularDependencies.get(key);
      if (circular) {
        return this.resolveCircularDependency(key);
      }
      throw new Error(`Circular dependency detected: ${Array.from(this.resolutionStack).join(' -> ')} -> ${key}`);
    }

    this.resolutionStack.add(key);

    try {
      let instance: T;

      // Check lazy providers first
      if (this.lazyProviders.has(key)) {
        instance = await this.resolveLazyProvider(key);
      } else {
        instance = await this.resolveRegularProvider(key);
      }

      this.instances.set(key, instance);
      return instance;
    } finally {
      this.resolutionStack.delete(key);
    }
  }

  async resolveDependencies(pluginId: string, dependencies: PluginDependency[]): Promise<any[]> {
    this.logger.log(`Resolving dependencies for plugin ${pluginId}`);
    
    const resolved: any[] = [];
    
    for (const dep of dependencies) {
      try {
        const instance = await this.resolveProvider(pluginId, dep.name);
        resolved.push(instance);
      } catch (error) {
        if (dep.optional) {
          this.logger.warn(`Optional dependency failed to resolve: ${dep.name}`);
          resolved.push(null);
        } else {
          throw new Error(`Failed to resolve required dependency ${dep.name}: ${error.message}`);
        }
      }
    }
    
    return resolved;
  }

  async clearPluginProviders(pluginId: string): Promise<void> {
    this.logger.log(`Clearing providers for plugin ${pluginId}`);
    
    const keysToRemove = Array.from(this.providers.keys())
      .filter(key => key.startsWith(`${pluginId}:`));
    
    for (const key of keysToRemove) {
      this.providers.delete(key);
      this.instances.delete(key);
      this.lazyProviders.delete(key);
      this.dependencyGraph.delete(key);
      this.circularDependencies.delete(key);
    }
  }

  getDependencyGraph(pluginId?: string): Map<string, DependencyGraph> {
    if (pluginId) {
      const filtered = new Map<string, DependencyGraph>();
      for (const [key, value] of this.dependencyGraph) {
        if (key.startsWith(`${pluginId}:`)) {
          filtered.set(key, value);
        }
      }
      return filtered;
    }
    return this.dependencyGraph;
  }

  getCircularDependencies(pluginId?: string): Map<string, CircularDependencyDetection> {
    if (pluginId) {
      const filtered = new Map<string, CircularDependencyDetection>();
      for (const [key, value] of this.circularDependencies) {
        if (key.startsWith(`${pluginId}:`)) {
          filtered.set(key, value);
        }
      }
      return filtered;
    }
    return this.circularDependencies;
  }

  private async resolveLazyProvider<T>(key: string): Promise<T> {
    const lazyProvider = this.lazyProviders.get(key);
    if (!lazyProvider) {
      throw new Error(`Lazy provider not found: ${key}`);
    }

    if (!lazyProvider.loaded) {
      this.logger.log(`Loading lazy provider: ${key}`);
      lazyProvider.instance = await lazyProvider.factory();
      lazyProvider.loaded = true;
    }

    return lazyProvider.instance;
  }

  private async resolveRegularProvider<T>(key: string): Promise<T> {
    const provider = this.providers.get(key);
    if (!provider) {
      // Try to get from NestJS module
      try {
        const token = key.split(':')[1];
        return this.moduleRef.get(token);
      } catch (error) {
        throw new Error(`Provider not found: ${key}`);
      }
    }

    if (provider.useValue !== undefined) {
      return provider.useValue;
    }

    if (provider.useFactory) {
      const deps = await this.resolveDependencies(
        key.split(':')[0],
        (provider.inject || []).map(dep => ({ name: dep, version: '*' }))
      );
      return provider.useFactory(...deps);
    }

    if (provider.useClass) {
      return new provider.useClass();
    }

    throw new Error(`Invalid provider configuration: ${key}`);
  }

  private async resolveCircularDependency<T>(key: string): Promise<T> {
    this.logger.warn(`Resolving circular dependency: ${key}`);
    
    // Create a proxy that will be resolved later
    const proxy = new Proxy({}, {
      get: (_, prop) => {
        const instance = this.instances.get(key);
        if (instance && prop in instance) {
          return instance[prop];
        }
        throw new Error(`Property ${String(prop)} not available on circular dependency ${key}`);
      }
    });

    // Temporarily set the proxy to break the cycle
    this.instances.set(key, proxy);
    
    try {
      // Resolve the actual instance
      const actualInstance = await this.resolveRegularProvider<T>(key);
      
      // Replace the proxy with the actual instance
      this.instances.set(key, actualInstance);
      
      return actualInstance;
    } catch (error) {
      this.instances.delete(key);
      throw error;
    }
  }

  private async detectCircularDependencies(key: string): Promise<CircularDependencyDetection> {
    const visited = new Set<string>();
    const path: string[] = [];
    
    const detect = (currentKey: string): CircularDependencyDetection => {
      if (path.includes(currentKey)) {
        const cycleStart = path.indexOf(currentKey);
        return {
          path: [...path],
          cycle: path.slice(cycleStart).concat(currentKey),
          detected: true
        };
      }

      if (visited.has(currentKey)) {
        return { path: [...path], cycle: [], detected: false };
      }

      visited.add(currentKey);
      path.push(currentKey);

      const provider = this.providers.get(currentKey);
      if (provider && provider.inject) {
        for (const dep of provider.inject) {
          const depKey = `${currentKey.split(':')[0]}:${this.getProviderToken(dep)}`;
          const result = detect(depKey);
          if (result.detected) {
            return result;
          }
        }
      }

      path.pop();
      return { path: [...path], cycle: [], detected: false };
    };

    return detect(key);
  }

  private updateDependencyGraph(key: string, provider: DependencyProvider): void {
    const dependencies = (provider.inject || []).map(dep => 
      `${key.split(':')[0]}:${this.getProviderToken(dep)}`
    );

    this.dependencyGraph.set(key, {
      node: key,
      dependencies,
      dependents: []
    });

    // Update dependents
    for (const dep of dependencies) {
      const depGraph = this.dependencyGraph.get(dep);
      if (depGraph) {
        depGraph.dependents.push(key);
      }
    }
  }

  async registerPluginDependencies(pluginId: string, dependencies: PluginDependency[]): Promise<void> {
    this.logger.log(`Registering dependencies for plugin ${pluginId}`);
    
    for (const dependency of dependencies) {
      const provider: DependencyProvider = {
        provide: dependency.name,
        useValue: dependency, // Store the dependency metadata
        scope: 'singleton'
      };
      
      await this.registerProvider(pluginId, provider);
    }
  }

  async unregisterPluginDependencies(pluginId: string): Promise<void> {
    this.logger.log(`Unregistering dependencies for plugin ${pluginId}`);
    await this.clearPluginProviders(pluginId);
  }

  async resolvePluginDependencies(pluginId: string): Promise<void> {
    this.logger.log(`Resolving dependencies for plugin ${pluginId}`);
    
    const pluginProviders = Array.from(this.providers.entries())
      .filter(([key]) => key.startsWith(pluginId))
      .map(([, provider]) => provider);
    
    for (const provider of pluginProviders) {
      if (provider.inject && provider.inject.length > 0) {
        await this.resolveDependencies(pluginId, provider.inject.map(dep => ({ name: dep, version: '*' })));
      }
    }
  }

  async executePluginMethod(pluginId: string, methodName: string, args: any[]): Promise<any> {
    this.logger.log(`Executing method ${methodName} for plugin ${pluginId}`);
    
    try {
      const pluginInstance = await this.resolveProvider(pluginId, pluginId);
      
      if (!pluginInstance || typeof pluginInstance[methodName] !== 'function') {
        throw new Error(`Method ${methodName} not found in plugin ${pluginId}`);
      }
      
      return await pluginInstance[methodName](...args);
    } catch (error) {
      this.logger.error(`Failed to execute method ${methodName} for plugin ${pluginId}:`, error);
      throw error;
    }
  }

  private getProviderToken(token: string | symbol | Type<any>): string {
    if (typeof token === 'string') {
      return token;
    }
    if (typeof token === 'symbol') {
      return token.toString();
    }
    return token.name;
  }
}