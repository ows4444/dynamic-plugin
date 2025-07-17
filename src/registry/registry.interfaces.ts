export interface PluginRegistryEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  tags: string[];
  downloadUrl: string;
  checksum: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  downloads: number;
  rating: number;
  verified: boolean;
  dependencies?: any[];
  compatibility: {
    nodeVersion: string;
    platformVersion: string;
  };
}

export interface PluginSearchQuery {
  query?: string;
  category?: string;
  author?: string;
  verified?: boolean;
  minRating?: number;
  limit?: number;
  offset?: number;
}

export interface PublishPluginDto {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  tags: string[];
  category?: string;
}