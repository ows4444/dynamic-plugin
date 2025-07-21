import {
  Controller,
  Get,
  Headers,
  Logger,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { DownloadService } from './download.service';

@Controller('plugins')
export class DownloadController {
  private readonly logger = new Logger(DownloadController.name);

  constructor(private readonly downloadService: DownloadService) {}

  @Get(':id/download')
  async downloadPlugin(
    @Param('id') pluginId: string,
    @Res() response: Response,
    @Headers('range') range?: string,
  ) {
    try {
      const downloadInfo = await this.downloadService.getDownloadInfo(pluginId);

      if (!downloadInfo) {
        throw new NotFoundException(`Plugin not found: ${pluginId}`);
      }

      this.logger.log(`Downloading plugin: ${pluginId}`);

      // Set headers
      response.setHeader('Content-Type', 'application/octet-stream');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${downloadInfo.filename}"`,
      );
      response.setHeader('Content-Length', downloadInfo.size.toString());
      response.setHeader('ETag', `"${downloadInfo.checksum}"`);
      response.setHeader(
        'Last-Modified',
        downloadInfo.lastModified.toUTCString(),
      );

      // Handle range requests for partial downloads
      if (range) {
        const stream = await this.downloadService.getPartialStream(
          pluginId,
          range,
        );
        response.status(206);
        stream.pipe(response);
      } else {
        const stream = await this.downloadService.getDownloadStream(pluginId);
        stream.pipe(response);
      }

      await this.downloadService.recordDownload(pluginId);
    } catch (error) {
      this.logger.error(
        `Download failed for plugin ${pluginId}: ${error.message}`,
      );

      if (!response.headersSent) {
        if (error instanceof NotFoundException) {
          response.status(404).json({ error: 'Plugin not found' });
        } else {
          response.status(500).json({ error: 'Download failed' });
        }
      }
    }
  }

  @Get(':name/:version/download')
  async downloadPluginByNameVersion(
    @Param('name') name: string,
    @Param('version') version: string,
    @Res() response: Response,
    @Headers('range') range?: string,
  ) {
    try {
      const pluginId = await this.downloadService.resolvePluginId(
        name,
        version,
      );

      if (!pluginId) {
        throw new NotFoundException(`Plugin not found: ${name}@${version}`);
      }

      // Redirect to the ID-based download endpoint
      return this.downloadPlugin(pluginId, response, range);
    } catch (error) {
      this.logger.error(
        `Download failed for ${name}@${version}: ${error.message}`,
      );
      throw error;
    }
  }

  @Get(':id/download/info')
  async getDownloadInfo(@Param('id') pluginId: string) {
    try {
      const info = await this.downloadService.getDownloadInfo(pluginId);

      if (!info) {
        throw new NotFoundException(`Plugin not found: ${pluginId}`);
      }

      return {
        success: true,
        data: {
          id: pluginId,
          filename: info.filename,
          size: info.size,
          checksum: info.checksum,
          lastModified: info.lastModified,
          downloads: info.downloadCount,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get download info for ${pluginId}: ${error.message}`,
      );
      throw error;
    }
  }

  @Get('stats/downloads')
  async getDownloadStats(
    @Query('period') period?: 'day' | 'week' | 'month' | 'year',
    @Query('limit') limit?: number,
  ) {
    try {
      const stats = await this.downloadService.getDownloadStats(
        period ?? 'month',
        limit ?? 50,
      );

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(`Failed to get download stats: ${error.message}`);
      throw error;
    }
  }
}
