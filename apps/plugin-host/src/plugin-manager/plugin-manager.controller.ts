import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PluginManagerService, Plugin } from './plugin-manager.service';

@Controller('plugins')
export class PluginManagerController {
  constructor(private readonly pluginManager: PluginManagerService) {}

  @Get()
  getPlugins(): Plugin[] {
    return this.pluginManager.getPlugins();
  }

  @Get(':id')
  getPlugin(@Param('id') id: string): Plugin {
    const plugin = this.pluginManager.getPlugin(id);
    if (!plugin) {
      throw new Error('Plugin not found');
    }
    return plugin;
  }

  @Post('install')
  async installPlugin(@Body('package') packagePath: string): Promise<Plugin> {
    return this.pluginManager.installPlugin(packagePath);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async uninstallPlugin(@Param('id') id: string): Promise<void> {
    return this.pluginManager.uninstallPlugin(id);
  }

  @Post(':id/start')
  async startPlugin(@Param('id') id: string): Promise<void> {
    return this.pluginManager.startPlugin(id);
  }

  @Post(':id/stop')
  async stopPlugin(@Param('id') id: string): Promise<void> {
    return this.pluginManager.stopPlugin(id);
  }
}
