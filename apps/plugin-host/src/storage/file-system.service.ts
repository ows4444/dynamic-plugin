import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { getErrorCode, getErrorMessage } from '@lib/shared/common';
import type { PluginStorageMetadata, StorageProvider } from './storage.interface';

@Injectable()
export class FileSystemService implements StorageProvider {
  private readonly logger = new Logger(FileSystemService.name);
  private readonly basePath: string;

  constructor() {
    this.basePath = process.env['PLUGIN_STORAGE_PATH'] ?? './plugins';
    void this.ensureBaseDirectory();
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

  async exists(filePath: string): Promise<boolean> {
    try {
      const fullPath = this.getFullPath(filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
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

  async getFileStats(filePath: string): Promise<PluginStorageMetadata | null> {
    try {
      const fullPath = this.getFullPath(filePath);
      const stats = await fs.stat(fullPath);
      const data = await fs.readFile(fullPath);
      const checksum = crypto.createHash('sha256').update(data).digest('hex');

      const pathParts = filePath.split('/');
      const pluginName = pathParts[0] ?? 'unknown';
      const version = pathParts[1] ?? '1.0.0';

      return {
        pluginName,
        version,
        size: stats.size,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
        checksum,
        path: filePath,
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

  async cleanupOldFiles(maxAge: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAge);
    const cleanedCount = { count: 0 };

    try {
      await this.cleanupDirectory('', cutoffDate, cleanedCount);
      this.logger.log(`Cleaned up ${cleanedCount.count} old files`);
      return cleanedCount.count;
    } catch (error) {
      this.logger.error(`Failed to cleanup old files: ${getErrorMessage(error)}`);
      return cleanedCount.count;
    }
  }

  getBasePath(): string {
    return this.basePath;
  }

  private async ensureBaseDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
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
    cleanedCount: { count: number },
  ): Promise<void> {
    const fullPath = this.getFullPath(directoryPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const promises = entries.map(async (entry) => {
      const entryPath = path.join(fullPath, entry.name);
      const relativePath = path.relative(this.basePath, entryPath);

      if (entry.isDirectory()) {
        await this.cleanupDirectory(relativePath, cutoffDate, cleanedCount);

        const remainingEntries = await fs.readdir(entryPath);
        if (remainingEntries.length === 0) {
          await fs.rmdir(entryPath);
          cleanedCount.count++;
        }
      } else {
        const stats = await fs.stat(entryPath);
        if (stats.mtime < cutoffDate) {
          await fs.unlink(entryPath);
          cleanedCount.count++;
        }
      }
    });

    await Promise.all(promises);
  }
}
