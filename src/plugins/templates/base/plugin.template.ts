import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IPlugin, PluginContext, HealthStatus } from '../../../common/interfaces/plugin.interface';

@Injectable()
export abstract class BasePluginTemplate implements IPlugin, OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(this.constructor.name);
  protected context: PluginContext;
  protected eventEmitter: EventEmitter2;

  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly description: string;
  abstract readonly author: string;

  constructor() {}

  async onModuleInit(): Promise<void> {
    this.logger.log(`Plugin ${this.name} initializing...`);
    await this.initialize();
    this.logger.log(`Plugin ${this.name} initialized successfully`);
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log(`Plugin ${this.name} destroying...`);
    await this.destroy();
    this.logger.log(`Plugin ${this.name} destroyed successfully`);
  }

  async initialize(context?: PluginContext): Promise<void> {
    this.context = context;
    await this.onInitialize();
  }

  async destroy(): Promise<void> {
    await this.onDestroy();
  }

  async onHealthCheck(): Promise<HealthStatus> {
    try {
      const customChecks = await this.getHealthChecks();
      return {
        status: 'healthy',
        checks: [
          {
            name: 'plugin-status',
            status: 'pass',
            message: `Plugin ${this.name} is running normally`
          },
          ...customChecks
        ],
        lastCheck: new Date(),
        uptime: process.uptime()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        checks: [
          {
            name: 'plugin-status',
            status: 'fail',
            message: error.message
          }
        ],
        lastCheck: new Date(),
        uptime: process.uptime()
      };
    }
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onDestroy(): Promise<void>;
  protected abstract getHealthChecks(): Promise<Array<{ name: string; status: 'pass' | 'fail' | 'warn'; message: string }>>;
}