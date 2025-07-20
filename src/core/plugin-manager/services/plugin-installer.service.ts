import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs-extra';
import * as path from 'path';
import { PluginRegistryService } from '@/core/plugin-registry/plugin-registry.service';
import { InstallationResult, PluginManifest, PluginMetadata, PluginSource, PluginStatus } from '@types';

/**
 * Service responsible for plugin installation operations
 */
@Injectable()
export class PluginInstallerService {
  private readonly logger = new Logger(PluginInstallerService.name);
  private readonly installedPath: string;
  private readonly tempPath: string;

  constructor(
    private readonly registryService: PluginRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.installedPath = path.join(process.cwd(), 'src', 'plugins', 'installed');
    this.tempPath = path.join(process.cwd(), 'src', 'plugins', 'temp');
    void this.initializeDirectories();
  }

  /**
   * Initialize required directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await Promise.all([fs.ensureDir(this.installedPath), fs.ensureDir(this.tempPath)]);
    } catch (error) {
      this.logger.error('Failed to initialize installer directories', error);
    }
  }

  /**
   * Install a plugin from a source
   */
  async installPlugin(source: PluginSource): Promise<InstallationResult> {
    // Input validation
    if (!source.type || !source.location) {
      return this.createFailureResult('', '', 'Invalid plugin source - type and location are required');
    }

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

      const pluginId = `${manifest.name}@${manifest.version}`;

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
      const metadata = this.createPluginMetadata(manifest, pluginId);

      // Register plugin
      await this.registryService.registerPlugin(metadata);

      // Run installation hook if exists
      if (manifest.hooks.onInstall) {
        await this.runInstallationHook(installedDir, manifest.hooks.onInstall);
      }

      const installTime = Date.now() - startTime;

      this.eventEmitter.emit('plugin.installed', {
        pluginId,
        metadata,
        installTime,
        timestamp: new Date(),
      });

      this.logger.log(`Plugin installed successfully: ${pluginId} (${installTime}ms)`);

      return {
        success: true,
        pluginId,
        version: manifest.version,
        message: `Plugin ${manifest.name} installed successfully`,
        installTime: new Date(installTime),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Plugin installation failed: ${errorMessage}`, error);

      // Cleanup temporary directory
      await fs.remove(tempDir).catch(() => {
        // Intentionally empty - cleanup errors are not critical
      });

      return this.createFailureResult('', '', errorMessage);
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<boolean> {
    try {
      this.logger.log(`Uninstalling plugin: ${pluginId}`);

      const registryEntry = this.registryService.getPlugin(pluginId);
      if (!registryEntry) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      // Run uninstallation hook if exists
      const pluginDir = path.join(this.installedPath, registryEntry.name);
      await this.runUninstallationHook(pluginDir);

      // Remove plugin files
      await fs.remove(pluginDir);

      // Unregister from registry
      await this.registryService.unregisterPlugin(pluginId);

      this.eventEmitter.emit('plugin.uninstalled', {
        pluginId,
        timestamp: new Date(),
      });

      this.logger.log(`Plugin uninstalled successfully: ${pluginId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Plugin uninstallation failed: ${errorMessage}`, error);
      return false;
    }
  }

  /**
   * Download plugin files based on source type
   */
  private async downloadPlugin(source: PluginSource, targetDir: string): Promise<void> {
    switch (source.type) {
      case 'file':
        await this.downloadFromFile(source.location, targetDir);
        break;
      case 'npm':
        this.downloadFromNpm(source.location, source.version, targetDir);
        break;
      case 'git':
        this.downloadFromGit(source.location, targetDir);
        break;
      case 'url':
        this.downloadFromUrl(source.location, targetDir);
        break;
      case undefined: {
        throw new Error('Not implemented yet: undefined case');
      }
      default:
        throw new Error(`Unsupported plugin source type: ${String(source.type)}`);
    }
  }

  /**
   * Download from local file or directory
   */
  private async downloadFromFile(sourcePath: string, targetDir: string): Promise<void> {
    if (!(await fs.pathExists(sourcePath))) {
      throw new Error(`Plugin file not found: ${sourcePath}`);
    }

    const stats = await fs.stat(sourcePath);
    if (stats.isDirectory()) {
      await fs.copy(sourcePath, targetDir);
    } else {
      // For compressed files, we would extract them here
      throw new Error('Compressed plugin files not yet supported');
    }
  }

  /**
   * Download from NPM registry
   */
  private downloadFromNpm(_packageName: string, _version = 'latest', _targetDir: string): void {
    // This would typically use npm/yarn APIs or spawn npm install
    throw new Error('NPM plugin installation not yet implemented');
  }

  /**
   * Download from Git repository
   */
  private downloadFromGit(_gitUrl: string, _targetDir: string): void {
    // This would typically use git clone
    throw new Error('Git plugin installation not yet implemented');
  }

  /**
   * Download from URL
   */
  private downloadFromUrl(_url: string, _targetDir: string): void {
    // This would typically download and extract from URL
    throw new Error('URL plugin installation not yet implemented');
  }

  /**
   * Install plugin dependencies
   */
  private installDependencies(manifest: PluginManifest): void {
    // Install NPM dependencies
    if (Object.keys(manifest.dependencies).length > 0) {
      this.logger.debug('Installing NPM dependencies...');
      // This would run npm install for the plugin dependencies
    }

    // Install plugin dependencies
    for (const [depName, depVersion] of Object.entries(manifest.pluginDependencies)) {
      const depPlugin = this.registryService.getPlugin(`${depName}@${depVersion.version}`);
      if (!depPlugin?.status.installed) {
        this.logger.warn(`Plugin dependency not found: ${depName}@${depVersion.version}`);
        // Could attempt to auto-install dependency here
      }
    }
  }

  /**
   * Run installation hook
   */
  private async runInstallationHook(pluginDir: string, hookScript: string): Promise<void> {
    try {
      const hookPath = path.join(pluginDir, hookScript);
      if (await fs.pathExists(hookPath)) {
        this.logger.debug(`Running installation hook: ${hookScript}`);
        // This would execute the hook script in a secure context
        // For now, we'll just log it
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to run installation hook: ${errorMessage}`);
    }
  }

