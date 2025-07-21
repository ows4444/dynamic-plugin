import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DownloadService {
  private readonly logger = new Logger(DownloadService.name);
  private readonly downloadDir = path.join(process.cwd(), 'downloads');

  constructor() {
    // Ensure download directory exists
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  async downloadPackage(
    url: string,
    pluginId: string,
    version: string,
  ): Promise<string> {
    this.logger.log(`Downloading package from: ${url}`);

    try {
      const filename = `${pluginId}-${version}.tgz`;
      const filePath = path.join(this.downloadDir, filename);

      // For now, create a mock package file
      const mockContent = `Mock package for ${pluginId}@${version}`;
      fs.writeFileSync(filePath, mockContent);

      this.logger.log(`Package downloaded successfully: ${filePath}`);
      return Promise.resolve(filePath);
    } catch (error) {
      this.logger.error(`Failed to download package: ${error.message}`);
      throw error;
    }
  }

  async downloadWithProgress(
    url: string,
    pluginId: string,
    version: string,
    onProgress?: (downloaded: number, total: number) => void,
  ): Promise<string> {
    this.logger.log(`Downloading package with progress tracking: ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const contentLength = parseInt(
        response.headers.get('content-length') ?? '0',
      );
      const filename = `${pluginId}-${version}.tgz`;
      const filePath = path.join(this.downloadDir, filename);

      const writeStream = fs.createWriteStream(filePath);
      let downloaded = 0;

      if (response.body) {
        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          writeStream.write(value);
          downloaded += value.length;

          if (onProgress && contentLength > 0) {
            onProgress(downloaded, contentLength);
          }
        }

        writeStream.end();
      }

      this.logger.log(`Package downloaded with progress: ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error(
        `Failed to download package with progress: ${error.message}`,
      );
      throw error;
    }
  }

  async verifyChecksum(
    filePath: string,
    expectedChecksum: string,
  ): Promise<boolean> {
    this.logger.log(`Verifying checksum for: ${filePath}`);

    try {
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      return new Promise((resolve, reject) => {
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => {
          const actualChecksum = hash.digest('hex');
          const isValid = actualChecksum === expectedChecksum;

          if (isValid) {
            this.logger.log(`Checksum verification passed: ${filePath}`);
          } else {
            this.logger.error(`Checksum verification failed: ${filePath}`);
          }

          resolve(isValid);
        });
        stream.on('error', reject);
      });
    } catch (error) {
      this.logger.error(`Checksum verification error: ${error.message}`);
      return false;
    }
  }

  async cleanupDownloads(olderThanDays = 7): Promise<void> {
    this.logger.log(`Cleaning up downloads older than ${olderThanDays} days`);

    try {
      const files = fs.readdirSync(this.downloadDir);
      const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.downloadDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          this.logger.log(`Deleted old download: ${file}`);
        }
      }
      this.logger.log('Download cleanup complete');
      await Promise.resolve();
    } catch (error) {
      this.logger.error(`Failed to cleanup downloads: ${error.message}`);
    }
  }

  getDownloadPath(pluginId: string, version: string): string {
    return path.join(this.downloadDir, `${pluginId}-${version}.tgz`);
  }
}
