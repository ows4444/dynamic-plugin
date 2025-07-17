import { Injectable, Logger } from '@nestjs/common';
import * as ivm from 'isolated-vm';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IPlugin, PluginLoadOptions, PluginManifest } from '../common/interfaces/plugin.interface';
import { PluginLoadException, PluginValidationException } from '../common/exceptions/plugin.exceptions';

@Injectable()
export class PluginLoaderService {
  private readonly logger = new Logger(PluginLoaderService.name);
  private readonly pluginCache = new Map<string, IPlugin>();
  private readonly pluginDirectory = './plugins';

  async loadPlugin(pluginId: string, options: PluginLoadOptions = {}): Promise<IPlugin> {
    this.logger.log(`Loading plugin: ${pluginId}`);

    if (this.pluginCache.has(pluginId) && !options.hotReload) {
      this.logger.log(`Plugin ${pluginId} loaded from cache`);
      return this.pluginCache.get(pluginId);
    }

    try {
      const pluginPath = path.resolve(this.pluginDirectory, pluginId);
      const manifestPath = path.join(pluginPath, 'plugin.manifest.json');

      if (!await fs.pathExists(pluginPath)) {
        throw new Error(`Plugin directory not found: ${pluginPath}`);
      }

      if (!await fs.pathExists(manifestPath)) {
        throw new Error(`Plugin manifest not found: ${manifestPath}`);
      }

      const manifest = await this.loadManifest(manifestPath);
      this.validateManifest(manifest);

      const plugin = await this.createPluginInstance(pluginPath, manifest, options);
      
      if (!options.hotReload) {
        this.pluginCache.set(pluginId, plugin);
      }

      this.logger.log(`Plugin ${pluginId} loaded successfully`);
      return plugin;
    } catch (error) {
      this.logger.error(`Failed to load plugin ${pluginId}:`, error);
      throw new PluginLoadException(pluginId, error.message);
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    this.logger.log(`Unloading plugin: ${pluginId}`);
    
    if (this.pluginCache.has(pluginId)) {
      const plugin = this.pluginCache.get(pluginId);
      
      if (plugin && plugin.destroy) {
        await plugin.destroy();
      }
      
      this.pluginCache.delete(pluginId);
    }
  }

  async reloadPlugin(pluginId: string, options: PluginLoadOptions = {}): Promise<IPlugin> {
    await this.unloadPlugin(pluginId);
    return await this.loadPlugin(pluginId, { ...options, hotReload: true });
  }

  async validatePluginDependencies(pluginId: string, manifest: PluginManifest): Promise<void> {
    if (!manifest.dependencies || manifest.dependencies.length === 0) {
      return;
    }

    for (const dependency of manifest.dependencies) {
      try {
        require.resolve(dependency.name);
      } catch (error) {
        if (!dependency.optional) {
          throw new Error(`Missing required dependency: ${dependency.name}`);
        }
        this.logger.warn(`Optional dependency not found: ${dependency.name}`);
      }
    }
  }

  private async loadManifest(manifestPath: string): Promise<PluginManifest> {
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(manifestContent);
    } catch (error) {
      throw new Error(`Failed to load manifest: ${error.message}`);
    }
  }

  private validateManifest(manifest: PluginManifest): void {
    const errors: string[] = [];

    if (!manifest.name) {
      errors.push('Plugin name is required');
    }

    if (!manifest.version) {
      errors.push('Plugin version is required');
    }

    if (!manifest.main) {
      errors.push('Plugin main entry point is required');
    }

    if (manifest.minimumNodeVersion) {
      const currentVersion = process.version;
      const requiredVersion = manifest.minimumNodeVersion;
      
      if (!this.isVersionCompatible(currentVersion, requiredVersion)) {
        errors.push(`Node.js version ${requiredVersion} or higher is required, current: ${currentVersion}`);
      }
    }

    if (errors.length > 0) {
      throw new PluginValidationException(manifest.name, errors);
    }
  }

  private async createPluginInstance(
    pluginPath: string, 
    manifest: PluginManifest, 
    options: PluginLoadOptions
  ): Promise<IPlugin> {
    const mainFile = path.resolve(pluginPath, manifest.main);

    if (!await fs.pathExists(mainFile)) {
      throw new Error(`Main file not found: ${mainFile}`);
    }

    await this.validatePluginDependencies(manifest.name, manifest);

    if (options.sandboxed) {
      return await this.createSandboxedPlugin(mainFile, manifest, options);
    } else {
      return await this.createDirectPlugin(mainFile, manifest, options);
    }
  }

