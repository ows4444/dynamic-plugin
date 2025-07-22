import { applyDecorators, SetMetadata } from '@nestjs/common';
import type { PluginMetadata } from '../base/base-plugin';

export const PLUGIN_METADATA_KEY = 'plugin:metadata';
export const PLUGIN_CONFIG_KEY = 'plugin:config';
export const PLUGIN_PERMISSIONS_KEY = 'plugin:permissions';

export interface PluginDecoratorOptions {
  metadata: PluginMetadata;
  config: Record<string, unknown>;
  permissions: string[];
}

export function Plugin(options: PluginDecoratorOptions) {
  return applyDecorators(
    SetMetadata(PLUGIN_METADATA_KEY, options.metadata),
    SetMetadata(PLUGIN_CONFIG_KEY, options.config),
    SetMetadata(PLUGIN_PERMISSIONS_KEY, options.permissions),
  );
}

export interface PluginServiceOptions {
  name: string;
  description?: string;
  dependencies?: string[];
}

export function PluginService(options: PluginServiceOptions) {
  return SetMetadata('plugin:service', options);
}

export interface PluginProviderOptions {
  name: string;
  factory?: boolean;
  singleton?: boolean;
}

export function PluginProvider(options: PluginProviderOptions) {
  return SetMetadata('plugin:provider', {
    singleton: true,
    factory: false,
    ...options,
  });
}

export interface PluginConfigOptions {
  required?: boolean;
  defaultValue?: unknown;
  validate?: (value: unknown) => boolean;
  transform?: (value: unknown) => unknown;
}

export function PluginConfig(key: string, options?: PluginConfigOptions) {
  return SetMetadata('plugin:config:field', {
    key,
    required: false,
    ...options,
  });
}

export function PluginPermission(permission: string | string[]) {
  const permissions = Array.isArray(permission) ? permission : [permission];
  return SetMetadata('plugin:permission', permissions);
}

export function PluginVersion(version: string) {
  return SetMetadata('plugin:version', version);
}

export function PluginAuthor(author: string) {
  return SetMetadata('plugin:author', author);
}

export function PluginDescription(description: string) {
  return SetMetadata('plugin:description', description);
}

export function PluginTags(...tags: string[]) {
  return SetMetadata('plugin:tags', tags);
}

export function PluginDependency(dependency: string | string[]) {
  const dependencies = Array.isArray(dependency) ? dependency : [dependency];
  return SetMetadata('plugin:dependency', dependencies);
}
