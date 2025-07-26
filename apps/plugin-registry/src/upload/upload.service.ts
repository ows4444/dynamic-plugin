import { getErrorMessage } from '@lib/shared/common';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as tar from 'tar';
import * as path from 'path';
import { MetadataService, ValidationResults } from '../metadata/metadata.service';
import { StorageService } from '../storage/storage.service';
import { ValidationService } from '../validation/validation.service';
import { CreatePluginUploadDto, PluginUploadResponseDto } from './upload.dto';

// Type guards for runtime validation
function isPluginManifest(obj: unknown): obj is PluginManifest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    'version' in obj &&
    typeof (obj as PluginManifest).name === 'string' &&
    typeof (obj as PluginManifest).version === 'string'
  );
}

function isPackageJsonContent(obj: unknown): obj is PackageJsonContent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (!('name' in obj) || typeof (obj as PackageJsonContent).name === 'string') &&
    (!('version' in obj) || typeof (obj as PackageJsonContent).version === 'string')
  );
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manifest?: PluginManifest;
  size: number;
  checksum: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  main: string;
  pluginType: string;
  apiVersion: string;
  permissions?: string[];
  dependencies?: Record<string, string>;
  engines?: {
    host?: string;
    [key: string]: unknown;
  };
  config?: Record<string, unknown>;
  routes?: PluginRoute[];
  hooks?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PluginRoute {
  path: string;
  method: string;
  handler?: string;
  [key: string]: unknown;
}

