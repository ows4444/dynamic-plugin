import { Test, type TestingModule } from '@nestjs/testing';
 
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { CloudStorageService } from './cloud-storage.service';

describe('CloudStorageService', () => {
  let service: CloudStorageService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        DEFAULT_STORAGE_PROVIDER: 'local',
        LOCAL_STORAGE_PATH: './test-storage',
        AWS_REGION: 'us-east-1',
        AWS_S3_BUCKET: 'test-bucket',
        GCP_STORAGE_BUCKET: 'test-gcp-bucket',
        AZURE_STORAGE_CONTAINER: 'test-container',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudStorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CloudStorageService>(CloudStorageService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    it('should upload a buffer successfully', async () => {
      const key = 'test-file.txt';
      const data = Buffer.from('test content');
      const options = {
        contentType: 'text/plain',
        metadata: { author: 'test' },
      };

      const result = await service.upload(key, data, options);

      expect(result).toBeDefined();
      expect(result.key).toBe(key);
      expect(result.size).toBe(data.length);
      expect(result.contentType).toBe(options.contentType);
      expect(result.metadata).toEqual(options.metadata);
      expect(result.lastModified).toBeInstanceOf(Date);
      expect(result.etag).toBeDefined();
    });

    it('should upload a string successfully', async () => {
      const key = 'test-string.txt';
      const data = 'test string content';

      const result = await service.upload(key, data);

      expect(result).toBeDefined();
      expect(result.key).toBe(key);
      expect(result.size).toBe(Buffer.byteLength(data));
      expect(result.contentType).toBe('application/octet-stream');
    });

    it('should upload a readable stream successfully', async () => {
      const key = 'test-stream.txt';
      const data = new Readable({
        read() {
          this.push('stream content');
          this.push(null);
        },
      });

      const result = await service.upload(key, data);

      expect(result).toBeDefined();
      expect(result.key).toBe(key);
      expect(result.size).toBe(1024); // Mock size
    });

    it('should handle upload options', async () => {
      const key = 'test-with-options.txt';
      const data = Buffer.from('test');
      const options = {
        contentType: 'application/json',
        metadata: { version: '1.0' },
        tags: { env: 'test' },
        overwrite: true,
      };

      const result = await service.upload(key, data, options);

      expect(result.contentType).toBe(options.contentType);
      expect(result.metadata).toEqual(options.metadata);
      expect(result.tags).toEqual(options.tags);
    });
  });

  describe('download', () => {
    it('should download a file successfully', async () => {
      const key = 'test-download.txt';

      const result = await service.download(key);

      expect(result).toBeDefined();
      expect(result.stream).toBeInstanceOf(Readable);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.key).toBe(key);
      expect(result.metadata.size).toBe(1024);
    });

    it('should handle download options', async () => {
      const key = 'test-download-options.txt';
      const options = {
        range: { start: 0, end: 100 },
        version: 'v1.0',
      };

      const result = await service.download(key, options);

      expect(result).toBeDefined();
      expect(result.stream).toBeInstanceOf(Readable);
      expect(result.metadata.key).toBe(key);
    });
  });

  describe('delete', () => {
    it('should delete a file successfully', async () => {
      const key = 'test-delete.txt';

      await expect(service.delete(key)).resolves.not.toThrow();
    });

    it('should delete a specific version', async () => {
      const key = 'test-delete-version.txt';
      const version = 'v1.0';

      await expect(service.delete(key, version)).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const key = 'existing-file.txt';
      
      // Mock getMetadata to succeed
      jest.spyOn(service, 'getMetadata').mockResolvedValue({
        key,
        size: 100,
        lastModified: new Date(),
        etag: 'test-etag',
      });

      const exists = await service.exists(key);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const key = 'non-existing-file.txt';
      
      // Mock getMetadata to fail
      jest.spyOn(service, 'getMetadata').mockRejectedValue(new Error('Not found'));

      const exists = await service.exists(key);
      expect(exists).toBe(false);
    });
  });

  describe('getMetadata', () => {
    it('should get file metadata successfully', async () => {
      const key = 'test-metadata.txt';

      const metadata = await service.getMetadata(key);

      expect(metadata).toBeDefined();
      expect(metadata.key).toBe(key);
      expect(metadata.size).toBe(1024);
      expect(metadata.lastModified).toBeInstanceOf(Date);
      expect(metadata.etag).toBeDefined();
      expect(metadata.contentType).toBe('application/octet-stream');
    });
  });

  describe('list', () => {
    it('should list files successfully', async () => {
      const options = {
        prefix: 'test/',
        maxKeys: 10,
      };

      const result = await service.list(options);

      expect(result).toBeDefined();
      expect(result.objects).toBeInstanceOf(Array);
      expect(result.prefixes).toBeInstanceOf(Array);
      expect(typeof result.isTruncated).toBe('boolean');
      expect(typeof result.totalCount).toBe('number');
    });

    it('should list with default options', async () => {
      const result = await service.list();

      expect(result).toBeDefined();
      expect(result.objects).toEqual([]);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('copy', () => {
    it('should copy file successfully', async () => {
      const sourceKey = 'source.txt';
      const destinationKey = 'destination.txt';

      // Mock download and upload
      const mockStream = new Readable({
        read() {
          this.push('mock content');
          this.push(null);
        },
      });
      
      jest.spyOn(service, 'download').mockResolvedValue({
        stream: mockStream,
        metadata: {
          key: sourceKey,
          size: 100,
          lastModified: new Date(),
          etag: 'test-etag',
        },
      });
      
      jest.spyOn(service, 'upload').mockResolvedValue({
        key: destinationKey,
        size: 100,
        lastModified: new Date(),
        etag: 'test-etag-2',
      });

      const result = await service.copy(sourceKey, destinationKey);

      expect(result).toBeDefined();
      expect(result.key).toBe(destinationKey);
      expect(service.download).toHaveBeenCalledWith(sourceKey, {}, undefined);
      expect(service.upload).toHaveBeenCalledWith(destinationKey, mockStream, {}, undefined);
    });

    it('should copy between different providers', async () => {
      const sourceKey = 'source.txt';
      const destinationKey = 'destination.txt';
      const sourceProvider = 'local';
      const destinationProvider = 's3';
      const options = { contentType: 'text/plain' };

      const mockStream = new Readable({
        read() {
          this.push('mock content');
          this.push(null);
        },
      });
      
      jest.spyOn(service, 'download').mockResolvedValue({
        stream: mockStream,
        metadata: {
          key: sourceKey,
          size: 100,
          lastModified: new Date(),
          etag: 'test-etag',
        },
      });
      
      jest.spyOn(service, 'upload').mockResolvedValue({
        key: destinationKey,
        size: 100,
        lastModified: new Date(),
        etag: 'test-etag-2',
      });

      await service.copy(sourceKey, destinationKey, sourceProvider, destinationProvider, options);

      expect(service.download).toHaveBeenCalledWith(sourceKey, {}, sourceProvider);
      expect(service.upload).toHaveBeenCalledWith(destinationKey, mockStream, options, destinationProvider);
    });
  });

  describe('generatePresignedUrl', () => {
    it('should generate presigned URL for GET operation', async () => {
      const key = 'test-presigned.txt';
      const operation = 'get';
      const expirationSeconds = 3600;

      const url = await service.generatePresignedUrl(key, operation, expirationSeconds);

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      expect(url).toContain(key);
      expect(url).toContain('expires=3600');
    });

    it('should generate presigned URL for PUT operation', async () => {
      const key = 'test-upload.txt';
      const operation = 'put';

      const url = await service.generatePresignedUrl(key, operation);

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      expect(url).toContain(key);
    });
  });

  describe('getStats', () => {
    it('should get storage statistics', async () => {
      const stats = await service.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats.totalObjects).toBe('number');
      expect(typeof stats.totalSize).toBe('number');
      expect(stats.providerStats).toBeDefined();
      expect(stats.providerStats.provider).toBe('local');
    });

    it('should get stats for specific provider', async () => {
      const stats = await service.getStats('s3');

      expect(stats).toBeDefined();
      expect(stats.providerStats).toBeDefined();
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple files successfully', async () => {
      const keys = ['file1.txt', 'file2.txt', 'file3.txt'];

      // Mock delete to always succeed
      jest.spyOn(service as any, 'performDelete').mockResolvedValue(undefined);

      const result = await service.bulkDelete(keys);

      expect(result).toBeDefined();
      expect(result.successful).toEqual(keys);
      expect(result.failed).toEqual([]);
    });

    it('should handle partial failures', async () => {
      const keys = ['success.txt', 'fail.txt', 'success2.txt'];

      // Mock delete to fail for second file
      jest.spyOn(service as any, 'performDelete').mockImplementation((provider, key) => {
        if (key === 'fail.txt') {
          throw new Error('Delete failed');
        }
        return Promise.resolve();
      });

      const result = await service.bulkDelete(keys);

      expect(result.successful).toEqual(['success.txt', 'success2.txt']);
      expect(result.failed).toEqual([{
        key: 'fail.txt',
        error: 'Delete failed',
      }]);
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown provider', async () => {
      const unknownProvider = 'unknown-provider';
      
      await expect(
        service.upload('test.txt', 'content', {}, unknownProvider)
      ).rejects.toThrow(`Storage provider '${unknownProvider}' not configured`);
    });
  });
});