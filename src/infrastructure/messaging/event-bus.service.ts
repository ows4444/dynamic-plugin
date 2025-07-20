import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { MemoryEventBusProvider } from './providers/memory-event-bus.provider';
import { RedisEventBusProvider } from './providers/redis-event-bus.provider';

/**
 * Event bus service providing publish/subscribe messaging capabilities
 * Supports both local and distributed event handling
 */
@Injectable()
export class EventBusService implements OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private readonly subscriptions = new Map<string, EventSubscription[]>();
  private readonly providers = new Map<string, EventBusProvider>();
  private currentProvider: EventBusProvider;

  constructor(
    private readonly memoryProvider: MemoryEventBusProvider,
    private readonly redisProvider: RedisEventBusProvider,
  ) {
    this.registerProviders();
    void this.initializeProvider();
  }

  /**
   * Register available event bus providers
   */
  private registerProviders(): void {
    this.providers.set('memory', this.memoryProvider);
    this.providers.set('redis', this.redisProvider);
  }

  /**
   * Initialize the event bus provider
   */
  private async initializeProvider(): Promise<void> {
    const providerName = process.env.EVENT_BUS_PROVIDER ?? 'memory';
    const provider = this.providers.get(providerName);

    if (!provider) {
      this.logger.warn(`Unknown event bus provider: ${providerName}, falling back to memory`);
      this.currentProvider = this.memoryProvider;
    } else {
      this.currentProvider = provider;
    }

    await this.currentProvider.initialize();
    this.logger.log(`Event bus initialized with provider: ${providerName}`);
  }

  /**
   * Publish an event to all subscribers
   */
  async publish<T = any>(event: EventMessage<T>): Promise<void> {
    try {
      // Add metadata
      const enrichedEvent = this.enrichEvent(event);

      // Publish through current provider
      await this.currentProvider.publish(enrichedEvent);

      // Emit metrics
      this.emitMetrics('event.published', {
        eventType: event.type,
        correlationId: enrichedEvent.correlationId,
      });

      this.logger.debug(`Published event: ${event.type}`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to events matching a pattern
   */
  async subscribe<T = any>(pattern: string, handler: EventHandler<T>, options: SubscriptionOptions = {}): Promise<string> {
    try {
      const subscription: EventSubscription = {
        id: this.generateSubscriptionId(),
        pattern,
        handler: handler as EventHandler<any>,
        options,
        createdAt: new Date(),
        messageCount: 0,
        lastMessage: undefined,
      };

      // Subscribe through current provider
      await this.currentProvider.subscribe(pattern, subscription);

      // Track subscription locally
      if (!this.subscriptions.has(pattern)) {
        this.subscriptions.set(pattern, []);
      }
      this.subscriptions.get(pattern)!.push(subscription);

      this.logger.debug(`Created subscription: ${subscription.id} for pattern: ${pattern}`);
      return subscription.id;
    } catch (error) {
      this.logger.error(`Failed to create subscription for pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    try {
      // Find and remove subscription
      for (const [pattern, subscriptions] of this.subscriptions.entries()) {
        const index = subscriptions.findIndex((sub) => sub.id === subscriptionId);
        if (index !== -1) {
          const subscription = subscriptions[index];
          subscriptions.splice(index, 1);

          // Remove from provider
          await this.currentProvider.unsubscribe(subscriptionId);

          // Clean up empty pattern arrays
          if (subscriptions.length === 0) {
            this.subscriptions.delete(pattern);
          }

          this.logger.debug(`Removed subscription: ${subscriptionId}`);
          return;
        }
      }

      this.logger.warn(`Subscription not found: ${subscriptionId}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): SubscriptionInfo[] {
    const result: SubscriptionInfo[] = [];

    for (const [pattern, subscriptions] of this.subscriptions.entries()) {
      for (const subscription of subscriptions) {
        result.push({
          id: subscription.id,
          pattern,
          createdAt: subscription.createdAt,
          messageCount: subscription.messageCount,
          lastMessage: subscription.lastMessage,
          options: subscription.options,
        });
      }
    }

    return result;
  }

  /**
   * Get event bus statistics
   */
  getStatistics(): EventBusStatistics {
    const providerStats = this.currentProvider.getStatistics();

    return {
      provider: this.currentProvider.constructor.name,
      totalSubscriptions: this.getTotalSubscriptions(),
      subscriptionsByPattern: this.getSubscriptionsByPattern(),
      ...providerStats,
    };
  }

  /**
   * Handle incoming events (called by providers)
   */
  async handleEvent<T>(event: EventMessage<T>, subscription: EventSubscription): Promise<void> {
    try {
      // Update subscription stats
      subscription.messageCount++;
      subscription.lastMessage = new Date();

      // Execute handler with error handling
      if (subscription.options.async !== false) {
        // Async execution (fire and forget)
        this.executeHandler(event, subscription).catch((error) => {
          this.logger.error(`Async handler failed for ${event.type}:`, error);
        });
      } else {
        // Sync execution
        await this.executeHandler(event, subscription);
      }
    } catch (error) {
      this.logger.error(`Event handling failed for ${event.type}:`, error);

      // Emit error event
      this.emitMetrics('event.handler.error', {
        eventType: event.type,
        subscriptionId: subscription.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clean up resources
   */
  async onModuleDestroy(): Promise<void> {
    try {
      this.logger.log('Shutting down event bus...');

      // Unsubscribe all
      const unsubscribePromises = Array.from(this.subscriptions.values())
        .flat()
        .map((sub) => this.unsubscribe(sub.id));

      await Promise.allSettled(unsubscribePromises);

      // Cleanup provider
      await this.currentProvider.cleanup();

      this.logger.log('Event bus shutdown complete');
    } catch (error) {
      this.logger.error('Error during event bus shutdown:', error);
    }
  }

  /**
   * Execute event handler with retries and timeout
   */
  private async executeHandler<T>(event: EventMessage<T>, subscription: EventSubscription): Promise<void> {
    const maxRetries = subscription.options.maxRetries ?? 3;
    const timeout = subscription.options.timeout ?? 30000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Execute with timeout
        // eslint-disable-next-line no-await-in-loop
        await this.executeWithTimeout(async () => subscription.handler(event), timeout);

        // Success - break retry loop
        break;
      } catch (error) {
        this.logger.error(`Handler attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt === maxRetries) {
          throw error; // Final attempt failed
        }

        // Wait before retry
        if (subscription.options.retryDelay) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, subscription.options.retryDelay));
        }
      }
    }
  }

  /**
   * Execute function with timeout
   */
  private executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([fn(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Handler timeout after ${timeoutMs}ms`)), timeoutMs))]);
  }

  /**
   * Enrich event with metadata
   */
  private enrichEvent<T>(event: EventMessage<T>): EventMessage<T> {
    return {
      ...event,
      id: event.id ?? this.generateEventId(),
      timestamp: event.timestamp ?? new Date(),
      correlationId: event.correlationId ?? this.generateCorrelationId(),
      version: event.version ?? '1.0',
    };
  }

  /**
   * Emit internal metrics
   */
  private emitMetrics(type: string, data: any): void {
    // In a real implementation, this would emit to a metrics system
    this.logger.debug(`Metrics: ${type}`, data);
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `cor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get total subscription count
   */
  private getTotalSubscriptions(): number {
    return Array.from(this.subscriptions.values()).reduce((total, subs) => total + subs.length, 0);
  }

  /**
   * Get subscriptions grouped by pattern
   */
  private getSubscriptionsByPattern(): Record<string, number> {
    const result: Record<string, number> = {};

    for (const [pattern, subscriptions] of this.subscriptions.entries()) {
      result[pattern] = subscriptions.length;
    }

    return result;
  }
}

export interface EventMessage<T = any> {
  id?: string;
  type: string;
  data: T;
  timestamp?: Date;
  correlationId?: string;
  causationId?: string;
  version?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export type EventHandler<T = any> = (event: EventMessage<T>) => Promise<void> | void;

export interface SubscriptionOptions {
  async?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  filter?: (event: EventMessage) => boolean;
}

export interface EventSubscription {
  id: string;
  pattern: string;
  handler: EventHandler;
  options: SubscriptionOptions;
  createdAt: Date;
  messageCount: number;
  lastMessage?: Date;
}

export interface SubscriptionInfo {
  id: string;
  pattern: string;
  createdAt: Date;
  messageCount: number;
  lastMessage?: Date;
  options: SubscriptionOptions;
}

export interface EventBusStatistics {
  provider: string;
  totalSubscriptions: number;
  subscriptionsByPattern: Record<string, number>;
  [key: string]: any;
}

export interface EventBusProvider {
  initialize(): Promise<void> | void;
  publish<T>(event: EventMessage<T>): Promise<void> | void;
  subscribe(pattern: string, subscription: EventSubscription): Promise<void> | void;
  unsubscribe(subscriptionId: string): Promise<void> | void;
  getStatistics(): Record<string, any>;
  cleanup(): Promise<void> | void;
}
