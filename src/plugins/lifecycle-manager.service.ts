import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PluginEvent, PluginEventType } from '../common/interfaces/plugin.interface';

export interface LifecycleHook {
  id: string;
  pluginId: string;
  event: PluginEventType;
  handler: (event: PluginEvent) => Promise<void>;
  priority: number;
  enabled: boolean;
  async: boolean;
}

export interface LifecycleHookOptions {
  priority?: number;
  enabled?: boolean;
  async?: boolean;
  timeout?: number;
}

export interface HookExecutionResult {
  hookId: string;
  success: boolean;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

export interface LifecyclePhase {
  phase: string;
  hooks: LifecycleHook[];
  results: HookExecutionResult[];
  startTime: Date;
  endTime?: Date;
  success: boolean;
}

@Injectable()
export class LifecycleManagerService {
  private readonly logger = new Logger(LifecycleManagerService.name);
  private readonly hooks = new Map<string, LifecycleHook>();
  private readonly hooksByEvent = new Map<PluginEventType, LifecycleHook[]>();
  private readonly executionHistory = new Map<string, HookExecutionResult[]>();
  private readonly lifecyclePhases = new Map<string, LifecyclePhase>();

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.setupEventListeners();
  }

  registerHook(
    pluginId: string,
    event: PluginEventType,
    handler: (event: PluginEvent) => Promise<void>,
    options: LifecycleHookOptions = {}
  ): string {
    const hookId = `${pluginId}-${event}-${Date.now()}`;
    
    const hook: LifecycleHook = {
      id: hookId,
      pluginId,
      event,
      handler,
      priority: options.priority || 0,
      enabled: options.enabled !== false,
      async: options.async !== false
    };

    this.hooks.set(hookId, hook);
    
    if (!this.hooksByEvent.has(event)) {
      this.hooksByEvent.set(event, []);
    }
    
    const eventHooks = this.hooksByEvent.get(event);
    eventHooks.push(hook);
    
    // Sort by priority (higher priority first)
    eventHooks.sort((a, b) => b.priority - a.priority);
    
    this.logger.log(`Registered lifecycle hook: ${hookId} for event ${event}`);
    return hookId;
  }

  unregisterHook(hookId: string): void {
    const hook = this.hooks.get(hookId);
    if (!hook) {
      this.logger.warn(`Hook not found: ${hookId}`);
      return;
    }

    this.hooks.delete(hookId);
    
    const eventHooks = this.hooksByEvent.get(hook.event);
    if (eventHooks) {
      const index = eventHooks.findIndex(h => h.id === hookId);
      if (index !== -1) {
        eventHooks.splice(index, 1);
      }
    }
    
    this.logger.log(`Unregistered lifecycle hook: ${hookId}`);
  }

  unregisterPluginHooks(pluginId: string): void {
    const hooksToRemove = Array.from(this.hooks.values())
      .filter(hook => hook.pluginId === pluginId);
    
    for (const hook of hooksToRemove) {
      this.unregisterHook(hook.id);
    }
    
    this.logger.log(`Unregistered all hooks for plugin: ${pluginId}`);
  }

  enableHook(hookId: string): void {
    const hook = this.hooks.get(hookId);
    if (hook) {
      hook.enabled = true;
      this.logger.log(`Enabled hook: ${hookId}`);
    }
  }

  disableHook(hookId: string): void {
    const hook = this.hooks.get(hookId);
    if (hook) {
      hook.enabled = false;
      this.logger.log(`Disabled hook: ${hookId}`);
    }
  }

