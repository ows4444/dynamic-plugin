import { Injectable, Logger } from '@nestjs/common';
import { PluginDomain, PluginId, PluginManifest, PluginVersion } from '../domain/plugin.domain';
import { PluginRepositoryPort, PluginLoaderPort, PluginExecutionPort, PluginEventPort } from '../ports/plugin.repository.port';
import { PluginStatus } from '../common/interfaces/plugin.interface';

export interface LoadPluginCommand {
  pluginId: string;
  path: string;
  autoStart?: boolean;
}

export interface UnloadPluginCommand {
  pluginId: string;
}

export interface PluginQuery {
  pluginId?: string;
  status?: PluginStatus;
  name?: string;
  version?: string;
}

export interface PluginDto {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  status: PluginStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class PluginApplicationService {
  private readonly logger = new Logger(PluginApplicationService.name);

  constructor(
    private readonly pluginRepository: PluginRepositoryPort,
    private readonly pluginLoader: PluginLoaderPort,
    private readonly pluginExecutor: PluginExecutionPort,
    private readonly eventPublisher: PluginEventPort
  ) {}

  async loadPlugin(command: LoadPluginCommand): Promise<PluginDto> {
    const pluginId = new PluginId(command.pluginId);
    
    this.logger.log(`Loading plugin: ${pluginId.value}`);

    // Check if plugin already exists
    const existingPlugin = await this.pluginRepository.findById(pluginId);
    if (existingPlugin) {
      throw new Error(`Plugin ${pluginId.value} already exists`);
    }

    // Load plugin from filesystem
    const pluginInstance = await this.pluginLoader.load(pluginId, command.path);
    
    // Validate plugin
    const isValid = await this.pluginLoader.validate(pluginId, pluginInstance);
    if (!isValid) {
      throw new Error(`Plugin ${pluginId.value} validation failed`);
    }

    // Create domain object
    const manifest = this.extractManifest(pluginInstance);
    const plugin = PluginDomain.create(pluginId, manifest);

    // Load the plugin
    plugin.load();

    // Save to repository
    await this.pluginRepository.save(plugin);

    // Publish domain events
    await this.publishDomainEvents(plugin);

    // Auto-start if requested
    if (command.autoStart) {
      await this.startPlugin(pluginId);
    }

    this.logger.log(`Plugin loaded successfully: ${pluginId.value}`);
    return this.toDto(plugin);
  }

  async unloadPlugin(command: UnloadPluginCommand): Promise<void> {
    const pluginId = new PluginId(command.pluginId);
    
    this.logger.log(`Unloading plugin: ${pluginId.value}`);

    // Find plugin
    const plugin = await this.pluginRepository.findById(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId.value} not found`);
    }

    // Stop plugin if active
    if (plugin.getStatus() === PluginStatus.ACTIVE) {
      await this.stopPlugin(pluginId);
    }

    // Unload from loader
    await this.pluginLoader.unload(pluginId);

    // Remove from repository
    await this.pluginRepository.delete(pluginId);

    this.logger.log(`Plugin unloaded successfully: ${pluginId.value}`);
  }

  async startPlugin(pluginId: PluginId): Promise<void> {
    const plugin = await this.pluginRepository.findById(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId.value} not found`);
    }

    // Initialize plugin
    await this.pluginExecutor.initialize(pluginId, {});

    // Activate plugin
    plugin.activate();

    // Save updated state
    await this.pluginRepository.save(plugin);

    // Publish domain events
    await this.publishDomainEvents(plugin);

