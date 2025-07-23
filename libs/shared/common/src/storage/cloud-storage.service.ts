import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { getErrorMessage } from '../utils/error.utils';

export interface StorageProvider {
  name: 'local' | 's3' | 'gcs' | 'azure';
  config: Record<string, unknown>;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  overwrite?: boolean;
  expires?: Date;
  tags?: Record<string, string>;
}

export interface DownloadOptions {
  range?: { start: number; end?: number };
  version?: string;
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  contentType?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  versions?: StorageObjectVersion[];
}

export interface StorageObjectVersion {
  version: string;
  size: number;
  lastModified: Date;
  isLatest: boolean;
}

export interface ListOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
  delimiter?: string;
  includeVersions?: boolean;
}

export interface ListResult {
  objects: StorageObject[];
  prefixes: string[];
  isTruncated: boolean;
  continuationToken?: string;
  totalCount: number;
}

export interface StorageStats {
  totalObjects: number;
  totalSize: number;
  providerStats: Record<string, unknown>;
}

@Injectable()
export class CloudStorageService {
  private readonly logger = new Logger(CloudStorageService.name);
  private readonly providers: Map<string, StorageProvider> = new Map();
  private readonly defaultProvider: string;

  constructor(private readonly configService: ConfigService) {
    this.defaultProvider = this.configService.get('DEFAULT_STORAGE_PROVIDER', 'local');
    this.initializeProviders();
  }

