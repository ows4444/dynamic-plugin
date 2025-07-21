import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { createReadStream, promises as fs, ReadStreamOptions as FSReadStreamOptions } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { getErrorCode, getErrorMessage } from '@lib/shared/common';

export interface FileStats {
  size: number;
  createdAt: Date;
  updatedAt: Date;
  checksum: string;
}

export interface ReadStreamOptions {
  start?: number;
  end?: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly basePath: string;

  constructor() {
    this.basePath = process.env.REGISTRY_STORAGE_PATH ?? './storage';
    void this.ensureBaseDirectory();
  }

  async write(filePath: string, data: Buffer): Promise<void> {
    try {
      const fullPath = this.getFullPath(filePath);
      const directory = path.dirname(fullPath);

      await this.createDirectory(directory);
      await fs.writeFile(fullPath, data);

      this.logger.debug(`Written file: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to write file ${filePath}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async read(filePath: string): Promise<Buffer | null> {
    try {
      const fullPath = this.getFullPath(filePath);
      const data = await fs.readFile(fullPath);
      this.logger.debug(`Read file: ${filePath}`);
      return data;
    } catch (error) {
      if (getErrorCode(error) === 'ENOENT') {
        return null;
      }
      this.logger.error(`Failed to read file ${filePath}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const fullPath = this.getFullPath(filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      const fullPath = this.getFullPath(filePath);
      await fs.unlink(fullPath);
      this.logger.debug(`Deleted file: ${filePath}`);
    } catch (error) {
      if (getErrorCode(error) !== 'ENOENT') {
        this.logger.error(
          `Failed to delete file ${filePath}: ${getErrorMessage(error)}`,
        );
        throw error;
      }
    }
  }

  async createDirectory(directoryPath: string): Promise<void> {
    try {
      const fullPath = this.getFullPath(directoryPath);
      await fs.mkdir(fullPath, { recursive: true });
      this.logger.debug(`Created directory: ${directoryPath}`);
    } catch (error) {
      this.logger.error(
        `Failed to create directory ${directoryPath}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async deleteDirectory(directoryPath: string): Promise<void> {
    try {
      const fullPath = this.getFullPath(directoryPath);
      await fs.rmdir(fullPath, { recursive: true });
      this.logger.debug(`Deleted directory: ${directoryPath}`);
    } catch (error) {
      if (getErrorCode(error) !== 'ENOENT') {
        this.logger.error(
          `Failed to delete directory ${directoryPath}: ${getErrorMessage(error)}`,
        );
        throw error;
      }
    }
  }

  async list(directoryPath: string): Promise<string[]> {
    try {
      const fullPath = this.getFullPath(directoryPath);
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      return entries.map((entry) => entry.name);
    } catch (error) {
      if (getErrorCode(error) === 'ENOENT') {
        return [];
      }
      this.logger.error(
        `Failed to list directory ${directoryPath}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async getFileStats(filePath: string): Promise<FileStats | null> {
    try {
      const fullPath = this.getFullPath(filePath);
      const stats = await fs.stat(fullPath);
      const data = await fs.readFile(fullPath);
      const checksum = crypto.createHash('sha256').update(data).digest('hex');

      return {
        size: stats.size,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
        checksum,
      };
    } catch (error) {
      if (getErrorCode(error) === 'ENOENT') {
        return null;
      }
      this.logger.error(
        `Failed to get file stats ${filePath}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  createReadStream(filePath: string, options?: ReadStreamOptions): Readable {
    const fullPath = this.getFullPath(filePath);

    const streamOptions: FSReadStreamOptions = {};
    if (options?.start !== undefined) {
      streamOptions.start = options.start;
    }
    if (options?.end !== undefined) {
      streamOptions.end = options.end;
    }

    return createReadStream(fullPath, streamOptions as Parameters<typeof createReadStream>[1]);
  }

  async calculateDirectorySize(directoryPath: string): Promise<number> {
    try {
      const fullPath = this.getFullPath(directoryPath);
      
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      const sizePromises = entries.map(async (entry) => {
        const entryPath = path.join(fullPath, entry.name);
        if (entry.isDirectory()) {
          return this.calculateDirectorySize(
            path.relative(this.basePath, entryPath),
          );
        } else {
          const stats = await fs.stat(entryPath);
          return stats.size;
        }
      });

      const sizes = await Promise.all(sizePromises);
      return sizes.reduce((total, size) => total + size, 0);
    } catch (error) {
      this.logger.error(
        `Failed to calculate directory size ${directoryPath}: ${getErrorMessage(error)}`,
      );
      return 0;
    }
  }

  async cleanupOldFiles(maxAge: number, pattern?: string): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAge);
    const cleanedCount = 0;

    try {
      await this.cleanupDirectory('', cutoffDate, pattern, cleanedCount);
      this.logger.log(`Cleaned up ${cleanedCount} old files`);
      return cleanedCount;
    } catch (error) {
      this.logger.error(`Failed to cleanup old files: ${getErrorMessage(error)}`);
      return cleanedCount;
    }
  }

  getBasePath(): string {
    return this.basePath;
  }

  private async ensureBaseDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });

      // Create standard subdirectories
      await fs.mkdir(path.join(this.basePath, 'plugins'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'temp'), { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create base directory: ${getErrorMessage(error)}`);
    }
  }

  private getFullPath(relativePath: string): string {
    const normalizedPath = path.normalize(relativePath);
    if (normalizedPath.includes('..')) {
      throw new Error('Path traversal not allowed');
    }
    return path.join(this.basePath, normalizedPath);
  }

  private async cleanupDirectory(
    directoryPath: string,
    cutoffDate: Date,
    pattern: string | undefined,
    cleanedCount: number,
  ): Promise<void> {
    const fullPath = this.getFullPath(directoryPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const directoryPromises: Promise<void>[] = [];
    const filePromises: Promise<void>[] = [];

    for (const entry of entries) {
      const entryPath = path.join(fullPath, entry.name);
      const relativePath = path.relative(this.basePath, entryPath);

      if (entry.isDirectory()) {
        directoryPromises.push(
          this.cleanupDirectory(
            relativePath,
            cutoffDate,
            pattern,
            cleanedCount,
          ).then(async () => {
            // Remove empty directories
            try {
              const remainingEntries = await fs.readdir(entryPath);
              if (remainingEntries.length === 0) {
                await fs.rmdir(entryPath);
                cleanedCount++;
              }
            } catch {
              // Directory not empty or other error, ignore
            }
          })
        );
      } else {
        // Check if file matches pattern (if specified)
        if (pattern && !entry.name.match(new RegExp(pattern))) {
          continue;
        }

        filePromises.push(
          fs.stat(entryPath).then(async (stats) => {
            if (stats.mtime < cutoffDate) {
              await fs.unlink(entryPath);
              cleanedCount++;
            }
          })
        );
      }
    }

    await Promise.all([...directoryPromises, ...filePromises]);
  }
}
