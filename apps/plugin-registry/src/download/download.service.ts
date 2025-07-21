import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { MetadataService } from '../metadata/metadata.service';
import { StorageService } from '../storage/storage.service';

export interface DownloadInfo {
  filename: string;
  size: number;
  checksum: string;
  lastModified: Date;
  downloadCount: number;
}

export interface DownloadStats {
  period: string;
  totalDownloads: number;
  uniquePlugins: number;
  topPlugins: Array<{
    id: string;
    name: string;
    version: string;
    downloads: number;
  }>;
  downloadsByDate: Array<{
    date: string;
    downloads: number;
  }>;
}

export interface DownloadRecord {
  pluginId: string;
  pluginName: string;
  version: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class DownloadService {
  private readonly logger = new Logger(DownloadService.name);
  private readonly downloadHistory: DownloadRecord[] = [];
  private readonly maxHistorySize = 10000;

  constructor(
    private readonly storageService: StorageService,
    private readonly metadataService: MetadataService,
  ) {}

  async getDownloadInfo(pluginId: string): Promise<DownloadInfo | null> {
    try {
      const metadata = await this.metadataService.findPluginById(pluginId);

      if (!metadata) {
        return null;
      }

      const exists = await this.storageService.exists(metadata.filePath);
      if (!exists) {
        this.logger.warn(`Plugin file not found: ${metadata.filePath}`);
        return null;
      }

      const stats = await this.storageService.getFileStats(metadata.filePath);
      if (!stats) {
        return null;
      }

      const downloadCount = this.getDownloadCount(pluginId);

      return {
        filename: `${metadata.name}-${metadata.version}.tar.gz`,
        size: stats.size,
        checksum: metadata.checksum,
        lastModified: stats.updatedAt,
        downloadCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get download info for ${pluginId}: ${error.message}`,
      );
      return null;
    }
  }

  async getDownloadStream(pluginId: string): Promise<Readable> {
    const metadata = await this.metadataService.findPluginById(pluginId);

    if (!metadata) {
      throw new NotFoundException(`Plugin not found: ${pluginId}`);
    }

    const exists = await this.storageService.exists(metadata.filePath);
    if (!exists) {
      throw new NotFoundException(
        `Plugin file not found: ${metadata.filePath}`,
      );
    }

    return this.storageService.createReadStream(metadata.filePath);
  }

  async getPartialStream(
    pluginId: string,
    rangeHeader: string,
  ): Promise<Readable> {
    const metadata = await this.metadataService.findPluginById(pluginId);

    if (!metadata) {
      throw new NotFoundException(`Plugin not found: ${pluginId}`);
    }

    const exists = await this.storageService.exists(metadata.filePath);
    if (!exists) {
      throw new NotFoundException(
        `Plugin file not found: ${metadata.filePath}`,
      );
    }

    const range = this.parseRangeHeader(rangeHeader);
    if (!range) {
      throw new Error('Invalid range header');
    }

    return this.storageService.createReadStream(metadata.filePath, {
      start: range.start,
      end: range.end,
    });
  }

  async resolvePluginId(name: string, version: string): Promise<string | null> {
    const metadata = await this.metadataService.findPlugin(name, version);
    return metadata?.id ?? null;
  }

  async recordDownload(
    pluginId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      const metadata = await this.metadataService.findPluginById(pluginId);

      if (!metadata) {
        this.logger.warn(
          `Attempted to record download for unknown plugin: ${pluginId}`,
        );
        return;
      }

      const downloadRecord: DownloadRecord = {
        pluginId,
        pluginName: metadata.name,
        version: metadata.version,
        timestamp: new Date(),
        ipAddress,
        userAgent,
      };

      this.downloadHistory.push(downloadRecord);

      // Trim history if it gets too large
      if (this.downloadHistory.length > this.maxHistorySize) {
        this.downloadHistory.shift();
      }

      await this.metadataService.incrementDownloadCount(pluginId);

      this.logger.log(
        `Recorded download: ${metadata.name}@${metadata.version}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to record download for ${pluginId}: ${error.message}`,
      );
    }
  }

  async getDownloadStats(
    period: 'day' | 'week' | 'month' | 'year',
    limit: number,
  ): Promise<DownloadStats> {
    const now = new Date();
    const periodMs = this.getPeriodMilliseconds(period);
    const cutoffDate = new Date(now.getTime() - periodMs);

    const recentDownloads = this.downloadHistory.filter(
      (record) => record.timestamp >= cutoffDate,
    );

    const pluginDownloads = new Map<string, number>();
    const downloadsByDate = new Map<string, number>();

    for (const record of recentDownloads) {
      const key = `${record.pluginId}:${record.pluginName}@${record.version}`;
      pluginDownloads.set(key, (pluginDownloads.get(key) ?? 0) + 1);

      const dateKey = record.timestamp.toISOString().split('T')[0];
      downloadsByDate.set(dateKey, (downloadsByDate.get(dateKey) ?? 0) + 1);
    }

    const topPlugins = Array.from(pluginDownloads.entries())
      .map(([key, downloads]) => {
        const [pluginId, nameVersion] = key.split(':');
        const [name, version] = nameVersion.split('@');
        return { id: pluginId, name, version, downloads };
      })
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);

    const downloadsByDateArray = Array.from(downloadsByDate.entries())
      .map(([date, downloads]) => ({ date, downloads }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return   Promise.resolve({
      period,
      totalDownloads: recentDownloads.length,
      uniquePlugins: pluginDownloads.size,
      topPlugins,
      downloadsByDate: downloadsByDateArray,
    }) ;
  }

  getDownloadHistory(pluginId?: string, limit = 100): DownloadRecord[] {
    let history = [...this.downloadHistory];

    if (pluginId) {
      history = history.filter((record) => record.pluginId === pluginId);
    }

    return history
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private getDownloadCount(pluginId: string): number {
    return this.downloadHistory.filter((record) => record.pluginId === pluginId)
      .length;
  }

  private parseRangeHeader(
    rangeHeader: string,
  ): { start: number; end?: number } | null {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return null;
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : undefined;

    return { start, end };
  }

  private getPeriodMilliseconds(
    period: 'day' | 'week' | 'month' | 'year',
  ): number {
    const dayMs = 24 * 60 * 60 * 1000;

    switch (period) {
      case 'day':
        return dayMs;
      case 'week':
        return 7 * dayMs;
      case 'month':
        return 30 * dayMs;
      case 'year':
        return 365 * dayMs;
      default:
        return 30 * dayMs;
    }
  }
}