  private async createSandboxedPlugin(
    mainFile: string, 
    manifest: PluginManifest, 
    options: PluginLoadOptions
  ): Promise<IPlugin> {
    const pluginCode = await fs.readFile(mainFile, 'utf-8');
    
    try {
      const isolate = new ivm.Isolate({ memoryLimit: 128 });
      const context = isolate.createContextSync();
      const jail = context.global;
      jail.setSync('global', jail.derefInto());

      // Set up sandbox environment
      jail.setSync('require', this.createSandboxRequire(options.permissions || []));
      jail.setSync('console', this.createSandboxConsole(manifest.name));
      jail.setSync('Buffer', Buffer);
      jail.setSync('process', {
        env: process.env,
        version: process.version,
        nextTick: process.nextTick.bind(process)
      });
      jail.setSync('setTimeout', setTimeout);
      jail.setSync('setInterval', setInterval);
      jail.setSync('clearTimeout', clearTimeout);
      jail.setSync('clearInterval', clearInterval);
      jail.setSync('JSON', JSON);
      jail.setSync('Math', Math);
      jail.setSync('Date', Date);
      jail.setSync('RegExp', RegExp);
      jail.setSync('Error', Error);
      jail.setSync('TypeError', TypeError);
      jail.setSync('RangeError', RangeError);
      jail.setSync('ReferenceError', ReferenceError);
      jail.setSync('SyntaxError', SyntaxError);
      jail.setSync('URIError', URIError);
      jail.setSync('EvalError', EvalError);

      const script = isolate.compileScriptSync(pluginCode, { filename: mainFile });
      const PluginClass = script.runSync(context, {
        timeout: options.resourceLimits?.executionTime || 30000
      });
      
      const plugin = new PluginClass();
      
      if (!this.isValidPlugin(plugin)) {
        throw new Error('Plugin does not implement required interface');
      }

      return plugin;
    } catch (error) {
      throw new Error(`Failed to create sandboxed plugin: ${error.message}`);
    }
  }

  private async createDirectPlugin(
    mainFile: string, 
    manifest: PluginManifest, 
    options: PluginLoadOptions
  ): Promise<IPlugin> {
    try {
      delete require.cache[require.resolve(mainFile)];
      
      const PluginClass = require(mainFile);
      const plugin = new PluginClass();
      
      if (!this.isValidPlugin(plugin)) {
        throw new Error('Plugin does not implement required interface');
      }

      return plugin;
    } catch (error) {
      throw new Error(`Failed to create direct plugin: ${error.message}`);
    }
  }

  private createSandboxRequire(permissions: any[]): Function {
    const allowedModules = [
      'lodash',
      'moment',
      'uuid',
      'axios',
      'rxjs',
      'class-validator',
      'class-transformer'
    ];

    return (moduleName: string) => {
      if (allowedModules.includes(moduleName)) {
        return require(moduleName);
      }
      
      // Check if module is allowed by permissions
      const hasPermission = permissions.some(p => 
        p.name === 'require:modules' && p.level === 'admin'
      );
      
      if (hasPermission) {
        return require(moduleName);
      }
      
      throw new Error(`Module '${moduleName}' is not allowed in sandbox`);
    };
  }

  private createSandboxConsole(pluginName: string): Console {
    const logger = new Logger(`Plugin:${pluginName}`);
    
    return {
      log: (...args: any[]) => logger.log(args.join(' ')),
      error: (...args: any[]) => logger.error(args.join(' ')),
      warn: (...args: any[]) => logger.warn(args.join(' ')),
      info: (...args: any[]) => logger.log(args.join(' ')),
      debug: (...args: any[]) => logger.debug(args.join(' ')),
      trace: (...args: any[]) => logger.verbose(args.join(' ')),
      group: () => {},
      groupEnd: () => {},
      groupCollapsed: () => {},
      time: () => {},
      timeEnd: () => {},
      timeLog: () => {},
      count: () => {},
      countReset: () => {},
      clear: () => {},
      table: () => {},
      assert: () => {},
      dir: () => {},
      dirxml: () => {},
      profile: () => {},
      profileEnd: () => {},
      timeStamp: () => {}
    } as Console;
  }

  private isValidPlugin(plugin: any): plugin is IPlugin {
    return (
      typeof plugin === 'object' &&
      typeof plugin.name === 'string' &&
      typeof plugin.version === 'string' &&
      typeof plugin.initialize === 'function' &&
      typeof plugin.destroy === 'function'
    );
  }

  private isVersionCompatible(currentVersion: string, requiredVersion: string): boolean {
    const current = this.parseVersion(currentVersion);
    const required = this.parseVersion(requiredVersion);
    
    if (current.major > required.major) return true;
    if (current.major < required.major) return false;
    if (current.minor > required.minor) return true;
    if (current.minor < required.minor) return false;
    return current.patch >= required.patch;
  }

  private parseVersion(version: string): { major: number; minor: number; patch: number } {
    const cleaned = version.replace(/^v/, '');
    const parts = cleaned.split('.').map(Number);
    
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    };
  }
}