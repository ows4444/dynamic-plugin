export type APIVersion = `v${number}`;

export type SupportedAPIVersions = 'v1' | 'v2' | 'v3';

export type VersionedPluginRoute = `/api/${APIVersion}/plugins/${string}/${string}`;

export type PluginAPIRoute = `/plugins/${string}/${APIVersion}/${string}`;

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export type SafeHTTPMethod = 'GET' | 'HEAD' | 'OPTIONS';

export type UnsafeHTTPMethod = 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type PluginId = `${string}@${string}`;

export type PluginNamespace = `${string}/${string}`;

export type QualifiedPluginId = `${PluginNamespace}@${string}`;

export type SemVer = `${number}.${number}.${number}`;

export type SemVerPrerelease = `${SemVer}-${string}`;

export type CompleteSemVer = SemVer | SemVerPrerelease;

export type PluginLifecycleEvent = 
  | 'plugin:loading'
  | 'plugin:loaded'
  | 'plugin:starting'
  | 'plugin:started'
  | 'plugin:stopping'
  | 'plugin:stopped'
  | 'plugin:error'
  | 'plugin:health-check';

export type PluginEvent = `plugin:${string}:${string}`;

export type SystemEvent = 
  | 'system:startup'
  | 'system:shutdown'
  | 'system:health-check'
  | 'system:maintenance';

export type PermissionScope = 'read' | 'write' | 'execute' | 'admin';

export type ResourceType = 'plugin' | 'user' | 'system' | 'data' | 'network' | 'storage';

export type Permission = `${ResourceType}:${PermissionScope}`;

export type ScopedPermission = `${ResourceType}:${string}:${PermissionScope}`;

export type Environment = 'development' | 'staging' | 'production' | 'test';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ConfigKey = `${string}.${string}.${string}`;
export interface TypedPluginRoute<TPath extends string = string> {
  method: HTTPMethod;
  path: TPath;
  handler: string;
  middleware?: string[];
  guards?: string[];
  description?: string;
  tags?: string[];
  version?: APIVersion;
}

export interface VersionedRoute extends TypedPluginRoute<VersionedPluginRoute> {
  version: APIVersion;
}
export interface PluginAPIEndpoint extends TypedPluginRoute<PluginAPIRoute> {
  pluginId: PluginId;
  version: APIVersion;
}

export function createVersionedRoute<TPath extends VersionedPluginRoute>(
  method: HTTPMethod,
  path: TPath,
  handler: string,
  version: APIVersion
): VersionedRoute {
  return {
    method,
    path,
    handler,
    version,
  };
}

export function createPluginAPIEndpoint<TPath extends PluginAPIRoute>(
  method: HTTPMethod,
  path: TPath,
  handler: string,
  pluginId: PluginId,
  version: APIVersion
): PluginAPIEndpoint {
  return {
    method,
    path,
    handler,
    pluginId,
    version,
  };
}

export function isAPIVersion(value: string): value is APIVersion {
  return /^v\d+$/.test(value);
}

export function isPluginId(value: string): value is PluginId {
  return /^[^@]+@[^@]+$/.test(value);
}

export function isSemVer(value: string): value is SemVer {
  return /^\d+\.\d+\.\d+$/.test(value);
}

export function isPermission(value: string): value is Permission {
  const validScopes: PermissionScope[] = ['read', 'write', 'execute', 'admin'];
  const validResources: ResourceType[] = ['plugin', 'user', 'system', 'data', 'network', 'storage'];
  
  const parts = value.split(':');
  if (parts.length !== 2) return false;
  
  const [resource, scope] = parts;
  return validResources.includes(resource as ResourceType) && 
         validScopes.includes(scope as PermissionScope);
}

export function isVersionedPluginRoute(path: string): path is VersionedPluginRoute {
  return /^\/api\/v\d+\/plugins\/[^/]+\/[^/]+$/.test(path);
}

export type ExtractPluginName<T extends PluginId> = T extends `${infer Name}@${string}` ? Name : never;

export type ExtractPluginVersion<T extends PluginId> = T extends `${string}@${infer Version}` ? Version : never;

export type ExtractAPIVersion<T extends VersionedPluginRoute> = 
  T extends `/api/${infer Version}/plugins/${string}/${string}` 
    ? Version extends APIVersion 
      ? Version 
      : never 
    : never;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Examples {
  export type PaymentPlugin = 'payment-plugin@1.0.0';
  export type CRMPlugin = 'crm-plugin@2.1.0';
  
  export type PaymentRoute = '/api/v1/plugins/payment/process';
  export type UserRoute = '/api/v2/plugins/user-management/create';
  
  export type ReadPlugin = 'plugin:read';
  export type WriteData = 'data:write';
  export type AdminSystem = 'system:admin';
  
  export const paymentRoute = createVersionedRoute(
    'POST',
    '/api/v1/plugins/payment/process',
    'PaymentController.process',
    'v1'
  );
  
  export const userRoute = createPluginAPIEndpoint(
    'GET', 
    '/plugins/user-management/v2/list',
    'UserController.list',
    'user-management@2.0.0',
    'v2'
  );
}