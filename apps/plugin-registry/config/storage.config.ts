import { registerAs } from '@nestjs/config';
import * as path from 'path';

export interface StorageConfig {
  provider: 'local' | 's3' | 'gcs' | 'azure';
  local?: {
    basePath: string;
    maxFileSize: number;
    maxTotalSize: number;
    allowedMimeTypes: string[];
    createDirectories: boolean;
    enableCompression: boolean;
  };
  s3?: {
    region: string;
    bucket: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
    forcePathStyle?: boolean;
    signedUrlExpiration: number;
  };
  gcs?: {
    projectId: string;
    bucket: string;
    keyFilename?: string;
    credentials?: GcsCredentials;
    signedUrlExpiration: number;
  };
  azure?: {
    accountName: string;
    accountKey?: string;
    containerName: string;
    sasToken?: string;
    signedUrlExpiration: number;
  };
  upload: {
    maxFileSize: number;
    allowedExtensions: string[];
    enableVirusScan: boolean;
    quarantineDirectory?: string;
    tempDirectory: string;
    cleanupTempFiles: boolean;
    cleanupInterval: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    enablePreCache: boolean;
    preCachePopularFiles: boolean;
  };
  backup: {
    enabled: boolean;
    schedule: string;
    retentionDays: number;
    compressionLevel: number;
    destination?: string;
  };
}

export interface GcsCredentials {
  client_email?: string;
  private_key?: string;
  project_id?: string;
  type?: string;
  private_key_id?: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
  [key: string]: unknown;
}

export default registerAs(
  'storage',
  (): StorageConfig => ({
    provider: (process.env.STORAGE_PROVIDER as 'local' | 's3' | 'gcs' | 'azure') ?? 'local',

    local: {
      basePath:
        process.env.STORAGE_LOCAL_PATH ?? path.join(process.cwd(), 'storage'),
      maxFileSize: parseInt(
        process.env.STORAGE_MAX_FILE_SIZE ?? '104857600',
        10,
      ), // 100MB
      maxTotalSize: parseInt(
        process.env.STORAGE_MAX_TOTAL_SIZE ?? '10737418240',
        10,
      ), // 10GB
      allowedMimeTypes: process.env.STORAGE_ALLOWED_MIME_TYPES?.split(',') ?? [
        'application/gzip',
        'application/x-gzip',
        'application/tar+gzip',
        'application/octet-stream',
      ],
      createDirectories: process.env.STORAGE_CREATE_DIRS !== 'false',
      enableCompression: process.env.STORAGE_COMPRESSION === 'true',
    },

    s3: {
      region: process.env.AWS_REGION ?? 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET ?? '',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      endpoint: process.env.AWS_S3_ENDPOINT,
      forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
      signedUrlExpiration: parseInt(
        process.env.AWS_S3_SIGNED_URL_EXPIRATION ?? '3600',
        10,
      ),
    },

    gcs: {
      projectId: process.env.GCS_PROJECT_ID ?? '',
      bucket: process.env.GCS_BUCKET ?? '',
      keyFilename: process.env.GCS_KEY_FILENAME,
      credentials: process.env.GCS_CREDENTIALS
        ? (JSON.parse(process.env.GCS_CREDENTIALS) as GcsCredentials)
        : undefined,
      signedUrlExpiration: parseInt(
        process.env.GCS_SIGNED_URL_EXPIRATION ?? '3600',
        10,
      ),
    },

    azure: {
      accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME ?? '',
      accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
      containerName: process.env.AZURE_STORAGE_CONTAINER ?? 'plugins',
      sasToken: process.env.AZURE_STORAGE_SAS_TOKEN,
      signedUrlExpiration: parseInt(
        process.env.AZURE_SIGNED_URL_EXPIRATION ?? '3600',
        10,
      ),
    },

    upload: {
      maxFileSize: parseInt(
        process.env.UPLOAD_MAX_FILE_SIZE ?? '104857600',
        10,
      ), // 100MB
      allowedExtensions: process.env.UPLOAD_ALLOWED_EXTENSIONS?.split(',') ?? [
        '.tar.gz',
        '.tgz',
        '.zip',
      ],
      enableVirusScan: process.env.UPLOAD_VIRUS_SCAN === 'true',
      quarantineDirectory: process.env.UPLOAD_QUARANTINE_DIR,
      tempDirectory:
        process.env.UPLOAD_TEMP_DIR ?? path.join(process.cwd(), 'tmp'),
      cleanupTempFiles: process.env.UPLOAD_CLEANUP_TEMP !== 'false',
      cleanupInterval: parseInt(
        process.env.UPLOAD_CLEANUP_INTERVAL ?? '3600000',
        10,
      ), // 1 hour
    },

    cache: {
      enabled: process.env.STORAGE_CACHE_ENABLED !== 'false',
      ttl: parseInt(process.env.STORAGE_CACHE_TTL ?? '3600', 10), // 1 hour
      maxSize: parseInt(process.env.STORAGE_CACHE_MAX_SIZE ?? '1073741824', 10), // 1GB
      enablePreCache: process.env.STORAGE_PRECACHE === 'true',
      preCachePopularFiles: process.env.STORAGE_PRECACHE_POPULAR === 'true',
    },

    backup: {
      enabled: process.env.STORAGE_BACKUP_ENABLED === 'true',
      schedule: process.env.STORAGE_BACKUP_SCHEDULE ?? '0 2 * * *', // Daily at 2 AM
      retentionDays: parseInt(
        process.env.STORAGE_BACKUP_RETENTION_DAYS ?? '30',
        10,
      ),
      compressionLevel: parseInt(
        process.env.STORAGE_BACKUP_COMPRESSION_LEVEL ?? '6',
        10,
      ),
      destination: process.env.STORAGE_BACKUP_DESTINATION,
    },
  }),
);