    this.logger.log(`Plugin started: ${pluginId.value}`);
  }

  async stopPlugin(pluginId: PluginId): Promise<void> {
    const plugin = await this.pluginRepository.findById(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId.value} not found`);
    }

    // Destroy plugin
    await this.pluginExecutor.destroy(pluginId);

    // Deactivate plugin
    plugin.deactivate();

    // Save updated state
    await this.pluginRepository.save(plugin);

    // Publish domain events
    await this.publishDomainEvents(plugin);

    this.logger.log(`Plugin stopped: ${pluginId.value}`);
  }

  async reloadPlugin(pluginId: PluginId): Promise<PluginDto> {
    const plugin = await this.pluginRepository.findById(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId.value} not found`);
    }

    const wasActive = plugin.getStatus() === PluginStatus.ACTIVE;

    // Stop if active
    if (wasActive) {
      await this.stopPlugin(pluginId);
    }

    // Reload from loader
    const pluginInstance = await this.pluginLoader.reload(pluginId);
    
    // Validate plugin
    const isValid = await this.pluginLoader.validate(pluginId, pluginInstance);
    if (!isValid) {
      throw new Error(`Plugin ${pluginId.value} validation failed after reload`);
    }

    // Update manifest
    const newManifest = this.extractManifest(pluginInstance);
    plugin.update(newManifest);

    // Save updated state
    await this.pluginRepository.save(plugin);

    // Restart if it was active
    if (wasActive) {
      await this.startPlugin(pluginId);
    }

    // Publish domain events
    await this.publishDomainEvents(plugin);

    this.logger.log(`Plugin reloaded: ${pluginId.value}`);
    return this.toDto(plugin);
  }

  async executePluginMethod(pluginId: PluginId, method: string, args: any[]): Promise<any> {
    const plugin = await this.pluginRepository.findById(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId.value} not found`);
    }

    if (plugin.getStatus() !== PluginStatus.ACTIVE) {
      throw new Error(`Plugin ${pluginId.value} is not active`);
    }

    return await this.pluginExecutor.execute(pluginId, method, args);
  }

  async findPlugins(query: PluginQuery): Promise<PluginDto[]> {
    let plugins: PluginDomain[];

    if (query.pluginId) {
      const plugin = await this.pluginRepository.findById(new PluginId(query.pluginId));
      plugins = plugin ? [plugin] : [];
    } else if (query.status) {
      plugins = await this.pluginRepository.findByStatus(query.status);
    } else {
      plugins = await this.pluginRepository.findAll();
    }

    // Apply additional filters
    if (query.name) {
      plugins = plugins.filter(p => p.getManifest().name.includes(query.name));
    }

    if (query.version) {
      plugins = plugins.filter(p => p.getManifest().version.value === query.version);
    }

    return plugins.map(plugin => this.toDto(plugin));
  }

  async getPluginById(pluginId: string): Promise<PluginDto | null> {
    const plugin = await this.pluginRepository.findById(new PluginId(pluginId));
    return plugin ? this.toDto(plugin) : null;
  }

  async getActivePlugins(): Promise<PluginDto[]> {
    const plugins = await this.pluginRepository.findByStatus(PluginStatus.ACTIVE);
    return plugins.map(plugin => this.toDto(plugin));
  }

  async getInactivePlugins(): Promise<PluginDto[]> {
    const plugins = await this.pluginRepository.findByStatus(PluginStatus.INACTIVE);
    return plugins.map(plugin => this.toDto(plugin));
  }

  async getErrorPlugins(): Promise<PluginDto[]> {
    const plugins = await this.pluginRepository.findByStatus(PluginStatus.ERROR);
    return plugins.map(plugin => this.toDto(plugin));
  }

  async handlePluginError(pluginId: PluginId, error: string): Promise<void> {
    const plugin = await this.pluginRepository.findById(pluginId);
    if (!plugin) {
      return;
    }

    plugin.markAsError(error);
    await this.pluginRepository.save(plugin);
    await this.publishDomainEvents(plugin);

    this.logger.error(`Plugin error handled: ${pluginId.value} - ${error}`);
  }

  private extractManifest(pluginInstance: any): PluginManifest {
    return new PluginManifest(
      pluginInstance.name,
      new PluginVersion(pluginInstance.version),
      pluginInstance.description,
      pluginInstance.author,
      pluginInstance.main || 'index.js',
      pluginInstance.dependencies || [],
      pluginInstance.permissions || []
    );
  }

  private async publishDomainEvents(plugin: PluginDomain): Promise<void> {
    const events = plugin.getEvents();
    
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
    
    plugin.clearEvents();
  }

  private toDto(plugin: PluginDomain): PluginDto {
    return {
      id: plugin.getId().value,
      name: plugin.getManifest().name,
      version: plugin.getManifest().version.value,
      description: plugin.getManifest().description,
      author: plugin.getManifest().author,
      status: plugin.getStatus(),
      createdAt: plugin.getCreatedAt().toISOString(),
      updatedAt: plugin.getUpdatedAt().toISOString()
    };
  }
}