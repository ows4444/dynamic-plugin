import {
  All, applyDecorators, Delete,
  Get,
  Head,
  Options,
  Patch,
  Post,
  Put, SetMetadata
} from '@nestjs/common';

export const PLUGIN_ROUTE_METADATA_KEY = 'plugin:route';
export const PLUGIN_ROUTE_PERMISSIONS_KEY = 'plugin:route:permissions';
export const PLUGIN_ROUTE_CONFIG_KEY = 'plugin:route:config';

export interface PluginRouteOptions {
  path?: string;
  method?:
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'DELETE'
    | 'PATCH'
    | 'OPTIONS'
    | 'HEAD'
    | 'ALL';
  permissions?: string[];
  auth?: boolean;
  rateLimit?: {
    max: number;
    windowMs: number;
  };
  cache?: {
    ttl: number;
    key?: string;
  };
  description?: string;
  tags?: string[];
  deprecated?: boolean;
}

export function PluginRoute(path?: string, options?: PluginRouteOptions) {
  const routeOptions = {
    method: 'GET' as const,
    auth: true,
    ...options,
    path,
  };

  const decorators = [
    SetMetadata(PLUGIN_ROUTE_METADATA_KEY, routeOptions),
    SetMetadata(PLUGIN_ROUTE_PERMISSIONS_KEY, routeOptions.permissions ?? []),
    SetMetadata(PLUGIN_ROUTE_CONFIG_KEY, routeOptions),
  ];

  // Add the appropriate HTTP method decorator
  switch (routeOptions.method) {
    case 'GET':
      decorators.push(Get(path));
      break;
    case 'POST':
      decorators.push(Post(path));
      break;
    case 'PUT':
      decorators.push(Put(path));
      break;
    case 'DELETE':
      decorators.push(Delete(path));
      break;
    case 'PATCH':
      decorators.push(Patch(path));
      break;
    case 'OPTIONS':
      decorators.push(Options(path));
      break;
    case 'HEAD':
      decorators.push(Head(path));
      break;
    case 'ALL':
      decorators.push(All(path));
      break;
    default:
      decorators.push(Get(path));
  }

  return applyDecorators(...decorators);
}

export function PluginGet(
  path?: string,
  options?: Omit<PluginRouteOptions, 'method'>,
) {
  return PluginRoute(path, { ...options, method: 'GET' });
}

export function PluginPost(
  path?: string,
  options?: Omit<PluginRouteOptions, 'method'>,
) {
  return PluginRoute(path, { ...options, method: 'POST' });
}

export function PluginPut(
  path?: string,
  options?: Omit<PluginRouteOptions, 'method'>,
) {
  return PluginRoute(path, { ...options, method: 'PUT' });
}

export function PluginDelete(
  path?: string,
  options?: Omit<PluginRouteOptions, 'method'>,
) {
  return PluginRoute(path, { ...options, method: 'DELETE' });
}

export function PluginPatch(
  path?: string,
  options?: Omit<PluginRouteOptions, 'method'>,
) {
  return PluginRoute(path, { ...options, method: 'PATCH' });
}

export interface PluginEndpointOptions {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;
  security?: Record<string, string[]>[];
}

export function PluginEndpoint(options: PluginEndpointOptions) {
  return SetMetadata('plugin:endpoint', options);
}

export interface PluginResponseOptions {
  status: number;
  description?: string;
  type?: any;
  schema?: any;
}

export function PluginResponse(options: PluginResponseOptions) {
  return SetMetadata('plugin:response', options);
}

export interface PluginParameterOptions {
  name: string;
  type: 'query' | 'path' | 'header' | 'body';
  required?: boolean;
  description?: string;
  schema?: any;
}

export function PluginParameter(options: PluginParameterOptions) {
  return SetMetadata('plugin:parameter', options);
}

export function PluginAuth(required = true) {
  return SetMetadata('plugin:auth', required);
}

export function PluginRateLimit(max: number, windowMs = 60000) {
  return SetMetadata('plugin:rateLimit', { max, windowMs });
}

export function PluginCache(ttl: number, key?: string) {
  return SetMetadata('plugin:cache', { ttl, key });
}
