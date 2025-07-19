import { Injectable } from '@nestjs/common';
import { PluginConfig, PluginEventHandler, PluginHook, PluginLogger, PluginService } from '@/shared/decorators/plugin.decorator';
import { PluginServiceInterface } from '@/shared/interfaces/plugin.interface';
import { PluginContext } from '@/types/plugin.types';

@Injectable()
@PluginService({
  name: 'SampleService',
  singleton: true,
})
export class SampleService implements PluginServiceInterface {
  @PluginLogger('SampleService')
  private readonly logger: any;

  @PluginConfig('greeting', 'Hello from Sample Plugin!')
  private readonly greeting: string;

  @PluginConfig('maxItems', 100)
  private readonly maxItems: number;

  private readonly startTime: Date = new Date();
  private readonly dataStore = new Map<string, any>();
  private requestCount = 0;
  private errorCount = 0;

  readonly context: PluginContext;

  constructor() {
    // Context will be injected by the plugin system
    this.context = {} as PluginContext;
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

    this.logger?.log('Sample Service cleaned up successfully');
  }

  @PluginEventHandler('sample.event')
  async handleSampleEvent(data: any): Promise<void> {
    this.logger?.log('Handling sample event:', data);

    // Process the event
    this.requestCount++;

    // Emit a response event
    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: `response-${Date.now()}`,
        type: 'sample.event.processed',
        source: 'sample-plugin',
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
  async handleNotifications(data: any): Promise<void> {
    this.logger?.log('Handling notification:', data);

    // Process notifications
    // This could trigger alerts, logs, or other actions
  }

  @PluginHook('onInstall')
  async onInstallHook(context: PluginContext): Promise<void> {
    this.logger?.log('Running install hook');

    // Perform installation-specific tasks
    // e.g., create database tables, set up configurations
  }

  @PluginHook('onUninstall')
  async onUninstallHook(context: PluginContext): Promise<void> {
    this.logger?.log('Running uninstall hook');

    // Perform cleanup tasks
    // e.g., remove database tables, clean up files
  }

  async getHelloMessage(): Promise<string> {
    this.requestCount++;
    return this.greeting;
  }

  async getUptime(): Promise<number> {
    return Date.now() - this.startTime.getTime();
  }

  async createData(data: any): Promise<{ id: string; data: any }> {
    try {
      this.requestCount++;

      if (this.dataStore.size >= this.maxItems) {
        throw new Error(`Maximum items limit reached: ${this.maxItems}`);
      }

      const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const item = {
        id,
        data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.dataStore.set(id, item);

      // Emit data created event
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: `data-created-${Date.now()}`,
          type: 'sample.data.created',
          source: 'sample-plugin',
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

  async getData(id: string): Promise<any> {
    this.requestCount++;
    return this.dataStore.get(id);
  }

  async getAllData(): Promise<any[]> {
    this.requestCount++;
    return Array.from(this.dataStore.values());
  }

  async deleteData(id: string): Promise<boolean> {
    this.requestCount++;
    const deleted = this.dataStore.delete(id);

    if (deleted && this.context.eventBus) {
      await this.context.eventBus.publish({
        id: `data-deleted-${Date.now()}`,
        type: 'sample.data.deleted',
        source: 'sample-plugin',
        data: { id, size: this.dataStore.size },
        timestamp: new Date(),
      });
    }

    return deleted;
  }

  async getMetrics(): Promise<any> {
    const uptime = this.getUptime();

    return {
      uptime,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      dataStoreSize: this.dataStore.size,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date(),
      configuration: {
        greeting: this.greeting,
        maxItems: this.maxItems,
      },
    };
  }

  async getHealth(): Promise<any> {
    const metrics = await this.getMetrics();
    const isHealthy = this.errorCount < 10 && metrics.uptime > 0;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      details: {
        uptime: metrics.uptime,
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        dataStoreSize: this.dataStore.size,
      },
    };
  }
}
