import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface PluginEvent {
  id: string;
  type: string;
  pluginId: string;
  instanceId: string;
  data: any;
  timestamp: Date;
  source: 'plugin' | 'host';
}

export type PluginEventType =
  | 'plugin.loaded'
  | 'plugin.unloaded'
  | 'plugin.started'
  | 'plugin.stopped'
  | 'plugin.error'
  | 'plugin.healthcheck'
  | 'plugin.request'
  | 'plugin.response'
  | 'plugin.custom';

export interface PluginEventHandler {
  (event: PluginEvent): void | Promise<void>;
}

@Injectable()
export class PluginEventsService extends EventEmitter {
  private readonly logger = new Logger(PluginEventsService.name);
  private readonly eventHistory: PluginEvent[] = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  async emitPluginEvent(
    type: PluginEventType,
    pluginId: string,
    instanceId: string,
    data: any = {},
    source: 'plugin' | 'host' = 'host',
  ): Promise<void> {
    const event: PluginEvent = {
      id: this.generateEventId(),
      type,
      pluginId,
      instanceId,
      data,
      timestamp: new Date(),
      source,
    };

    this.addToHistory(event);

    try {
      this.emit(type, event);
      this.emit('*', event);

      this.logger.debug(`Emitted event: ${type} for plugin ${pluginId}`);
      await Promise.resolve();
    } catch (error) {
      this.logger.error(`Failed to emit event ${type}: ${error.message}`);
    }
  }

  onPluginEvent(
    type: PluginEventType | '*',
    handler: PluginEventHandler,
  ): void {
    this.on(type, handler);
  }

  removePluginEventListener(
    type: PluginEventType | '*',
    handler: PluginEventHandler,
  ): void {
    this.removeListener(type, handler);
  }

  async emitPluginLoaded(
    pluginId: string,
    instanceId: string,
    metadata: any,
  ): Promise<void> {
    await this.emitPluginEvent('plugin.loaded', pluginId, instanceId, {
      metadata,
      loadTime: new Date(),
    });
  }

  async emitPluginUnloaded(
    pluginId: string,
    instanceId: string,
  ): Promise<void> {
    await this.emitPluginEvent('plugin.unloaded', pluginId, instanceId, {
      unloadTime: new Date(),
    });
  }

  async emitPluginStarted(pluginId: string, instanceId: string): Promise<void> {
    await this.emitPluginEvent('plugin.started', pluginId, instanceId, {
      startTime: new Date(),
    });
  }

  async emitPluginStopped(
    pluginId: string,
    instanceId: string,
    reason?: string,
  ): Promise<void> {
    await this.emitPluginEvent('plugin.stopped', pluginId, instanceId, {
      stopTime: new Date(),
      reason,
    });
  }

  async emitPluginError(
    pluginId: string,
    instanceId: string,
    error: Error,
    context?: string,
  ): Promise<void> {
    await this.emitPluginEvent('plugin.error', pluginId, instanceId, {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      context,
      errorTime: new Date(),
    });
  }

  async emitPluginHealthCheck(
    pluginId: string,
    instanceId: string,
    healthy: boolean,
    details?: any,
  ): Promise<void> {
    await this.emitPluginEvent('plugin.healthcheck', pluginId, instanceId, {
      healthy,
      details,
      checkTime: new Date(),
    });
  }

  async emitPluginRequest(
    pluginId: string,
    instanceId: string,
    method: string,
    route: string,
    requestId?: string,
  ): Promise<void> {
    await this.emitPluginEvent('plugin.request', pluginId, instanceId, {
      method,
      route,
      requestId,
      requestTime: new Date(),
    });
  }

  async emitPluginResponse(
    pluginId: string,
    instanceId: string,
    method: string,
    route: string,
    statusCode: number,
    responseTime: number,
    requestId?: string,
  ): Promise<void> {
    await this.emitPluginEvent('plugin.response', pluginId, instanceId, {
      method,
      route,
      statusCode,
      responseTime,
      requestId,
      responseTimestamp: new Date(),
    });
  }

  async emitCustomEvent(
    pluginId: string,
    instanceId: string,
    eventName: string,
    data: any,
  ): Promise<void> {
    await this.emitPluginEvent(
      'plugin.custom',
      pluginId,
      instanceId,
      {
        eventName,
        ...data,
      },
      'plugin',
    );
  }

  getEventHistory(
    pluginId?: string,
    instanceId?: string,
    type?: PluginEventType,
    limit = 100,
  ): PluginEvent[] {
    let filtered = [...this.eventHistory];

    if (pluginId) {
      filtered = filtered.filter((event) => event.pluginId === pluginId);
    }

    if (instanceId) {
      filtered = filtered.filter((event) => event.instanceId === instanceId);
    }

    if (type) {
      filtered = filtered.filter((event) => event.type === type);
    }

    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  clearEventHistory(pluginId?: string, instanceId?: string): void {
    if (!pluginId && !instanceId) {
      this.eventHistory.length = 0;
      return;
    }

    for (let i = this.eventHistory.length - 1; i >= 0; i--) {
      const event = this.eventHistory[i];
      if (
        (!pluginId || event.pluginId === pluginId) &&
        (!instanceId || event.instanceId === instanceId)
      ) {
        this.eventHistory.splice(i, 1);
      }
    }
  }

  private addToHistory(event: PluginEvent): void {
    this.eventHistory.push(event);

    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
}
