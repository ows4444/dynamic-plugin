import { PluginDomain, PluginId } from '../domain/plugin.domain';

export interface PluginRepositoryPort {
  save(plugin: PluginDomain): Promise<void>;
  findById(id: PluginId): Promise<PluginDomain | null>;
  findAll(): Promise<PluginDomain[]>;
  findByStatus(status: string): Promise<PluginDomain[]>;
  delete(id: PluginId): Promise<void>;
  exists(id: PluginId): Promise<boolean>;
}

export interface PluginLoaderPort {
  load(pluginId: PluginId, path: string): Promise<any>;
  unload(pluginId: PluginId): Promise<void>;
  reload(pluginId: PluginId): Promise<any>;
  validate(pluginId: PluginId, plugin: any): Promise<boolean>;
}

export interface PluginExecutionPort {
  execute(pluginId: PluginId, method: string, args: any[]): Promise<any>;
  initialize(pluginId: PluginId, context: any): Promise<void>;
  destroy(pluginId: PluginId): Promise<void>;
}

export interface PluginEventPort {
  publish(event: any): Promise<void>;
  subscribe(eventType: string, handler: Function): Promise<void>;
  unsubscribe(eventType: string, handler: Function): Promise<void>;
}