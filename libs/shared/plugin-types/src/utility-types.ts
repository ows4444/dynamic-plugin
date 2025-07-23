/**
 * Utility types for enhanced type safety and developer experience
 */

// Branded types for domain-specific IDs
// eslint-disable-next-line @typescript-eslint/naming-convention
export type BrandedPluginId = string & { readonly __brand: unique symbol };
// eslint-disable-next-line @typescript-eslint/naming-convention
export type BrandedTenantId = string & { readonly __brand: unique symbol };
// eslint-disable-next-line @typescript-eslint/naming-convention
export type BrandedUserId = string & { readonly __brand: unique symbol };
// eslint-disable-next-line @typescript-eslint/naming-convention
export type BrandedSessionId = string & { readonly __brand: unique symbol };

// Template literal types for API versioning and routes
export type UtilityApiVersion = 'v1' | 'v2';
export type UtilityPluginRoute = `/plugins/${string}`;
export type UtilityVersionedRoute = `/${UtilityApiVersion}${UtilityPluginRoute}`;
export type UtilityHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

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

// Configuration types (avoiding circular reference)
export type UtilityConfigValue = string | number | boolean | null | undefined;
export type UtilityConfigObject = Record<string, UtilityConfigValue | Record<string, unknown>>;

// Error types
export type ErrorCode = 
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_LOAD_ERROR' 
  | 'PLUGIN_VALIDATION_ERROR'
  | 'PLUGIN_PERMISSION_DENIED'
  | 'PLUGIN_TIMEOUT_ERROR';

// Type guards for branded types
export const isBrandedPluginId = (value: string): value is BrandedPluginId => {
  return typeof value === 'string' && value.length > 0;
};

export const isBrandedTenantId = (value: string): value is BrandedTenantId => {
  return typeof value === 'string' && value.length > 0;
};

export const isBrandedUserId = (value: string): value is BrandedUserId => {
  return typeof value === 'string' && value.length > 0;
};

// Helper functions for branded types
export const createBrandedPluginId = (value: string): BrandedPluginId => {
  if (!isBrandedPluginId(value)) {
    throw new Error('Invalid plugin ID');
  }
  return value;
};

export const createBrandedTenantId = (value: string): BrandedTenantId => {
  if (!isBrandedTenantId(value)) {
    throw new Error('Invalid tenant ID');
  }
  return value;
};

export const createBrandedUserId = (value: string): BrandedUserId => {
  if (!isBrandedUserId(value)) {
    throw new Error('Invalid user ID');
  }
  return value;
};

// Conditional types
export type If<C extends boolean, T, F> = C extends true ? T : F;
export type Not<C extends boolean> = C extends true ? false : true;
export type And<A extends boolean, B extends boolean> = A extends true ? B : false;
export type Or<A extends boolean, B extends boolean> = A extends true ? true : B;