export interface StorageProvider {
  read(path: string): Promise<Buffer | null>;
  write(path: string, data: Buffer): Promise<void>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  list(path: string): Promise<string[]>;
  createDirectory(path: string): Promise<void>;
  deleteDirectory(path: string): Promise<void>;
}

export interface PluginStorageMetadata {
  pluginName: string;
  version: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  checksum: string;
  path: string;
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: Date;
  expiresAt?: Date;
  accessCount: number;
  lastAccessed: Date;
}

export interface CacheOptions {
  ttl?: number; // time to live in milliseconds
  maxSize?: number; // maximum cache size
  maxAge?: number; // maximum age in milliseconds
}
