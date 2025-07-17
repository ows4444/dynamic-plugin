import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs-extra';
import { PluginManagerService } from './plugin-manager.service';
import { PluginEventType } from '../common/interfaces/plugin.interface';

export interface HotReloadConfig {
  enabled: boolean;
  watchPaths: string[];
  ignorePatterns: string[];
  debounceMs: number;
  maxRetries: number;
  retryDelayMs: number;
  gracefulShutdownTimeout: number;
}

export interface ReloadStrategy {
  type: 'full' | 'incremental' | 'selective';
  preserveState: boolean;
  backupBeforeReload: boolean;
  rollbackOnFailure: boolean;
}

export interface ReloadEvent {
  pluginId: string;
  filePath: string;
  changeType: 'add' | 'change' | 'unlink';
  timestamp: Date;
  strategy: ReloadStrategy;
  success: boolean;
  error?: string;
  duration: number;
}

export interface PluginState {
  pluginId: string;
  state: any;
  timestamp: Date;
  version: string;
}

@Injectable()
export class HotReloadService {
  private readonly logger = new Logger(HotReloadService.name);
  private readonly watchers = new Map<string, chokidar.FSWatcher>();
  private readonly reloadQueue = new Map<string, NodeJS.Timeout>();
  private readonly pluginStates = new Map<string, PluginState>();
  private readonly reloadHistory = new Map<string, ReloadEvent[]>();
  private readonly config: HotReloadConfig;

  constructor(
    @Inject(forwardRef(() => PluginManagerService))
    private readonly pluginManager: PluginManagerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.config = {
      enabled: true,
      watchPaths: ['./plugins'],
      ignorePatterns: ['node_modules', '.git', '*.log', '*.tmp'],
      debounceMs: 500,
      maxRetries: 3,
      retryDelayMs: 1000,
      gracefulShutdownTimeout: 5000
    };
  }

  async startWatching(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn('Hot reload is disabled');
      return;
    }

    this.logger.log('Starting hot reload monitoring...');

    for (const watchPath of this.config.watchPaths) {
      await this.startWatchingPath(watchPath);
    }