  /**
   * Run uninstallation hook
   */
  private async runUninstallationHook(pluginDir: string): Promise<void> {
    try {
      const manifestPath = path.join(pluginDir, 'plugin.manifest.json');

      if (await fs.pathExists(manifestPath)) {
        const manifest = (await fs.readJson(manifestPath)) as PluginManifest;

        if (manifest.hooks.onUninstall) {
          const hookPath = path.join(pluginDir, manifest.hooks.onUninstall);

          if (await fs.pathExists(hookPath)) {
            this.logger.debug(`Running uninstallation hook: ${manifest.hooks.onUninstall}`);
            // This would execute the hook script in a secure context
            // For now, we'll just log it
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to run uninstallation hook: ${errorMessage}`);
    }
  }

  /**
   * Create plugin metadata from manifest
   */
  private createPluginMetadata(manifest: PluginManifest, pluginId: string): PluginMetadata {
    return {
      ...this.createBaseMetadata(manifest, pluginId),
      ...this.createRuntimeMetadata(manifest),
      ...this.createExtendedMetadata(manifest),
    };
  }

  /**
   * Create base metadata properties
   */
  private createBaseMetadata(manifest: PluginManifest, pluginId: string) {
    return {
      id: pluginId,
      pluginId,
      name: manifest.name,
      version: manifest.version,
      status: PluginStatus.INSTALLED,
      loadTime: 0,
      memory: 0,
      cpu: 0,
      main: manifest.main,
      types: manifest.types,
      engines: manifest.engines,
      hooks: manifest.hooks,
      configuration: manifest.configuration,
      license: manifest.license,
      author: manifest.author,
    };
  }

  /**
   * Create runtime metadata
   */
  private createRuntimeMetadata(manifest: PluginManifest) {
    const metadata = manifest.metadata as any;
    return {
      runtimeMetadata: {
        category: metadata?.category ?? 'general',
        tags: metadata?.tags ?? [],
        documentation: metadata?.documentation,
        repository: metadata?.repository,
      },
      category: metadata?.category ?? 'general',
      keywords: metadata?.keywords ?? [],
      homepage: metadata?.homepage,
      repository: metadata?.repository,
      bugs: metadata?.bugs,
    };
  }

  /**
   * Create extended metadata properties
   */
  private createExtendedMetadata(manifest: PluginManifest) {
    const metadata = manifest.metadata as any;
    const manifestAny = manifest as any;

    return {
      capabilities: manifest.capabilities ?? [],
      permissions: Array.isArray(manifest.permissions) ? manifest.permissions : Object.keys(manifest.permissions),
      dependencies: manifest.dependencies ?? {},
      peerDependencies: manifestAny.peerDependencies ?? {},
      devDependencies: manifestAny.devDependencies ?? {},
      size: metadata?.size,
      downloadCount: metadata?.downloadCount,
      rating: metadata?.rating,
      verified: metadata?.verified ?? false,
      featured: metadata?.featured ?? false,
      deprecated: metadata?.deprecated ?? false,
      createdBy: metadata?.createdBy,
      updatedBy: metadata?.updatedBy,
      maintainers: metadata?.maintainers ?? [],
      previousVersion: metadata?.previousVersion,
      versionChanges: metadata?.versionChanges ?? [],
      security: metadata?.security ?? {
        signed: false,
        verified: false,
      },
    };
  }

  /**
   * Create failure result
   */
  private createFailureResult(pluginId: string, version: string, message: string): InstallationResult {
    return {
      success: false,
      pluginId,
      version,
      message,
      errors: [message],
    };
  }
}
