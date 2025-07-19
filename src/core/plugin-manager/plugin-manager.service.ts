import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs-extra';
import * as path from 'path';
import type {
  EventBus,
  InstallationResult,
  LoadResult,
  PluginContext,
  PluginEvent,
  PluginInstance,
  PluginInterop,
  PluginManifest,
  PluginMetadata,
  PluginSource,
  ReloadResult,
  SecurityContext,
  SharedResource,
  UnloadResult,
  UpdateResult,
} from '@/types/plugin.types';
import { PluginStatus } from '@/types/plugin.types';
import type { PluginRegistryService } from '@/core/plugin-registry/plugin-registry.service';

@Injectable()
export class PluginManagerService {
  private readonly logger = new Logger(PluginManagerService.name);
  private readonly pluginInstances = new Map<string, PluginInstance>();
  private readonly installedPath: string;
  private readonly cachePath: string;
  private readonly tempPath: string;

  constructor(
    private readonly registryService: PluginRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.installedPath = path.join(process.cwd(), 'src', 'plugins', 'installed');
    this.cachePath = path.join(process.cwd(), 'src', 'plugins', 'cache');
    this.tempPath = path.join(process.cwd(), 'src', 'plugins', 'temp');
    void this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    await Promise.all([fs.ensureDir(this.installedPath), fs.ensureDir(this.cachePath), fs.ensureDir(this.tempPath)]);
  }

  async installPlugin(source: PluginSource): Promise<InstallationResult> {
    const startTime = Date.now();
    const tempId = `temp-${Date.now()}`;
    const tempDir = path.join(this.tempPath, tempId);

    try {
      this.logger.log(`Installing plugin from ${source.type}: ${source.location}`);

      // Create temporary directory
      await fs.ensureDir(tempDir);

      // Download/copy plugin files based on source type
      await this.downloadPlugin(source, tempDir);

      // Load and validate manifest
      const manifestPath = path.join(tempDir, 'plugin.manifest.json');
      if (!(await fs.pathExists(manifestPath))) {
        throw new Error('Plugin manifest not found');
      }

      const manifest = (await fs.readJson(manifestPath)) as PluginManifest;
      const validationResult = this.registryService.validatePlugin(manifest);

      if (!validationResult.valid) {
        throw new Error(`Plugin validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Check compatibility
      const pluginId = `${manifest.name}@${manifest.version}`;
      const compatibilityResult = this.registryService.checkCompatibility(pluginId);

      if (!compatibilityResult.compatible) {
        this.logger.warn(`Plugin compatibility issues: ${compatibilityResult.reasons.join(', ')}`);
      }

      // Check if plugin already exists
      const existingPlugin = this.registryService.getPlugin(pluginId);
      if (existingPlugin?.status.installed) {
        throw new Error(`Plugin ${pluginId} is already installed`);
      }

      // Install dependencies if needed
      this.installDependencies(manifest);

      // Move plugin to installed directory
      const installedDir = path.join(this.installedPath, manifest.name);
      await fs.remove(installedDir); // Remove if exists
      await fs.move(tempDir, installedDir);

      // Create plugin metadata
      const metadata: PluginMetadata = {
        id: pluginId,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        license: manifest.license,
        status: PluginStatus.INSTALLED,
        capabilities: manifest.capabilities ?? [],
        permissions: manifest.permissions ?? {},
        dependencies: Object.entries(manifest.dependencies ?? {}).map(([name, version]) => ({
          name,
          version,
          required: true,
        })),
        pluginDependencies: manifest.pluginDependencies ?? {},
        loadTime: 0,
        memory: 0,
        cpu: 0,
        main: manifest.main,
        types: manifest.types,
        engines: manifest.engines,
        hooks: manifest.hooks ?? {},
        configuration: manifest.configuration ?? {},
        metadata: manifest.metadata ?? {
          category: 'general',
          tags: [],
        },
      };

      // Register plugin
      await this.registryService.registerPlugin(metadata);

      // Run installation hook if exists
      if (manifest.hooks?.onInstall) {
        await this.runPluginHook(installedDir, manifest.hooks.onInstall, 'install');
      }

      const installTime = Date.now() - startTime;
      this.eventEmitter.emit('plugin.installed', { pluginId, metadata, installTime });

      this.logger.log(`Plugin installed successfully: ${pluginId} (${installTime}ms)`);

      return {
        success: true,
        pluginId,
        version: manifest.version,
        message: `Plugin ${manifest.name} installed successfully`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Plugin installation failed: ${errorMessage}`, error);

      // Cleanup temporary directory
      await fs.remove(tempDir).catch(() => {
        // Intentionally empty - cleanup errors are not critical
      });

      return {
        success: false,
        pluginId: '',
        version: '',
        message: errorMessage,
        errors: [errorMessage],
      };
    }
  }

  private async downloadPlugin(source: PluginSource, targetDir: string): Promise<string[]> {
    switch (source.type) {
      case 'file':
        return this.downloadFromFile(source.location, targetDir);
      case 'npm':
        return this.downloadFromNpm(source.location, source.version, targetDir);
      case 'git':
        return this.downloadFromGit(source.location, targetDir);
      case 'url':
        return this.downloadFromUrl(source.location, targetDir);
      default:
        throw new Error(`Unsupported plugin source type: ${String(source.type)}`);
    }
  }

  private async downloadFromFile(sourcePath: string, targetDir: string): Promise<string[]> {
    if (!(await fs.pathExists(sourcePath))) {
      throw new Error(`Plugin file not found: ${sourcePath}`);
    }

    const stats = await fs.stat(sourcePath);
    if (stats.isDirectory()) {
      await fs.copy(sourcePath, targetDir);
    } else {
      // Assume it's a tarball or zip
      throw new Error('Compressed plugin files not yet supported');
    }

    const files = await this.getPluginFiles(targetDir);
    return files;
  }

  private async downloadFromNpm(packageName: string, _version = 'latest', _targetDir: string): Promise<string[]> {
    // This would typically use npm/yarn APIs or spawn npm install
    return Promise.reject(new Error('NPM plugin installation not yet implemented'));
  }

  private async downloadFromGit(_gitUrl: string, _targetDir: string): Promise<string[]> {
    // This would typically use git clone
    return Promise.reject(new Error('Git plugin installation not yet implemented'));
  }

  private async downloadFromUrl(_url: string, _targetDir: string): Promise<string[]> {
    // This would typically download and extract from URL
    return Promise.reject(new Error('URL plugin installation not yet implemented'));
  }

  private async getPluginFiles(pluginDir: string): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      const items = await fs.readdir(dir);
      const promises = items.map(async (item) => {
        const itemPath = path.join(dir, item);
        const stats = await fs.stat(itemPath);
        if (stats.isDirectory()) {
          await walk(itemPath);
        } else {
          files.push(path.relative(pluginDir, itemPath));
        }
      });
      await Promise.all(promises);
    };