  async executeHooks(event: PluginEvent): Promise<HookExecutionResult[]> {
    const hooks = this.hooksByEvent.get(event.type) || [];
    const enabledHooks = hooks.filter(hook => hook.enabled);
    
    if (enabledHooks.length === 0) {
      return [];
    }

    this.logger.log(`Executing ${enabledHooks.length} hooks for event: ${event.type}`);
    
    const phaseId = `${event.type}-${event.pluginId}-${Date.now()}`;
    const phase: LifecyclePhase = {
      phase: phaseId,
      hooks: enabledHooks,
      results: [],
      startTime: new Date(),
      success: true
    };

    this.lifecyclePhases.set(phaseId, phase);
    
    const results: HookExecutionResult[] = [];
    
    // Execute sync hooks first
    const syncHooks = enabledHooks.filter(hook => !hook.async);
    for (const hook of syncHooks) {
      const result = await this.executeHook(hook, event);
      results.push(result);
      phase.results.push(result);
      
      if (!result.success) {
        phase.success = false;
        this.logger.error(`Hook ${hook.id} failed, stopping execution`);
        break;
      }
    }
    
    // Execute async hooks in parallel
    const asyncHooks = enabledHooks.filter(hook => hook.async);
    if (asyncHooks.length > 0) {
      const asyncResults = await Promise.allSettled(
        asyncHooks.map(hook => this.executeHook(hook, event))
      );
      
      for (const result of asyncResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          phase.results.push(result.value);
          
          if (!result.value.success) {
            phase.success = false;
          }
        } else {
          const errorResult: HookExecutionResult = {
            hookId: 'unknown',
            success: false,
            error: result.reason.message,
            executionTime: 0,
            timestamp: new Date()
          };
          results.push(errorResult);
          phase.results.push(errorResult);
          phase.success = false;
        }
      }
    }
    
    phase.endTime = new Date();
    
    // Store execution history
    for (const result of results) {
      if (!this.executionHistory.has(result.hookId)) {
        this.executionHistory.set(result.hookId, []);
      }
      
      const history = this.executionHistory.get(result.hookId);
      history.push(result);
      
      // Keep only last 100 executions
      if (history.length > 100) {
        history.shift();
      }
    }
    
