import { Injectable, Logger } from '@nestjs/common';
import { PluginInstallerService } from './plugin-installer.service';
import { PluginValidatorService } from './plugin-validator.service';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  status: 'installed' | 'running' | 'stopped' | 'error';
  metadata?: any;
}

@Injectable()
export class PluginManagerService {
  private readonly logger = new Logger(PluginManagerService.name);
  private plugins: Map<string, Plugin> = new Map();

  constructor(
    private readonly installer: PluginInstallerService,
    private readonly validator: PluginValidatorService,
  ) {}

  async installPlugin(pluginPackage: string): Promise<Plugin> {
    this.logger.log(`Installing plugin: ${pluginPackage}`);
    
    // Validate plugin package
    const isValid = await this.validator.validatePackage(pluginPackage);
    if (!isValid) {
      throw new Error('Invalid plugin package');
    }

    // Install plugin
    const plugin = await this.installer.install(pluginPackage);
    
    // Store plugin info
    this.plugins.set(plugin.id, {
      ...plugin,
      status: 'installed',
    });

    this.logger.log(`Plugin installed successfully: ${plugin.id}`);
    return this.plugins.get(plugin.id)!;
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    this.logger.log(`Uninstalling plugin: ${pluginId}`);
    
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    await this.installer.uninstall(pluginId);
    this.plugins.delete(pluginId);

    this.logger.log(`Plugin uninstalled successfully: ${pluginId}`);
  }

  async startPlugin(pluginId: string): Promise<void> {
    this.logger.log(`Starting plugin: ${pluginId}`);
    
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    // Plugin startup logic would go here
    plugin.status = 'running';
    
    this.logger.log(`Plugin started successfully: ${pluginId}`);
  }

  async stopPlugin(pluginId: string): Promise<void> {
    this.logger.log(`Stopping plugin: ${pluginId}`);
    
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    // Plugin shutdown logic would go here
    plugin.status = 'stopped';
    
    this.logger.log(`Plugin stopped successfully: ${pluginId}`);
  }

  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }
}