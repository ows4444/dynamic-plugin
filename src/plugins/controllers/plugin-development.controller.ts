import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { PluginDevelopmentService } from '../services/plugin-development.service';
import { PluginDevelopmentMetrics, PluginDevServer, PluginDocumentationConfig, PluginScaffoldConfig, PluginTemplate, PluginTestResult, PluginValidationResult } from '@types';

/**
 * Plugin Development Controller - REST API for plugin development tools
 */
@Controller('plugins/development')
export class PluginDevelopmentController {
  constructor(private readonly pluginDevelopmentService: PluginDevelopmentService) {}

  /**
   * Get available plugin templates
   */
  @Get('templates')
  getTemplates(@Query('category') category?: string): Promise<PluginTemplate[]> {
    try {
      return Promise.resolve(this.pluginDevelopmentService.getAvailableTemplates());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get templates: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Scaffold a new plugin from template
   */
  @Post('scaffold')
  async scaffoldPlugin(@Body() config: PluginScaffoldConfig): Promise<{
    success: boolean;
    pluginPath: string;
    generatedFiles: string[];
    message: string;
  }> {
    try {
      const result = await this.pluginDevelopmentService.scaffoldPlugin(config);
      return {
        success: true,
        pluginPath: result.pluginPath,
        generatedFiles: result.files,
        message: 'Plugin scaffolded successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to scaffold plugin: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Validate a plugin structure and code
   */
  @Post('validate/:pluginId')
  async validatePlugin(@Param('pluginId') pluginId: string): Promise<PluginValidationResult> {
    try {
      return await this.pluginDevelopmentService.validatePlugin(pluginId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to validate plugin: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Run tests for a plugin
   */
  @Post('test/:pluginId')
  testPlugin(@Param('pluginId') pluginId: string, @Body() options?: { coverage?: boolean; watch?: boolean }): Promise<PluginTestResult> {
    try {
      return Promise.resolve(this.pluginDevelopmentService.testPlugin(pluginId, options));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to test plugin: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Generate documentation for a plugin
   */
  @Post('docs/:pluginId')
  async generateDocs(
    @Param('pluginId') pluginId: string,
    @Body() config?: PluginDocumentationConfig,
  ): Promise<{
    success: boolean;
    outputPath: string;
    generatedFiles: string[];
    message: string;
  }> {
    try {
      const result = await this.pluginDevelopmentService.generateDocumentation(pluginId, config ?? {});
      return {
        success: true,
        outputPath: result.outputPath,
        generatedFiles: result.pages,
        message: 'Documentation generated successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to generate documentation: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Start development server for a plugin
   */
  @Post('dev-server/:pluginId')
  startDevServer(@Param('pluginId') pluginId: string, @Body() options?: { port?: number; hotReload?: boolean; watchFiles?: boolean }): Promise<PluginDevServer> {
    try {
      return Promise.resolve(this.pluginDevelopmentService.startDevServer(pluginId, options));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to start development server: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Stop development server for a plugin
   */
  @Delete('dev-server/:pluginId')
  stopDevServer(@Param('pluginId') pluginId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      this.pluginDevelopmentService.stopDevServer(pluginId);
      return Promise.resolve({
        success: true,
        message: 'Development server stopped successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to stop development server: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get development server status
   */
  @Get('dev-server/:pluginId/status')
  getDevServerStatus(@Param('pluginId') pluginId: string): Promise<PluginDevServer | null> {
    try {
      return Promise.resolve(this.pluginDevelopmentService.getDevServerStatus(pluginId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get development server status: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get all active development servers
   */
  @Get('dev-servers')
  getActiveDevServers(): Promise<PluginDevServer[]> {
    try {
      return Promise.resolve(this.pluginDevelopmentService.getActiveDevServers());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get active development servers: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Package a plugin for distribution
   */
  @Post('package/:pluginId')
  packagePlugin(
    @Param('pluginId') pluginId: string,
    @Body()
    options?: {
      outputPath?: string;
      includeTests?: boolean;
      includeDocs?: boolean;
      compress?: boolean;
    },
  ): Promise<{
    success: boolean;
    packagePath: string;
    size: number;
    checksum: string;
    message: string;
  }> {
    try {
      const result = this.pluginDevelopmentService.packagePlugin(pluginId, options);

      return Promise.resolve({
        success: true,
        packagePath: result.packagePath,
        size: result.size,
        checksum: result.checksum,
        message: 'Plugin packaged successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to package plugin: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Lint plugin code
   */
  @Post('lint/:pluginId')
  lintPlugin(
    @Param('pluginId') pluginId: string,
    @Body() options?: { fix?: boolean; strict?: boolean },
  ): Promise<{
    success: boolean;
    errors: Array<{ file: string; line: number; message: string; severity: string }>;
    warnings: Array<{ file: string; line: number; message: string; severity: string }>;
    fixedIssues?: number;
  }> {
    try {
      return this.pluginDevelopmentService.lintPlugin(pluginId, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to lint plugin: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get development metrics
   */
  @Get('metrics')
  async getDevelopmentMetrics(): Promise<PluginDevelopmentMetrics> {
    try {
      return this.pluginDevelopmentService.getDevelopmentMetrics();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get development metrics: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Generate plugin components (controllers, services, etc.)
   */
  @Post('generate/:pluginId/:type')
  generateComponent(
    @Param('pluginId') pluginId: string,
    @Param('type') type: 'controller' | 'service' | 'module' | 'entity' | 'repository' | 'guard' | 'pipe' | 'filter' | 'interceptor' | 'decorator',
    @Body()
    options: {
      name: string;
      path?: string;
      template?: string;
      addToModule?: boolean;
      addTests?: boolean;
    },
  ): Promise<{
    success: boolean;
    generatedFiles: string[];
    message: string;
  }> {
    try {
      const result = this.pluginDevelopmentService.generateComponent(pluginId, type, options);
      return Promise.resolve({
        success: true,
        generatedFiles: result.generatedFiles,
        message: `${type} generated successfully`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to generate ${type}: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
