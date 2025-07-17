import { Controller, All, Req, Res, Next, Logger, Param } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DynamicRouteService } from './dynamic-route.service';
import { PluginManagerService } from './plugin-manager.service';

@Controller('plugin')
export class DynamicRouteController {
  private readonly logger = new Logger(DynamicRouteController.name);

  constructor(
    private readonly dynamicRouteService: DynamicRouteService,
    private readonly pluginManager: PluginManagerService
  ) {}

  @All(':pluginId/*')
  async handleDynamicRoute(
    @Param('pluginId') pluginId: string,
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction
  ) {
    this.logger.log(`Handling dynamic route for plugin: ${pluginId}, path: ${req.path}`);

    try {
      const plugin = this.pluginManager.getPlugin(pluginId);
      if (!plugin) {
        return res.status(404).json({
          error: 'Plugin not found',
          pluginId,
          path: req.path
        });
      }

      const metadata = this.pluginManager.getPluginMetadata(pluginId);
      if (metadata.status !== 'active') {
        return res.status(503).json({
          error: 'Plugin is not active',
          pluginId,
          status: metadata.status
        });
      }

      await this.dynamicRouteService.handlePluginRoute(pluginId, req, res, next);
    } catch (error) {
      this.logger.error(`Error handling dynamic route for plugin ${pluginId}:`, error);
      return res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        pluginId
      });
    }
  }
}