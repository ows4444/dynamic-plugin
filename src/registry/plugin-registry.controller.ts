import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Put, 
  Param, 
  Body, 
  Query, 
  UseInterceptors, 
  UploadedFile,
  Logger,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiQuery,
  ApiBody,
  ApiConsumes,
  ApiBearerAuth,
  ApiSecurity
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginManagerService } from '../plugins/plugin-manager.service';
import { PluginSearchQuery, PublishPluginDto } from './registry.interfaces';

@ApiTags('plugin-registry')
@Controller('registry')
@ApiBearerAuth('JWT-auth')
export class PluginRegistryController {
  private readonly logger = new Logger(PluginRegistryController.name);

  constructor(
    private readonly registryService: PluginRegistryService,
    private readonly pluginManager: PluginManagerService
  ) {}

  @Get('search')
  async searchPlugins(@Query() query: PluginSearchQuery) {
    try {
      this.logger.log(`Searching plugins: ${JSON.stringify(query)}`);
      const results = await this.registryService.searchPlugins(query);
      
      return {
        success: true,
        data: results,
        total: results.length,
        query
      };
    } catch (error) {
      this.logger.error('Failed to search plugins:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to search plugins',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('plugins')
  async getAllPlugins(@Query() query: PluginSearchQuery) {
    try {
      const results = await this.registryService.searchPlugins({
        limit: query.limit || 50,
        offset: query.offset || 0,
        ...query
      });
      
      return {
        success: true,
        data: results,
        total: results.length
      };
    } catch (error) {
      this.logger.error('Failed to get plugins:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get plugins',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('plugins/:pluginId')
  async getPluginInfo(@Param('pluginId') pluginId: string) {
    try {
      this.logger.log(`Getting plugin info: ${pluginId}`);
      const pluginInfo = await this.registryService.getPluginInfo(pluginId);
      
      if (!pluginInfo) {
        throw new HttpException(
          {
            success: false,
            message: 'Plugin not found',
            pluginId
          },
          HttpStatus.NOT_FOUND
        );
      }
      
      return {
        success: true,
        data: pluginInfo
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Failed to get plugin info for ${pluginId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get plugin info',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('plugins/:pluginId/install')
  async installPlugin(
    @Param('pluginId') pluginId: string,
    @Body() body: { version?: string }
  ) {
    try {
      this.logger.log(`Installing plugin: ${pluginId}`);
      
      // Check if plugin is already installed
      const existingPlugin = this.pluginManager.getPlugin(pluginId);
      if (existingPlugin) {
        throw new HttpException(
          {
            success: false,
            message: 'Plugin already installed',
            pluginId
          },
          HttpStatus.CONFLICT
        );
      }
      
      // Install from registry
      await this.registryService.installPlugin(pluginId, body.version);
      
      // Load the plugin
      const metadata = await this.pluginManager.loadPlugin(pluginId);
      
      return {
        success: true,
        message: 'Plugin installed successfully',
        data: metadata
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Failed to install plugin ${pluginId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to install plugin',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('plugins/:pluginId/uninstall')
  async uninstallPlugin(@Param('pluginId') pluginId: string) {
    try {
      this.logger.log(`Uninstalling plugin: ${pluginId}`);
      
      // Unload the plugin first
      const plugin = this.pluginManager.getPlugin(pluginId);
      if (plugin) {
        await this.pluginManager.unloadPlugin(pluginId);
      }
      
      // Remove from filesystem
      await this.registryService.uninstallPlugin(pluginId);
      
      return {
        success: true,
        message: 'Plugin uninstalled successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to uninstall plugin ${pluginId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to uninstall plugin',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('plugins/:pluginId/update')
  async updatePlugin(
    @Param('pluginId') pluginId: string,
    @Body() body: { version?: string }
  ) {
    try {
      this.logger.log(`Updating plugin: ${pluginId}`);
      
      // Unload current version
      const plugin = this.pluginManager.getPlugin(pluginId);
      if (plugin) {
        await this.pluginManager.unloadPlugin(pluginId);
      }
      
      // Update via registry
      await this.registryService.updatePlugin(pluginId, body.version);
      
      // Load updated version
      const metadata = await this.pluginManager.loadPlugin(pluginId);
      
      return {
        success: true,
        message: 'Plugin updated successfully',
        data: metadata
      };
    } catch (error) {
      this.logger.error(`Failed to update plugin ${pluginId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to update plugin',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('publish')
  @UseInterceptors(FileInterceptor('plugin'))
  async publishPlugin(
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: PublishPluginDto
  ) {
    try {
      this.logger.log(`Publishing plugin: ${metadata.name}`);
      
      if (!file) {
        throw new HttpException(
          {
            success: false,
            message: 'Plugin file is required'
          },
          HttpStatus.BAD_REQUEST
        );
      }
      
      // Save uploaded file temporarily
      const fs = require('fs-extra');
      const path = require('path');
      const tempDir = path.join(process.cwd(), 'temp', 'uploads');
      await fs.ensureDir(tempDir);
      
      const tempFile = path.join(tempDir, file.originalname);
      await fs.writeFile(tempFile, file.buffer);
      
      // Extract plugin
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(tempFile);
      const extractPath = path.join(tempDir, `extracted-${Date.now()}`);
      zip.extractAllTo(extractPath, true);
      
      // Publish to registry
      const entry = await this.registryService.publishPlugin(extractPath, metadata);
      
      // Clean up temp files
      await fs.remove(tempFile);
      await fs.remove(extractPath);
      
      return {
        success: true,
        message: 'Plugin published successfully',
        data: entry
      };
    } catch (error) {
      this.logger.error('Failed to publish plugin:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to publish plugin',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('plugins/:pluginId')
  async unpublishPlugin(@Param('pluginId') pluginId: string) {
    try {
      this.logger.log(`Unpublishing plugin: ${pluginId}`);
      
      await this.registryService.unpublishPlugin(pluginId);
      
      return {
        success: true,
        message: 'Plugin unpublished successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to unpublish plugin ${pluginId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to unpublish plugin',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('plugins/:pluginId/download')
  async downloadPlugin(
    @Param('pluginId') pluginId: string,
    @Query('version') version?: string
  ) {
    try {
      this.logger.log(`Downloading plugin: ${pluginId}${version ? `@${version}` : ''}`);
      
      const filePath = await this.registryService.downloadPlugin(pluginId, version);
      
      return {
        success: true,
        message: 'Plugin downloaded successfully',
        downloadPath: filePath
      };
    } catch (error) {
      this.logger.error(`Failed to download plugin ${pluginId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to download plugin',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('stats')
  async getRegistryStats() {
    try {
      // This would typically come from a database
      const stats = {
        totalPlugins: 0,
        totalDownloads: 0,
        totalPublishers: 0,
        recentPlugins: [],
        popularPlugins: [],
        categories: {}
      };
      
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      this.logger.error('Failed to get registry stats:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get registry stats',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}