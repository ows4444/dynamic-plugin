import { Injectable } from '@nestjs/common';
import { PluginConfig, PluginEventHandler, PluginHook, PluginLogger, PluginService } from '@/shared/decorators/plugin.decorator';
import { PluginServiceInterface } from '@/shared/interfaces/plugin.interface';
import { HealthStatus, HealthStatusType, Logger, MessageType, PluginContext, PluginMetrics, SamplePluginConfig } from '@types';

@Injectable()
@PluginService({ name: 'SampleService', singleton: true })
export class SampleService implements PluginServiceInterface {
  @PluginLogger('SampleService')
  private readonly logger?: Logger;

  @PluginConfig('greeting', 'Hello from Sample Plugin!')
  private readonly greeting: string;

  @PluginConfig('maxItems', 100)
  private readonly maxItems: number;

  private readonly startTime: Date = new Date();
  private readonly dataStore = new Map<string, unknown>();
  private requestCount = 0;
  private errorCount = 0;

  readonly context: PluginContext<SamplePluginConfig>;

  constructor() {
    // Context will be injected by the plugin system
  }

  async initialize(): Promise<void> {
    this.logger?.log('Sample Service initializing...');

    // Simulate initialization work
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.logger?.log('Sample Service initialized successfully');
  }

  async cleanup(): Promise<void> {
    this.logger?.log('Sample Service cleaning up...');

    // Clear data store
    this.dataStore.clear();

    // Simulate async cleanup
    await Promise.resolve();

    this.logger?.log('Sample Service cleaned up successfully');
  }

  @PluginEventHandler('sample.event')
  handleSampleEvent(data: unknown): void {
    this.logger?.log('Handling sample event:', data);

    // Process the event
    this.requestCount++;

    // Emit a response event
    if (this.context.eventBus) {
      this.context.eventBus.publish({
        id: `response-${Date.now()}`,
        type: MessageType.EVENT,
        source: 'sample-plugin',
        eventType: 'sample.data.processed',
        payload: {
          originalData: data,
          processedAt: new Date(),
          requestCount: this.requestCount,
        },
        data: {
          originalData: data,
          processedAt: new Date(),
          requestCount: this.requestCount,
        },
        timestamp: new Date(),
      });
    }
  }

  @PluginEventHandler(['sample.notification', 'system.notification'])
  async handleNotifications(data: unknown): Promise<void> {
    this.logger?.log('Handling notification:', data);

    // Process notifications
    // This could trigger alerts, logs, or other actions
    await Promise.resolve();
  }

  @PluginHook('onInstall')
  async onInstallHook(_context: PluginContext): Promise<void> {
    this.logger?.log('Running install hook');

    // Perform installation-specific tasks
    // e.g., create database tables, set up configurations
    await Promise.resolve();
  }

  @PluginHook('onUninstall')
  async onUninstallHook(_context: PluginContext): Promise<void> {
    this.logger?.log('Running uninstall hook');

    // Perform cleanup tasks
    // e.g., remove database tables, clean up files
    await Promise.resolve();
  }

  getHelloMessage(): string {
    this.requestCount++;
    return this.greeting;
  }

  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  createData(data: unknown): { id: string; data: unknown } {
    try {
      this.requestCount++;

      if (this.dataStore.size >= this.maxItems) {
        throw new Error(`Maximum items limit reached: ${this.maxItems}`);
      }

      const id = `item-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const item = {
        id,
        data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.dataStore.set(id, item);

      // Emit data created event
      if (this.context.eventBus) {
        this.context.eventBus.publish({
          id: `data-created-${Date.now()}`,
          type: MessageType.EVENT,
          source: 'sample-plugin',
          eventType: 'sample.data.created',
          payload: { id, size: this.dataStore.size },
          data: { id, size: this.dataStore.size },
          timestamp: new Date(),
        });
      }

      return { id, data };
    } catch (error) {
      this.errorCount++;
      this.logger?.error('Failed to create data:', error);
      throw error;
    }
  }

  getData(id: string): unknown {
    this.requestCount++;
    return this.dataStore.get(id);
  }

  getAllData(): unknown[] {
    this.requestCount++;
    return Array.from(this.dataStore.values());
  }

  deleteData(id: string): boolean {
    this.requestCount++;
    const deleted = this.dataStore.delete(id);

    if (deleted && this.context.eventBus) {
      this.context.eventBus.publish({
        id: `data-deleted-${Date.now()}`,
        type: MessageType.EVENT,
        source: 'sample-plugin',
        eventType: 'sample.data.deleted',
        payload: { id, size: this.dataStore.size },
        data: { id, size: this.dataStore.size },
        timestamp: new Date(),
      });
    }

    return deleted;
  }

  getMetrics(): PluginMetrics {
    const uptime = this.getUptime();

    return {
      cpu: 0, // Placeholder - would be calculated based on actual CPU usage
      memory: process.memoryUsage().heapUsed,
      requests: this.requestCount,
      errors: this.errorCount,
      uptime,
      executionTime: Date.now() - this.startTime.getTime(),
      // Additional custom metrics
      dataStoreSize: this.dataStore.size,
      maxItems: this.maxItems,
    };
  }

  getHealth(): HealthStatus {
    const metrics = this.getMetrics();
    const isHealthy = this.errorCount < 10 && metrics.uptime > 0;

    return {
      status: isHealthy ? HealthStatusType.HEALTHY : HealthStatusType.UNHEALTHY,
      timestamp: new Date(),
      details: {
        uptime: metrics.uptime,
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        dataStoreSize: this.dataStore.size,
        memoryUsage: metrics.memory,
        cpuUsage: metrics.cpu,
      },
    };
  }
}
