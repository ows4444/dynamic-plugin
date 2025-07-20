/**
 * Plugin Store Types - Types for plugin marketplace and store functionality
 */

import type { PluginDependency, PluginEngines } from './common.types';

export interface PluginStoreEntry {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  keywords?: string[];
  categories?: string[];
  downloadCount?: number;
  rating?: number;
  featured?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  homepage?: string;
  repository?: string;
  dependencies: Record<string, string>;
  pluginDependencies: PluginDependency[];
  engines: PluginEngines;
  capabilities: string[];
  permissions: Record<string, string[]>; // PluginPermissions type to avoid circular dep

  // Store-specific metadata
  store: {
    id: string;
    name: string;
    priority: number;
  };

  // Search relevance (calculated during search)
  relevanceScore?: number;
}

export interface PluginStoreQuery {
  keyword?: string;
  category?: string;
  author?: string;
  tags?: string[];
  minRating?: number;
  featured?: boolean;
  sortBy?: 'relevance' | 'downloads' | 'rating' | 'updated' | 'created';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PluginStoreResult {
  plugins: PluginStoreEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  stores: Array<{
    id: string;
    name: string;
    status: 'connected' | 'disconnected' | 'error';
  }>;
}

export interface PluginStore {
  id: string;
  name: string;
  url: string;
  priority: number;
  trusted: boolean;
  apiKey?: string;
  active?: boolean;
  lastSync?: Date;
  pluginCount?: number;
}

export interface PluginStoreConfig {
  stores: PluginStore[];
  defaultStore?: string;
  cacheTimeout?: number;
  maxConcurrentRequests?: number;
  retryAttempts?: number;
  lastUpdated?: string;
}

export interface PluginDownloadInfo {
  downloadUrl: string;
  checksums: Record<string, string>;
  metadata: Record<string, unknown>; // PluginMetadata to avoid circular dep
  size?: number;
  mirrors?: string[];
  expires?: Date;
}

export interface PluginStoreMetrics {
  totalStores: number;
  connectedStores: number;
  totalPlugins: number;
  featuredPlugins: number;
  categoriesCount: number;
  averageRating: number;
  totalDownloads: number;
  cacheHitRate: number;
  lastRefresh: Date;
}

// Re-export store-related common types for convenience
export type { PluginDependency, PluginEngines } from './common.types';