    this.logger.log('Hot reload monitoring started');
  }

  async stopWatching(): Promise<void> {
    this.logger.log('Stopping hot reload monitoring...');

    for (const [path, watcher] of this.watchers) {
      await watcher.close();
      this.logger.log(`Stopped watching: ${path}`);
    }

    this.watchers.clear();

    // Clear pending reloads
    for (const timeout of this.reloadQueue.values()) {
      clearTimeout(timeout);
    }
    this.reloadQueue.clear();

    this.logger.log('Hot reload monitoring stopped');
  }

  async reloadPlugin(
    pluginId: string, 
    strategy: ReloadStrategy = { 
      type: 'full', 
      preserveState: true, 
      backupBeforeReload: true, 
      rollbackOnFailure: true 
    }
  ): Promise<ReloadEvent> {
    const startTime = Date.now();
    const event: ReloadEvent = {
      pluginId,
      filePath: '',
      changeType: 'change',
      timestamp: new Date(),
      strategy,
      success: false,
      duration: 0
    };

    try {
      this.logger.log(`Reloading plugin ${pluginId} with strategy: ${strategy.type}`);

      // Step 1: Preserve state if requested
      if (strategy.preserveState) {
        await this.preservePluginState(pluginId);
      }

      // Step 2: Backup if requested
      if (strategy.backupBeforeReload) {
        await this.backupPlugin(pluginId);
      }

      // Step 3: Perform reload based on strategy
      switch (strategy.type) {
        case 'full':
          await this.performFullReload(pluginId);
          break;
        case 'incremental':
          await this.performIncrementalReload(pluginId);
          break;
        case 'selective':
          await this.performSelectiveReload(pluginId);
          break;
      }

      // Step 4: Restore state if requested
      if (strategy.preserveState) {
        await this.restorePluginState(pluginId);
      }

      event.success = true;
      this.logger.log(`Plugin ${pluginId} reloaded successfully`);

    } catch (error) {
      event.error = error.message;
      this.logger.error(`Failed to reload plugin ${pluginId}:`, error);

      // Rollback on failure
      if (strategy.rollbackOnFailure) {
        await this.rollbackPlugin(pluginId);
      }
    }

    event.duration = Date.now() - startTime;
    this.recordReloadEvent(event);

    return event;
  }

  async reloadAllPlugins(): Promise<ReloadEvent[]> {
    this.logger.log('Reloading all plugins...');

    const plugins = this.pluginManager.getAllPlugins();
    const events: ReloadEvent[] = [];

    for (const plugin of plugins) {
      const event = await this.reloadPlugin(plugin.id);
      events.push(event);
    }

    this.logger.log(`Reloaded ${events.length} plugins`);
    return events;
  }

  getReloadHistory(pluginId?: string): ReloadEvent[] {
    if (pluginId) {
      return this.reloadHistory.get(pluginId) || [];
    }

    const allEvents: ReloadEvent[] = [];
    for (const events of this.reloadHistory.values()) {
      allEvents.push(...events);
    }

    return allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  setReloadStrategy(pluginId: string, strategy: ReloadStrategy): void {
    this.logger.log(`Setting reload strategy for ${pluginId}:`, strategy);
    // Store strategy configuration for the plugin
    // This would typically be stored in a configuration service
  }

  private async startWatchingPath(watchPath: string): Promise<void> {
    if (!await fs.pathExists(watchPath)) {
      this.logger.warn(`Watch path does not exist: ${watchPath}`);
      return;
    }

    const watcher = chokidar.watch(watchPath, {
      persistent: true,
      ignoreInitial: true,
      ignored: this.config.ignorePatterns,
      depth: 5
    });

    watcher.on('add', (filePath) => {
      this.handleFileChange(filePath, 'add');
    });

    watcher.on('change', (filePath) => {
      this.handleFileChange(filePath, 'change');
    });

    watcher.on('unlink', (filePath) => {
      this.handleFileChange(filePath, 'unlink');
    });

    watcher.on('error', (error) => {
      this.logger.error(`Watcher error for ${watchPath}:`, error);
    });

    this.watchers.set(watchPath, watcher);
    this.logger.log(`Started watching: ${watchPath}`);
  }

  private handleFileChange(filePath: string, changeType: 'add' | 'change' | 'unlink'): void {
    const pluginId = this.extractPluginId(filePath);
    if (!pluginId) {
      return;
    }

    this.logger.debug(`File ${changeType}: ${filePath} in plugin ${pluginId}`);

    // Debounce multiple changes
    const existingTimeout = this.reloadQueue.get(pluginId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      this.reloadQueue.delete(pluginId);
      await this.triggerReload(pluginId, filePath, changeType);
    }, this.config.debounceMs);

    this.reloadQueue.set(pluginId, timeout);
  }

  private async triggerReload(pluginId: string, filePath: string, changeType: 'add' | 'change' | 'unlink'): Promise<void> {
    try {
      const strategy = this.determineReloadStrategy(filePath, changeType);
      const event = await this.reloadPlugin(pluginId, strategy);
      event.filePath = filePath;
      event.changeType = changeType;

      // Emit reload event
      this.eventEmitter.emit('plugin.hot-reload', {
        type: PluginEventType.LOADED,
        pluginId,
        timestamp: new Date(),
        data: { event, filePath, changeType }
      });

    } catch (error) {
      this.logger.error(`Failed to trigger reload for ${pluginId}:`, error);
    }
  }

  private determineReloadStrategy(filePath: string, changeType: 'add' | 'change' | 'unlink'): ReloadStrategy {
    const ext = path.extname(filePath);
    
    // Config files typically need full reload
    if (filePath.includes('plugin.manifest.json') || filePath.includes('config')) {
      return {
        type: 'full',
        preserveState: true,
        backupBeforeReload: true,
        rollbackOnFailure: true
      };
    }

    // Code files can often use incremental reload
    if (['.js', '.ts', '.mjs'].includes(ext)) {
      return {
        type: 'incremental',
        preserveState: true,
        backupBeforeReload: false,
        rollbackOnFailure: true
      };
    }

    // Asset files can use selective reload
    if (['.css', '.html', '.json'].includes(ext)) {
      return {
        type: 'selective',
        preserveState: true,
        backupBeforeReload: false,
        rollbackOnFailure: false
      };
    }

    return {
      type: 'full',
      preserveState: true,
      backupBeforeReload: true,
      rollbackOnFailure: true
    };
  }

  private async performFullReload(pluginId: string): Promise<void> {
    this.logger.log(`Performing full reload for plugin: ${pluginId}`);
    
    // Graceful shutdown
    await this.gracefulShutdown(pluginId);
    
    // Reload the plugin
    await this.pluginManager.reloadPlugin(pluginId);
  }

  private async performIncrementalReload(pluginId: string): Promise<void> {
    this.logger.log(`Performing incremental reload for plugin: ${pluginId}`);
    
    // Get current plugin instance
    const plugin = this.pluginManager.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Reload specific components without full restart
    if (plugin.onHotReload) {
      await plugin.onHotReload();
    } else {
      // Fallback to full reload if hot reload is not supported
      await this.performFullReload(pluginId);
    }
  }

  private async performSelectiveReload(pluginId: string): Promise<void> {
    this.logger.log(`Performing selective reload for plugin: ${pluginId}`);
    
    // Reload only specific assets or configurations
    const plugin = this.pluginManager.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (plugin.onAssetReload) {
      await plugin.onAssetReload();
    }
  }

  private async gracefulShutdown(pluginId: string): Promise<void> {
    this.logger.log(`Gracefully shutting down plugin: ${pluginId}`);
    
    const plugin = this.pluginManager.getPlugin(pluginId);
    if (!plugin) {
      return;
    }

    // Give plugin time to complete current operations
    if (plugin.onGracefulShutdown) {
      const shutdownPromise = plugin.onGracefulShutdown();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Graceful shutdown timeout')), this.config.gracefulShutdownTimeout);
      });

      try {
        await Promise.race([shutdownPromise, timeoutPromise]);
      } catch (error) {
        this.logger.warn(`Graceful shutdown failed for ${pluginId}:`, error.message);
      }
    }

    // Unload the plugin
    await this.pluginManager.unloadPlugin(pluginId);
  }

  private async preservePluginState(pluginId: string): Promise<void> {
    const plugin = this.pluginManager.getPlugin(pluginId);
    if (!plugin || !plugin.getState) {
      return;
    }

    const state = await plugin.getState();
    const metadata = this.pluginManager.getPluginMetadata(pluginId);
    
    this.pluginStates.set(pluginId, {
      pluginId,
      state,
      timestamp: new Date(),
      version: metadata?.version || '1.0.0'
    });

    this.logger.log(`Preserved state for plugin: ${pluginId}`);
  }

  private async restorePluginState(pluginId: string): Promise<void> {
    const savedState = this.pluginStates.get(pluginId);
    if (!savedState) {
      return;
    }

    const plugin = this.pluginManager.getPlugin(pluginId);
    if (!plugin || !plugin.setState) {
      return;
    }

    await plugin.setState(savedState.state);
    this.logger.log(`Restored state for plugin: ${pluginId}`);
  }

  private async backupPlugin(pluginId: string): Promise<void> {
    const pluginPath = path.join(process.cwd(), 'plugins', pluginId);
    const backupPath = path.join(process.cwd(), 'plugins', `.${pluginId}-backup-${Date.now()}`);

    if (await fs.pathExists(pluginPath)) {
      await fs.copy(pluginPath, backupPath);
      this.logger.log(`Backed up plugin ${pluginId} to ${backupPath}`);
    }
  }

  private async rollbackPlugin(pluginId: string): Promise<void> {
    this.logger.log(`Rolling back plugin: ${pluginId}`);
    
    const backupDir = path.join(process.cwd(), 'plugins');
    const backupPattern = `.${pluginId}-backup-`;
    
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(file => file.startsWith(backupPattern));
      
      if (backupFiles.length === 0) {
        this.logger.warn(`No backup found for plugin: ${pluginId}`);
        return;
      }

      // Get the most recent backup
      const latestBackup = backupFiles.sort().reverse()[0];
      const backupPath = path.join(backupDir, latestBackup);
      const pluginPath = path.join(backupDir, pluginId);

      // Remove current plugin
      if (await fs.pathExists(pluginPath)) {
        await fs.remove(pluginPath);
      }

      // Restore from backup
      await fs.copy(backupPath, pluginPath);
      
      // Reload the plugin
      await this.pluginManager.reloadPlugin(pluginId);
      
      this.logger.log(`Rolled back plugin ${pluginId} successfully`);
    } catch (error) {
      this.logger.error(`Failed to rollback plugin ${pluginId}:`, error);
    }
  }

  private extractPluginId(filePath: string): string | null {
    const parts = filePath.split(path.sep);
    const pluginsIndex = parts.findIndex(part => part === 'plugins');
    
    if (pluginsIndex !== -1 && pluginsIndex + 1 < parts.length) {
      return parts[pluginsIndex + 1];
    }
    
    return null;
  }

  private recordReloadEvent(event: ReloadEvent): void {
    if (!this.reloadHistory.has(event.pluginId)) {
      this.reloadHistory.set(event.pluginId, []);
    }

    const history = this.reloadHistory.get(event.pluginId);
    history.push(event);

    // Keep only last 50 events
    if (history.length > 50) {
      history.shift();
    }
  }
}