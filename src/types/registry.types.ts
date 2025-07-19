export interface PluginRegistry {
  plugins: Map<string, PluginRegistryEntry>;
  categories: Map<string, string[]>;
  dependencies: Map<string, string[]>;
}

export interface PluginRegistryEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  category: string;
  tags: string[];
  capabilities: string[];
  permissions: PluginPermissions;
  dependencies: PluginDependency[];
  pluginDependencies: Record<string, string>;
  engines: PluginEngines;
  status: PluginRegistryStatus;
  downloadCount: number;
  rating: number;
  reviews: number;
  lastUpdated: Date;
  createdAt: Date;
  repository?: string;
  documentation?: string;
  homepage?: string;
  bugs?: string;
  size: number;
  checksum: string;
  signature?: string;
  verified: boolean;
}

export interface PluginRegistryStatus {
  installed: boolean;
  enabled: boolean;
  version: string;
  installDate?: Date;
  lastUsed?: Date;
}

export interface PluginSearchQuery {
  query?: string;
  category?: string;
  tags?: string[];
  capabilities?: string[];
  author?: string;
  license?: string;
  verified?: boolean;
  sortBy?: 'name' | 'downloads' | 'rating' | 'updated' | 'created';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PluginSearchResult {
  plugins: PluginRegistryEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface PluginVersion {
  version: string;
  description: string;
  author: string;
  publishDate: Date;
  deprecated: boolean;
  prerelease: boolean;
  checksum: string;
  signature?: string;
  changelog?: string;
}

export interface PluginVersionHistory {
  pluginId: string;
  versions: PluginVersion[];
  latest: string;
  stable: string;
}

export interface PluginStats {
  totalPlugins: number;
  installedPlugins: number;
  enabledPlugins: number;
  categoriesCount: number;
  averageRating: number;
  totalDownloads: number;
  topCategories: { category: string; count: number }[];
  topAuthors: { author: string; count: number }[];
  recentlyUpdated: PluginRegistryEntry[];
  mostPopular: PluginRegistryEntry[];
}

export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  username: string;
  rating: number;
  title: string;
  comment: string;
  version: string;
  helpful: number;
  timestamp: Date;
  verified: boolean;
}

export interface PluginCollection {
  id: string;
  name: string;
  description: string;
  author: string;
  plugins: string[];
  public: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  downloads: number;
}

export interface PluginAnalytics {
  pluginId: string;
  timeframe: 'day' | 'week' | 'month' | 'year';
  downloads: number;
  installs: number;
  uninstalls: number;
  activeUsers: number;
  errorRate: number;
  avgRating: number;
  performanceMetrics: {
    avgLoadTime: number;
    avgMemoryUsage: number;
    avgCpuUsage: number;
  };
}

export interface PluginDependencyTree {
  pluginId: string;
  dependencies: PluginDependencyNode[];
  conflicts: PluginConflict[];
  circularDependencies: string[][];
}

export interface PluginDependencyNode {
  id: string;
  name: string;
  version: string;
  required: boolean;
  installed: boolean;
  children: PluginDependencyNode[];
}

export interface PluginConflict {
  pluginId: string;
  conflictsWith: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  resolution?: string;
}

export interface PluginUpdateInfo {
  pluginId: string;
  currentVersion: string;
  latestVersion: string;
  updateType: 'patch' | 'minor' | 'major';
  breaking: boolean;
  changelog: string;
  securityUpdate: boolean;
  size: number;
  dependencies: PluginDependencyUpdate[];
}

export interface PluginDependencyUpdate {
  name: string;
  currentVersion: string;
  newVersion: string;
  updateType: 'patch' | 'minor' | 'major';
  breaking: boolean;
}

export interface PluginBackup {
  id: string;
  pluginId: string;
  version: string;
  timestamp: Date;
  size: number;
  checksum: string;
  metadata: Record<string, any>;
}

export interface PluginRestoreOptions {
  backupId: string;
  preserveConfig: boolean;
  preserveData: boolean;
  force: boolean;
}

import type { PluginDependency, PluginEngines, PluginPermissions } from './plugin.types';