    await walk(pluginDir);
    return files;
  }

  private installDependencies(manifest: PluginManifest): void {
    // Install NPM dependencies
    if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
      this.logger.debug('Installing NPM dependencies...');
      // This would run npm install for the plugin dependencies
    }

    // Install plugin dependencies
    if (manifest.pluginDependencies) {
      for (const [depName, depVersion] of Object.entries(manifest.pluginDependencies)) {
        const depPlugin = this.registryService.getPlugin(`${depName}@${depVersion}`);
        if (!depPlugin?.status.installed) {
          this.logger.warn(`Plugin dependency not found: ${depName}@${depVersion}`);
          // Could attempt to auto-install dependency here
        }
      }
    }
  }

  private async runPluginHook(pluginDir: string, hookScript: string, hookType: string): Promise<void> {
    try {
      const hookPath = path.join(pluginDir, hookScript);
      if (await fs.pathExists(hookPath)) {
        this.logger.debug(`Running ${hookType} hook: ${hookScript}`);
        // This would execute the hook script in a secure context
        // For now, we'll just log it
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to run ${hookType} hook: ${errorMessage}`);
    }
  }

  async loadPlugin(pluginId: string): Promise<LoadResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Loading plugin: ${pluginId}`);

      const registryEntry = this.registryService.getPlugin(pluginId);
      if (!registryEntry) {
        throw new Error(`Plugin not found in registry: ${pluginId}`);
      }

      if (!registryEntry.status.installed) {
        throw new Error(`Plugin not installed: ${pluginId}`);
      }

      if (this.pluginInstances.has(pluginId)) {
        throw new Error(`Plugin already loaded: ${pluginId}`);
      }

      const pluginDir = path.join(this.installedPath, registryEntry.name);
      const manifestPath = path.join(pluginDir, 'plugin.manifest.json');
      const manifest = (await fs.readJson(manifestPath)) as PluginManifest;

      // Update plugin status
      await this.registryService.updatePluginStatus(pluginId, {
        enabled: true,
        lastUsed: new Date(),
      });

      // Create plugin context
      const context = this.createPluginContext(pluginId, manifest);

      // Create plugin instance
      const instance: PluginInstance = {
        id: pluginId,
        metadata: {
          id: pluginId,
          name: registryEntry.name,
          version: registryEntry.version,
          description: registryEntry.description,
          author: registryEntry.author,
          license: registryEntry.license,
          status: PluginStatus.LOADING,
          capabilities: registryEntry.capabilities,
          permissions: registryEntry.permissions,
          dependencies: registryEntry.dependencies,
          pluginDependencies: registryEntry.pluginDependencies,
          loadTime: 0,
          memory: 0,
          cpu: 0,
          main: '',
          types: undefined,
          engines: registryEntry.engines,
          hooks: {},
          configuration: {},
          metadata: {
            category: registryEntry.category,
            tags: registryEntry.tags,
            documentation: registryEntry.documentation,
            repository: registryEntry.repository,
          },
        },
        module: null, // Will be set by runtime engine
        context,
        status: PluginStatus.LOADING,
        startTime: new Date(),
        lastActivity: new Date(),
      };

      this.pluginInstances.set(pluginId, instance);

      // Run startup hook if exists
      if (manifest.hooks?.onStart) {
        await this.runPluginHook(pluginDir, manifest.hooks.onStart, 'start');
      }

      // Update status to loaded
      instance.status = PluginStatus.LOADED;
      instance.metadata.status = PluginStatus.LOADED;

      const loadTime = Date.now() - startTime;
      instance.metadata.loadTime = loadTime;

      this.eventEmitter.emit('plugin.loaded', { pluginId, instance, loadTime });

      this.logger.log(`Plugin loaded successfully: ${pluginId} (${loadTime}ms)`);

      return {
        success: true,
        pluginId,
        loadTime,
        message: `Plugin ${registryEntry.name} loaded successfully`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Plugin loading failed: ${errorMessage}`, error);

      // Cleanup if partially loaded
      this.pluginInstances.delete(pluginId);

      return {
        success: false,
        pluginId,
        loadTime: Date.now() - startTime,
        message: errorMessage,
        errors: [errorMessage],
      };
    }
  }

  private createPluginContext(pluginId: string, manifest: PluginManifest): PluginContext {
    // Create EventBus adapter for EventEmitter2
    const eventBus: EventBus = {
      publish: async (event: PluginEvent): Promise<void> => {
        this.eventEmitter.emit(event.type, event);
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
      subscribe: async (eventPattern: string, handler: (event: PluginEvent) => void): Promise<string> => {
        const subscriptionId = `${pluginId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        this.eventEmitter.on(eventPattern, handler);
        await new Promise((resolve) => setTimeout(resolve, 0));
        return subscriptionId;
      },
      unsubscribe: async (subscriptionId: string): Promise<void> => {
        // Implementation would track and remove specific subscription
        // For now, this is a placeholder
        this.logger.debug(`Unsubscribing ${subscriptionId}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
    };

    // Create Security Context
    const security: SecurityContext = {
      pluginId,
      permissions: manifest.permissions ?? {},
      isolation: false,
      resourceLimits: {
        memory: 512 * 1024 * 1024, // 512MB
        cpu: 100, // 100%
        network: 100 * 1024 * 1024, // 100MB
        filesystem: 1024 * 1024 * 1024, // 1GB
      },
    };

    // Create Plugin Interop service
    const interop: PluginInterop = {
      sendMessage: async (target: string, message: unknown): Promise<void> => {
        this.eventEmitter.emit('plugin.message', { from: pluginId, to: target, message });
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
      broadcastEvent: async (event: PluginEvent): Promise<void> => {
        this.eventEmitter.emit('plugin.broadcast', { source: pluginId, event });
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
      subscribeToEvents: async (eventTypes: string[]): Promise<void> => {
        eventTypes.forEach((eventType) => {
          this.eventEmitter.on(eventType, (event: PluginEvent) => {
            this.logger.debug(`Plugin ${pluginId} received event: ${eventType}`, event);
          });
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
      callPluginMethod: async (targetPluginId: string, method: string, args: unknown[]): Promise<unknown> => {
        // Implementation would call method on target plugin
        // For now, this is a placeholder
        this.logger.debug(`Plugin ${pluginId} calling method ${method} on ${targetPluginId}`, args);
        await new Promise((resolve) => setTimeout(resolve, 0));
        return undefined;
      },
      shareResource: async (resource: SharedResource): Promise<void> => {
        // Implementation would share resource with other plugins
        // For now, this is a placeholder
        this.logger.debug(`Plugin ${pluginId} sharing resource: ${resource.id}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
    };

    // Return properly typed PluginContext
    return {
      pluginId,
      config: {},
      logger: this.logger,
      eventBus,
      security,
      interop,
    };
  }

  async unloadPlugin(pluginId: string): Promise<UnloadResult> {
    try {
      this.logger.log(`Unloading plugin: ${pluginId}`);

      const instance = this.pluginInstances.get(pluginId);
      if (!instance) {
        throw new Error(`Plugin not loaded: ${pluginId}`);
      }

      // Run shutdown hook if exists
      const pluginDir = path.join(this.installedPath, instance.metadata.name);
      const manifestPath = path.join(pluginDir, 'plugin.manifest.json');

      if (await fs.pathExists(manifestPath)) {
        const manifest = (await fs.readJson(manifestPath)) as PluginManifest;
        if (manifest.hooks?.onStop) {
          await this.runPluginHook(pluginDir, manifest.hooks.onStop, 'stop');
        }
      }

      // Update status
      instance.status = PluginStatus.STOPPED;

      // Remove from instances
      this.pluginInstances.delete(pluginId);

      // Update registry status
      await this.registryService.updatePluginStatus(pluginId, {
        enabled: false,
      });

      this.eventEmitter.emit('plugin.unloaded', { pluginId });

      this.logger.log(`Plugin unloaded successfully: ${pluginId}`);

      return {
        success: true,
        pluginId,
        message: `Plugin unloaded successfully`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Plugin unloading failed: ${errorMessage}`, error);

      return {
        success: false,
        pluginId,
        message: errorMessage,
        errors: [errorMessage],
      };
    }
  }

  async reloadPlugin(pluginId: string): Promise<ReloadResult> {
    try {
      this.logger.log(`Reloading plugin: ${pluginId}`);

      // Unload first
      const unloadResult = await this.unloadPlugin(pluginId);
      if (!unloadResult.success) {
        throw new Error(`Failed to unload plugin: ${unloadResult.message}`);
      }

      // Wait a bit for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Load again
      const loadResult = await this.loadPlugin(pluginId);
      if (!loadResult.success) {
        throw new Error(`Failed to load plugin: ${loadResult.message}`);
      }

      this.logger.log(`Plugin reloaded successfully: ${pluginId}`);

      return {
        success: true,
        pluginId,
        loadTime: loadResult.loadTime,
        message: `Plugin reloaded successfully`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Plugin reloading failed: ${errorMessage}`, error);

      return {
        success: false,
        pluginId,
        loadTime: 0,
        message: errorMessage,
        errors: [errorMessage],
      };
    }
  }

  async updatePlugin(pluginId: string, version: string): Promise<UpdateResult> {
    try {
      this.logger.log(`Updating plugin: ${pluginId} to version ${version}`);

      // This would implement plugin update logic
      // For now, we'll just return a placeholder

      throw new Error('Plugin updates not yet implemented');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Plugin update failed: ${errorMessage}`, error);

      return Promise.resolve({
        success: false,
        pluginId,
        fromVersion: '',
        toVersion: version,
        message: errorMessage,
        errors: [errorMessage],
      });
    }
  }

  getPluginStatus(pluginId: string): PluginStatus {
    const instance = this.pluginInstances.get(pluginId);
    if (instance) {
      return instance.status;
    }

    const registryEntry = this.registryService.getPlugin(pluginId);
    if (registryEntry?.status.installed) {
      return PluginStatus.INSTALLED;
    }

    return PluginStatus.UNINSTALLED;
  }

  getLoadedPlugins(): PluginInstance[] {
    return Array.from(this.pluginInstances.values());
  }

  getPluginInstance(pluginId: string): PluginInstance | null {
    return this.pluginInstances.get(pluginId) ?? null;
  }

  async uninstallPlugin(pluginId: string): Promise<boolean> {
    try {
      this.logger.log(`Uninstalling plugin: ${pluginId}`);

      // Unload if loaded
      if (this.pluginInstances.has(pluginId)) {
        const unloadResult = await this.unloadPlugin(pluginId);
        if (!unloadResult.success) {
          this.logger.warn(`Failed to unload plugin during uninstall: ${unloadResult.message}`);
        }
      }

      const registryEntry = this.registryService.getPlugin(pluginId);
      if (!registryEntry) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      // Run uninstallation hook if exists
      const pluginDir = path.join(this.installedPath, registryEntry.name);
      const manifestPath = path.join(pluginDir, 'plugin.manifest.json');

      if (await fs.pathExists(manifestPath)) {
        const manifest = (await fs.readJson(manifestPath)) as PluginManifest;
        if (manifest.hooks?.onUninstall) {
          await this.runPluginHook(pluginDir, manifest.hooks.onUninstall, 'uninstall');
        }
      }

      // Remove plugin files
      await fs.remove(pluginDir);

      // Unregister from registry
      await this.registryService.unregisterPlugin(pluginId);

      this.eventEmitter.emit('plugin.uninstalled', { pluginId });

      this.logger.log(`Plugin uninstalled successfully: ${pluginId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Plugin uninstallation failed: ${errorMessage}`, error);
      return false;
    }
  }
}
