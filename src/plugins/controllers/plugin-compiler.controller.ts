import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { PluginCompilerService } from '../services/plugin-compiler.service';
import { CompilationCache, CompilationOptions, CompilationResult, PluginCompileRequest } from '@types';

/**
 * Plugin Compiler Controller - REST API for plugin compilation functionality
 */
@Controller('plugins/compiler')
export class PluginCompilerController {
  constructor(private readonly pluginCompilerService: PluginCompilerService) {}

  /**
   * Compile a plugin from source
   */
  @Post('compile')
  async compilePlugin(@Body() request: PluginCompileRequest): Promise<CompilationResult> {
    try {
      return await this.pluginCompilerService.compilePlugin(request);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to compile plugin: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Compile multiple plugins in batch
   */
  @Post('compile/batch')
  async compilePlugins(@Body() requests: PluginCompileRequest[]): Promise<CompilationResult[]> {
    try {
      return await this.pluginCompilerService.compileMultiplePlugins(requests);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to compile plugins in batch: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Start watching a plugin for changes and auto-compile
   */
  @Post('watch/:pluginId')
  async startWatching(@Param('pluginId') pluginId: string, @Body() options?: CompilationOptions): Promise<{ success: boolean; watcherId: string; message: string }> {
    try {
      const watcherId = await this.pluginCompilerService.startWatching(pluginId, options || {});
      return {
        success: true,
        watcherId,
        message: 'Started watching plugin for changes',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to start watching plugin: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Stop watching a plugin
   */
  @Delete('watch/:watcherId')
  stopWatching(@Param('watcherId') watcherId: string): { success: boolean; message: string } {
    try {
      this.pluginCompilerService.stopWatching(watcherId);
      return {
        success: true,
        message: 'Stopped watching plugin',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to stop watching plugin: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get compilation status for a plugin
   */
  @Get('status/:pluginId')
  async getCompilationStatus(@Param('pluginId') pluginId: string): Promise<{
    isCompiling: boolean;
    lastCompilation?: CompilationResult;
    watchingChanges: boolean;
    cacheStatus: 'hit' | 'miss' | 'invalid' | 'none';
  }> {
    try {
      return await this.pluginCompilerService.getCompilationStatus(pluginId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get compilation status: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get compilation cache information
   */
  @Get('cache')
  getCacheInfo(@Query('pluginId') pluginId?: string): CompilationCache[] {
    try {
      return this.pluginCompilerService.getCacheInfo(pluginId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get cache information: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Clear compilation cache
   */
  @Delete('cache')
  async clearCache(@Query('pluginId') pluginId?: string): Promise<{
    success: boolean;
    message: string;
    clearedEntries: number;
  }> {
    try {
      const clearedEntries = await this.pluginCompilerService.clearCache(pluginId);
      return {
        success: true,
        message: pluginId ? `Cache cleared for plugin ${pluginId}` : 'All cache cleared',
        clearedEntries,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to clear cache: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Optimize compiled plugin bundles
   */
  @Post('optimize/:pluginId')
  async optimizePlugin(
    @Param('pluginId') pluginId: string,
    @Body()
    options?: {
      minify?: boolean;
      treeshake?: boolean;
      compress?: boolean;
    },
  ): Promise<CompilationResult> {
    try {
      return await this.pluginCompilerService.optimizePlugin(pluginId, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to optimize plugin: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get compilation diagnostics and errors
   */
  @Get('diagnostics/:pluginId')
  getDiagnostics(@Param('pluginId') pluginId: string): {
    errors: Array<{ message: string; file: string; line: number; column: number }>;
    warnings: Array<{ message: string; file: string; line: number; column: number }>;
    suggestions: string[];
  } {
    try {
      return this.pluginCompilerService.getDiagnostics(pluginId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get diagnostics: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get compiler metrics and performance data
   */
  @Get('metrics')
  getCompilerMetrics(): {
    totalCompilations: number;
    successfulCompilations: number;
    failedCompilations: number;
    averageCompileTime: number;
    cacheHitRate: number;
    activeWatchers: number;
    memoryUsage: number;
  } {
    try {
      return this.pluginCompilerService.getCompilerMetrics();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(`Failed to get compiler metrics: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
