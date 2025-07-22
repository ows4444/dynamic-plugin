/**
 * Utility types for enhanced type safety and developer experience
 */

// Branded types for domain-specific IDs
export type PluginId = string & { readonly __brand: unique symbol };
export type TenantId = string & { readonly __brand: unique symbol };
export type UserId = string & { readonly __brand: unique symbol };
export type SessionId = string & { readonly __brand: unique symbol };

// Template literal types for API versioning and routes
export type ApiVersion = 'v1' | 'v2';
export type PluginRoute = `/plugins/${string}`;
export type VersionedRoute = `/${ApiVersion}${PluginRoute}`;
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// Advanced utility types
export type PartialByKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredByKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type NonEmptyArray<T> = [T, ...T[]];

export type ValueOf<T> = T[keyof T];

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// Function types
export type AsyncFunction<TArgs extends unknown[] = [], TReturn = void> = (
  ...args: TArgs
) => Promise<TReturn>;

export type SyncFunction<TArgs extends unknown[] = [], TReturn = void> = (
  ...args: TArgs
) => TReturn;

// Plugin-specific types
export type PluginStatus = 'active' | 'inactive' | 'error' | 'loading';
export type PluginPriority = 'low' | 'medium' | 'high' | 'critical';

// Event types
export type EventHandler<T = unknown> = (event: T) => void | Promise<void>;
export type EventMap = Record<string, EventHandler>;

// Configuration types
export type ConfigValue = string | number | boolean | null | undefined;
export type ConfigObject = Record<string, ConfigValue | ConfigObject>;

// Error types
export type ErrorCode = 
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_LOAD_ERROR' 
  | 'PLUGIN_VALIDATION_ERROR'
  | 'PLUGIN_PERMISSION_DENIED'
  | 'PLUGIN_TIMEOUT_ERROR';

// Type guards for branded types
export const isPluginId = (value: string): value is PluginId => {
  return typeof value === 'string' && value.length > 0;
};

export const isTenantId = (value: string): value is TenantId => {
  return typeof value === 'string' && value.length > 0;
};

export const isUserId = (value: string): value is UserId => {
  return typeof value === 'string' && value.length > 0;
};

// Helper functions for branded types
export const createPluginId = (value: string): PluginId => {
  if (!isPluginId(value)) {
    throw new Error('Invalid plugin ID');
  }
  return value as PluginId;
};

export const createTenantId = (value: string): TenantId => {
  if (!isTenantId(value)) {
    throw new Error('Invalid tenant ID');
  }
  return value as TenantId;
};

export const createUserId = (value: string): UserId => {
  if (!isUserId(value)) {
    throw new Error('Invalid user ID');
  }
  return value as UserId;
};

// Conditional types
export type If<C extends boolean, T, F> = C extends true ? T : F;
export type Not<C extends boolean> = C extends true ? false : true;
export type And<A extends boolean, B extends boolean> = A extends true ? B : false;
export type Or<A extends boolean, B extends boolean> = A extends true ? true : B;