export interface PackageJsonContent {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly validationService: ValidationService,
    private readonly metadataService: MetadataService,
  ) {}

  async uploadPlugin(
    file: Express.Multer.File,
    uploadDto: CreatePluginUploadDto,
  ): Promise<PluginUploadResponseDto> {
    const uploadId = this.generateUploadId();

    try {
      // Validate file size and type
      await this.validateFileBasics(file);

      // Calculate checksum
      const checksum = this.calculateChecksum(file.buffer);

      // Check for duplicate uploads
      await this.checkDuplicate(uploadDto.name, uploadDto.version, checksum);

      // Store the uploaded file temporarily with path validation
      const sanitizedTempFilename = this.sanitizeFilename(file.originalname);
      const tempPath = path.posix.join('temp', uploadId, sanitizedTempFilename);
      
      // Validate the path to prevent directory traversal
      this.validatePath(tempPath, 'temp');
      
      await this.storageService.write(tempPath, file.buffer);

      // Validate the plugin
      const validation = await this.validatePluginFile(file);

      if (!validation.valid) {
        // Clean up temporary file
        await this.storageService.delete(tempPath);
        throw new BadRequestException(
          `Plugin validation failed: ${validation.errors.join(', ')}`,
        );
      }

      // Store the plugin in permanent storage with path validation
      const sanitizedName = this.sanitizePathComponent(uploadDto.name);
      const sanitizedVersion = this.sanitizePathComponent(uploadDto.version);
      const sanitizedPluginFilename = this.sanitizeFilename(file.originalname);
      
      const pluginPath = path.posix.join('plugins', sanitizedName, sanitizedVersion, sanitizedPluginFilename);
      
      // Validate the path to prevent directory traversal
      this.validatePath(pluginPath, 'plugins');
      
      await this.storageService.write(pluginPath, file.buffer);

      // Create metadata record
      const metadata = await this.metadataService.createPlugin({
        name: uploadDto.name,
        version: uploadDto.version,
        description: uploadDto.description,
        author: uploadDto.author,
        license: uploadDto.license,
        tags: uploadDto.tags,
        category: uploadDto.category,
        homepage: uploadDto.homepage,
        repository: uploadDto.repository,
        dependencies: uploadDto.dependencies,
        minHostVersion: uploadDto.minHostVersion,
        maxHostVersion: uploadDto.maxHostVersion,
        filePath: pluginPath,
        fileSize: file.size,
        checksum,
        manifest: validation.manifest,
      });

      // Clean up temporary file
      await this.storageService.delete(tempPath);

      const result: PluginUploadResponseDto = {
        id: metadata.id,
        name: uploadDto.name,
        version: uploadDto.version,
        status: 'validated',
        uploadedAt: new Date(),
        validationResults: {
          ...validation,
          *[Symbol.iterator]() {
            for (const key in this) {
              if (Object.prototype.hasOwnProperty.call(this, key) && key !== Symbol.iterator as unknown) {
                yield [key, this[key]];
              }
            }
          },
        } as ValidationResults,
        downloadUrl: `/plugins/${metadata.id}/download`,
        size: file.size,
        checksum,
      };

      this.logger.log(
        `Plugin uploaded successfully: ${uploadDto.name}@${uploadDto.version}`,
      );
      return result;
    } catch (error) {
      const errorMessage = getErrorMessage(error,'Unknown upload error');
      this.logger.error(
        `Upload failed for ${uploadDto.name}@${uploadDto.version}: ${errorMessage}`,
      );

      // Clean up any temporary files
      try {
        await this.storageService.deleteDirectory(`temp/${uploadId}`);
      } catch (error) {
        const cleanupErrorMessage = getErrorMessage(error,'Unknown cleanup error');
        this.logger.warn(
          `Failed to cleanup temp directory: ${cleanupErrorMessage}`,
        );
      }

      throw error;
    }
  }

  async validatePluginFile(
    file: Express.Multer.File,
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      size: file.size,
      checksum: this.calculateChecksum(file.buffer),
    };

    try {
      // Validate file is a valid tar.gz
      if (!this.isTarGzFile(file)) {
        result.errors.push('File must be a .tar.gz archive');
        result.valid = false;
        return result;
      }

      // Extract and validate contents
      const extractedFiles = await this.extractTarGz(file.buffer);

      // Validate manifest exists
      const manifestFile = extractedFiles.find(
        (f) => f.path === 'plugin.manifest.json',
      );
      if (!manifestFile) {
        result.errors.push('Missing plugin.manifest.json file');
        result.valid = false;
        return result;
      }

      // Parse and validate manifest
      try {
        const parsedManifest = JSON.parse(manifestFile.content.toString());
        if (!isPluginManifest(parsedManifest)) {
          result.errors.push('Invalid manifest format: missing required fields');
          return result;
        }
        const manifest = parsedManifest;
        result.manifest = manifest;

        const manifestValidation =
          await this.validationService.validateManifest(manifest);
        if (!manifestValidation.valid) {
          result.errors.push(...manifestValidation.errors);
          result.warnings.push(...manifestValidation.warnings);
          result.valid = false;
        }
      } catch (_parseError) {
        result.errors.push('Invalid JSON in plugin.manifest.json');
        result.valid = false;
      }

      // Validate required files exist
      const requiredFiles = ['package.json'];
      for (const requiredFile of requiredFiles) {
        if (!extractedFiles.find((f) => f.path === requiredFile)) {
          result.warnings.push(`Missing recommended file: ${requiredFile}`);
        }
      }

      // Security validation
      const securityValidation =
        await this.validationService.validateSecurity(extractedFiles);
      if (!securityValidation.valid) {
        result.errors.push(...securityValidation.errors);
        result.warnings.push(...securityValidation.warnings);
        result.valid = false;
      }

      // Dependency validation
      const packageJsonFile = extractedFiles.find(
        (f) => f.path === 'package.json',
      );
      if (packageJsonFile) {
        try {
          const parsedPackageJson = JSON.parse(packageJsonFile.content.toString());
          if (!isPackageJsonContent(parsedPackageJson)) {
            result.warnings.push('Invalid package.json format');
            return result;
          }
          const packageJson = parsedPackageJson;
          const depValidation =
            await this.validationService.validateDependencies(packageJson);
          if (!depValidation.valid) {
            result.warnings.push(...depValidation.warnings);
            // Don't make dependency issues fatal, just warnings
          }
        } catch (_parseError) {
          result.warnings.push('Could not parse package.json');
        }
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error,'Unknown validation error');
      result.errors.push(`Validation error: ${errorMessage}`);
      result.valid = false;
    }

    return result;
  }

  private async validateFileBasics(file: Express.Multer.File): Promise<void> {
    const maxSize = 100 * 1024 * 1024; // 100MB

    if (file.size > maxSize) {
      throw new BadRequestException(
        `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`,
      );
    }

    const allowedMimeTypes = [
      'application/gzip',
      'application/x-gzip',
      'application/tar+gzip',
      'application/octet-stream',
    ];

    if (
      !allowedMimeTypes.includes(file.mimetype) &&
      !file.originalname.endsWith('.tar.gz')
    ) {
      throw new BadRequestException('File must be a .tar.gz archive');
    }
    await Promise.resolve();
  }

  private async checkDuplicate(
    name: string,
    version: string,
    checksum: string,
  ): Promise<void> {
    const existing = await this.metadataService.findPlugin(name, version);

    if (existing) {
      if (existing.checksum === checksum) {
        throw new BadRequestException(
          'Plugin with same content already exists',
        );
      } else {
        throw new BadRequestException(
          'Plugin version already exists with different content',
        );
      }
    }
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private isTarGzFile(file: Express.Multer.File): boolean {
    return (
      file.originalname.endsWith('.tar.gz') ||
      file.originalname.endsWith('.tgz') ||
      file.mimetype.includes('gzip')
    );
  }

  /**
   * SECURITY: Safely extract tar.gz with path validation to prevent zip-slip attacks
   */
  private async extractTarGz(
    buffer: Buffer,
  ): Promise<Array<{ path: string; content: Buffer }>> {
    return new Promise((resolve, reject) => {
      const files: Array<{ path: string; content: Buffer }> = [];
      const chunks = new Map<string, Buffer[]>();
      const maxFiles = 1000; // Prevent DoS with too many files
      const maxFileSize = 10 * 1024 * 1024; // 10MB per file
      let fileCount = 0;

      const stream = tar.t({
        onentry: (entry) => {
          // Security checks
          if (++fileCount > maxFiles) {
            reject(new Error('Archive contains too many files'));
            return;
          }
          
          if (entry.size > maxFileSize) {
            reject(new Error(`File too large: ${entry.path}`));
            return;
          }
          
          // SECURITY: Validate entry path to prevent zip-slip attacks
          if (!this.isValidArchivePath(entry.path)) {
            reject(new Error(`Invalid file path in archive: ${entry.path}`));
            return;
          }
          
          if (entry.type === 'File') {
            const pathChunks: Buffer[] = [];
            chunks.set(entry.path, pathChunks);

            entry.on('data', (chunk: Buffer) => {
              pathChunks.push(chunk);
            });

            entry.on('end', () => {
              const content = Buffer.concat(pathChunks);
              // Final validation of extracted content size
              if (content.length > maxFileSize) {
                reject(new Error(`Extracted file too large: ${entry.path}`));
                return;
              }
              files.push({ path: entry.path, content });
            });
          }
        },
      });

      stream.on('error', reject);
      stream.on('end', () => { resolve(files); });

      stream.end(buffer);
    });
  }

  private generateUploadId(): string {
    // Use crypto.randomUUID() for better security
    return `upload-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;
  }

  /**
   * SECURITY: Sanitize filename to prevent path traversal
   */
  private sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      throw new BadRequestException('Invalid filename');
    }
    
    // Remove any path components and dangerous characters
    const sanitized = path.basename(filename)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 255); // Limit length
    
    if (!sanitized || sanitized === '.' || sanitized === '..') {
      throw new BadRequestException('Invalid filename after sanitization');
    }
    
    return sanitized;
  }

  /**
   * SECURITY: Sanitize path components (names, versions)
   */
  private sanitizePathComponent(component: string): string {
    if (!component || typeof component !== 'string') {
      throw new BadRequestException('Invalid path component');
    }
    
    // Allow only alphanumeric, hyphens, underscores, dots
    const sanitized = component
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100); // Limit length
    
    if (!sanitized || sanitized === '.' || sanitized === '..' || sanitized.startsWith('.')) {
      throw new BadRequestException('Invalid path component after sanitization');
    }
    
    return sanitized;
  }

  /**
   * SECURITY: Validate that a path stays within expected boundaries
   */
  private validatePath(filePath: string, expectedPrefix: string): void {
    const normalizedPath = path.posix.normalize(filePath);
    const normalizedPrefix = path.posix.normalize(expectedPrefix);
    
    // Check for path traversal attempts
    if (normalizedPath.includes('..') || 
        !normalizedPath.startsWith(normalizedPrefix) ||
        normalizedPath.includes('//') ||
        normalizedPath.match(/[/\\]\.\.[/\\]/)) {
      throw new BadRequestException(`Path traversal detected: ${filePath}`);
    }
    
    // Additional check for absolute paths
    if (path.isAbsolute(normalizedPath)) {
      throw new BadRequestException(`Absolute path not allowed: ${filePath}`);
    }
  }

  /**
   * SECURITY: Validate paths within archive files
   */
  private isValidArchivePath(archivePath: string): boolean {
    if (!archivePath || typeof archivePath !== 'string') {
      return false;
    }
    
    const normalizedPath = path.posix.normalize(archivePath);
    
    // Reject paths that:
    // - Contain .. (parent directory references)
    // - Are absolute paths
    // - Contain null bytes or other dangerous characters
    // - Are too long
    if (normalizedPath.includes('..') ||
        path.isAbsolute(normalizedPath) ||
        normalizedPath.includes('\0') ||
        normalizedPath.length > 500 ||
        normalizedPath.match(/[/\\]\.\.[/\\]/) ||
        normalizedPath.startsWith('./') ||
        normalizedPath === '.' ||
        normalizedPath === '..') {
      return false;
    }
    
    return true;
  }
}