    this.logger.log(`Executed ${results.length} hooks for event: ${event.type}, success: ${phase.success}`);
    return results;
  }

  getHooksByPlugin(pluginId: string): LifecycleHook[] {
    return Array.from(this.hooks.values())
      .filter(hook => hook.pluginId === pluginId);
  }

  getHooksByEvent(event: PluginEventType): LifecycleHook[] {
    return this.hooksByEvent.get(event) || [];
  }

  getHookExecutionHistory(hookId: string): HookExecutionResult[] {
    return this.executionHistory.get(hookId) || [];
  }

  getLifecyclePhase(phaseId: string): LifecyclePhase | undefined {
    return this.lifecyclePhases.get(phaseId);
  }

  getAllLifecyclePhases(): LifecyclePhase[] {
    return Array.from(this.lifecyclePhases.values());
  }

  async installHook(pluginId: string): Promise<void> {
    this.logger.log(`Installing hooks for plugin: ${pluginId}`);
    
    const installEvent: PluginEvent = {
      type: PluginEventType.STARTING,
      pluginId,
      timestamp: new Date(),
      traceId: `install-${Date.now()}`
    };
    
    await this.executeHooks(installEvent);
  }

  async uninstallHook(pluginId: string): Promise<void> {
    this.logger.log(`Uninstalling hooks for plugin: ${pluginId}`);
    
    const uninstallEvent: PluginEvent = {
      type: PluginEventType.STOPPING,
      pluginId,
      timestamp: new Date(),
      traceId: `uninstall-${Date.now()}`
    };
    
    await this.executeHooks(uninstallEvent);
    this.unregisterPluginHooks(pluginId);
  }

  async updateHook(pluginId: string, oldVersion: string, newVersion: string): Promise<void> {
    this.logger.log(`Updating hooks for plugin: ${pluginId} from ${oldVersion} to ${newVersion}`);
    
    const updateEvent: PluginEvent = {
      type: PluginEventType.LOADING,
      pluginId,
      timestamp: new Date(),
      data: { oldVersion, newVersion },
      traceId: `update-${Date.now()}`
    };
    
    await this.executeHooks(updateEvent);
  }

  async activateHook(pluginId: string): Promise<void> {
    this.logger.log(`Activating hooks for plugin: ${pluginId}`);
    
    const activateEvent: PluginEvent = {
      type: PluginEventType.STARTED,
      pluginId,
      timestamp: new Date(),
      traceId: `activate-${Date.now()}`
    };
    
    await this.executeHooks(activateEvent);
  }

  async deactivateHook(pluginId: string): Promise<void> {
    this.logger.log(`Deactivating hooks for plugin: ${pluginId}`);
    
    const deactivateEvent: PluginEvent = {
      type: PluginEventType.STOPPED,
      pluginId,
      timestamp: new Date(),
      traceId: `deactivate-${Date.now()}`
    };
    
    await this.executeHooks(deactivateEvent);
  }

  private async executeHook(hook: LifecycleHook, event: PluginEvent): Promise<HookExecutionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Executing hook: ${hook.id} for event: ${event.type}`);
      
      await hook.handler(event);
      
      const executionTime = Date.now() - startTime;
      
      return {
        hookId: hook.id,
        success: true,
        executionTime,
        timestamp: new Date()
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error(`Hook ${hook.id} failed:`, error);
      
      return {
        hookId: hook.id,
        success: false,
        error: error.message,
        executionTime,
        timestamp: new Date()
      };
    }
  }

  private setupEventListeners(): void {
    // Listen to all plugin events and execute hooks
    this.eventEmitter.on('plugin.event', async (event: PluginEvent) => {
      try {
        await this.executeHooks(event);
      } catch (error) {
        this.logger.error('Failed to execute hooks for event:', error);
      }
    });

    // Specific event listeners
    this.eventEmitter.on('plugin.loading', async (event: PluginEvent) => {
      await this.executeHooks(event);
    });

    this.eventEmitter.on('plugin.loaded', async (event: PluginEvent) => {
      await this.executeHooks(event);
    });

    this.eventEmitter.on('plugin.starting', async (event: PluginEvent) => {
      await this.executeHooks(event);
    });

    this.eventEmitter.on('plugin.started', async (event: PluginEvent) => {
      await this.executeHooks(event);
    });

    this.eventEmitter.on('plugin.stopping', async (event: PluginEvent) => {
      await this.executeHooks(event);
    });

    this.eventEmitter.on('plugin.stopped', async (event: PluginEvent) => {
      await this.executeHooks(event);
    });

    this.eventEmitter.on('plugin.unloading', async (event: PluginEvent) => {
      await this.executeHooks(event);
    });

    this.eventEmitter.on('plugin.unloaded', async (event: PluginEvent) => {
      await this.executeHooks(event);
    });

    this.eventEmitter.on('plugin.error', async (event: PluginEvent) => {
      await this.executeHooks(event);
    });

    this.eventEmitter.on('plugin.health_check', async (event: PluginEvent) => {
      await this.executeHooks(event);
    });
  }

  async registerPlugin(pluginId: string, plugin: any): Promise<void> {
    this.logger.log(`Registering plugin ${pluginId} with lifecycle manager`);
    
    // Register standard lifecycle hooks for the plugin
    await this.installHook(pluginId);
    await this.activateHook(pluginId);
  }

  async shutdownPlugin(pluginId: string): Promise<void> {
    this.logger.log(`Shutting down plugin ${pluginId} gracefully`);
    
    // Deactivate and uninstall hooks
    await this.deactivateHook(pluginId);
    await this.uninstallHook(pluginId);
  }

  async updatePlugin(pluginId: string, oldVersion: string, newVersion: string): Promise<void> {
    this.logger.log(`Managing lifecycle for plugin ${pluginId} update from ${oldVersion} to ${newVersion}`);
    
    await this.updateHook(pluginId, oldVersion, newVersion);
  }

  async disablePlugin(pluginId: string): Promise<void> {
    this.logger.log(`Disabling plugin ${pluginId}`);
    
    await this.deactivateHook(pluginId);
  }
}