  /**
   * Upload a file to cloud storage
   */
  async upload(
    key: string,
    data: Buffer | Readable | string,
    options: UploadOptions = {},
    providerId?: string
  ): Promise<StorageObject> {
    const provider = this.getProvider(providerId);
    
    try {
      this.logger.debug(`Uploading ${key} to ${provider.name} storage`);

      // Simulate cloud upload based on provider type
      const result = await this.performUpload(provider, key, data, options);

      this.logger.log(`Successfully uploaded ${key} to ${provider.name} storage`);
      return result;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to upload ${key} to ${provider.name}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Download a file from cloud storage
   */
  async download(
    key: string,
    options: DownloadOptions = {},
    providerId?: string
  ): Promise<{ stream: Readable; metadata: StorageObject }> {
    const provider = this.getProvider(providerId);

    try {
      this.logger.debug(`Downloading ${key} from ${provider.name} storage`);

      const result = await this.performDownload(provider, key, options);

      this.logger.debug(`Successfully retrieved ${key} from ${provider.name} storage`);
      return result;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to download ${key} from ${provider.name}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Delete a file from cloud storage
   */
  async delete(
    key: string,
    version?: string,
    providerId?: string
  ): Promise<void> {
    const provider = this.getProvider(providerId);

    try {
      this.logger.debug(`Deleting ${key} from ${provider.name} storage`);

      await this.performDelete(provider, key, version);

      this.logger.log(`Successfully deleted ${key} from ${provider.name} storage`);

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to delete ${key} from ${provider.name}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Check if a file exists in cloud storage
   */
  async exists(key: string, providerId?: string): Promise<boolean> {
    const provider = this.getProvider(providerId);

    try {
      this.logger.debug(`Checking existence of ${key} in ${provider.name} storage`);

      await this.getMetadata(key, providerId);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getMetadata(key: string, providerId?: string): Promise<StorageObject> {
    const provider = this.getProvider(providerId);

    try {
      const metadata = await this.performGetMetadata(provider, key);
      return metadata;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to get metadata for ${key} from ${provider.name}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * List files in cloud storage
   */
  async list(
    options: ListOptions = {},
    providerId?: string
  ): Promise<ListResult> {
    const provider = this.getProvider(providerId);

    try {
      const result = await this.performList(provider, options);
      return result;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to list objects from ${provider.name}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Copy a file within or between providers
   */
  async copy(
    sourceKey: string,
    destinationKey: string,
    sourceProviderId?: string,
    destinationProviderId?: string,
    options: UploadOptions = {}
  ): Promise<StorageObject> {
    const sourceProvider = this.getProvider(sourceProviderId);
    const destinationProvider = this.getProvider(destinationProviderId);

    try {
      this.logger.debug(
        `Copying ${sourceKey} from ${sourceProvider.name} to ${destinationKey} in ${destinationProvider.name}`
      );

      // Download from source and upload to destination
      const { stream } = await this.download(sourceKey, {}, sourceProviderId);
      const result = await this.upload(destinationKey, stream, options, destinationProviderId);

      this.logger.log(
        `Successfully copied ${sourceKey} to ${destinationKey}`
      );

      return result;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to copy ${sourceKey} to ${destinationKey}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for direct access
   */
  async generatePresignedUrl(
    key: string,
    operation: 'get' | 'put',
    expirationSeconds = 3600,
    providerId?: string
  ): Promise<string> {
    const provider = this.getProvider(providerId);

    try {
      const url = await this.performGeneratePresignedUrl(provider, key, operation, expirationSeconds);
      
      this.logger.debug(
        `Generated presigned URL for ${operation} operation on ${key} (expires in ${expirationSeconds}s)`
      );

      return url;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to generate presigned URL for ${key}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(providerId?: string): Promise<StorageStats> {
    const provider = this.getProvider(providerId);

    try {
      const stats = await this.performGetStats(provider);
      return stats;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Failed to get stats from ${provider.name}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Bulk delete files
   */
  async bulkDelete(
    keys: string[],
    providerId?: string
  ): Promise<{ successful: string[]; failed: Array<{ key: string; error: string }> }> {
    const provider = this.getProvider(providerId);
    const successful: string[] = [];
    const failed: Array<{ key: string; error: string }> = [];

    for (const key of keys) {
      try {
        await this.performDelete(provider, key);
        successful.push(key);
      } catch (error) {
        failed.push({
          key,
          error: getErrorMessage(error),
        });
      }
    }

    this.logger.log(
      `Bulk delete completed: ${successful.length} successful, ${failed.length} failed`
    );

    return { successful, failed };
  }

  private getProvider(providerId?: string): StorageProvider {
    const id = providerId ?? this.defaultProvider;
    const provider = this.providers.get(id);
    
    if (!provider) {
      throw new Error(`Storage provider '${id}' not configured`);
    }
    
    return provider;
  }

  private initializeProviders(): void {
    // Initialize local storage provider
    this.providers.set('local', {
      name: 'local',
      config: {
        basePath: this.configService.get('LOCAL_STORAGE_PATH', './storage'),
      },
    });

    // Initialize S3 provider if configured
    const s3Config = {
      region: this.configService.get('AWS_REGION'),
      bucket: this.configService.get('AWS_S3_BUCKET'),
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      endpoint: this.configService.get('AWS_S3_ENDPOINT'),
    };

    if ((Boolean(s3Config.bucket)) && (Boolean(s3Config.region))) {
      this.providers.set('s3', {
        name: 's3',
        config: s3Config,
      });
    }

    // Initialize GCS provider if configured
    const gcsConfig = {
      bucket: this.configService.get('GCP_STORAGE_BUCKET'),
      keyFilename: this.configService.get('GCP_SERVICE_ACCOUNT_KEY_FILE'),
      projectId: this.configService.get('GCP_PROJECT_ID'),
    };

    if ((Boolean(gcsConfig.bucket)) && (Boolean(gcsConfig.keyFilename))) {
      this.providers.set('gcs', {
        name: 'gcs',
        config: gcsConfig,
      });
    }

    // Initialize Azure provider if configured
    const azureConfig = {
      connectionString: this.configService.get('AZURE_STORAGE_CONNECTION_STRING'),
      containerName: this.configService.get('AZURE_STORAGE_CONTAINER'),
      accountName: this.configService.get('AZURE_STORAGE_ACCOUNT_NAME'),
      accountKey: this.configService.get('AZURE_STORAGE_ACCOUNT_KEY'),
    };

    if ((Boolean(azureConfig.connectionString)) && (Boolean(azureConfig.containerName))) {
      this.providers.set('azure', {
        name: 'azure',
        config: azureConfig,
      });
    }

    this.logger.log(
      `Initialized storage providers: ${Array.from(this.providers.keys()).join(', ')}`
    );
  }

  // Mock implementations - in production, these would use actual cloud SDKs
  private async performUpload(
    provider: StorageProvider,
    key: string,
    data: Buffer | Readable | string,
    options: UploadOptions
  ): Promise<StorageObject> {
    // Mock implementation
    const size = Buffer.isBuffer(data) ? data.length : typeof data === 'string' ? Buffer.byteLength(data) : 1024;
    
    return Promise.resolve({
      key,
      size,
      lastModified: new Date(),
      etag: `"${Math.random().toString(36).substring(2)}"`,
      contentType: options.contentType ?? 'application/octet-stream',
      metadata: options.metadata ?? {},
      tags: options.tags ?? {},
    });
  }

  private async performDownload(
    provider: StorageProvider,
    key: string,
    options: DownloadOptions
  ): Promise<{ stream: Readable; metadata: StorageObject }> {
    // Mock implementation
    const stream = new Readable({
      read() {
        this.push(Buffer.from('mock file content'));
        this.push(null);
      },
    });

    const metadata: StorageObject = {
      key,
      size: 1024,
      lastModified: new Date(),
      etag: `"${Math.random().toString(36).substring(2)}"`,
      contentType: 'application/octet-stream',
      metadata: {},
    };
    this.logger.debug(`Returning mock stream for ${key} from ${provider.name} storage`,options);

    return Promise.resolve({ stream, metadata });
  }

  private async performDelete(_provider: StorageProvider, _key: string, _version?: string): Promise<void> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private async performGetMetadata(provider: StorageProvider, key: string): Promise<StorageObject> {
    // Mock implementation
    return Promise.resolve({
      key,
      size: 1024,
      lastModified: new Date(),
      etag: `"${Math.random().toString(36).substring(2)}"`,
      contentType: 'application/octet-stream',
      metadata: {},
    });
  }

  private async performList(_provider: StorageProvider, _options: ListOptions): Promise<ListResult> {
    // Mock implementation
    return Promise.resolve({
      objects: [],
      prefixes: [],
      isTruncated: false,
      totalCount: 0,
    });
  }

  private async performGeneratePresignedUrl(
    provider: StorageProvider,
    key: string,
    operation: 'get' | 'put',
    expirationSeconds: number
  ): Promise<string> {
    // Mock implementation
    return Promise.resolve(`https://mock-${provider.name}-storage.com/${key}?expires=${expirationSeconds}`);
  }

  private async performGetStats(provider: StorageProvider): Promise<StorageStats> {
    // Mock implementation
    return Promise.resolve({
      totalObjects: 0,
      totalSize: 0,
      providerStats: {
        provider: provider.name,
        region: 'mock-region',
        lastChecked: new Date().toISOString(),
      },
    });
  }
}