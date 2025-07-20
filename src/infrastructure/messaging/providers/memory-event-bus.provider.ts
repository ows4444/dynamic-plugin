import { Injectable, Logger } from '@nestjs/common';
import type { EventBusProvider, EventMessage, EventSubscription } from '../event-bus.service';

/**
 * In-memory event bus provider for single-instance deployments
 */
@Injectable()
export class MemoryEventBusProvider implements EventBusProvider {
  private readonly logger = new Logger(MemoryEventBusProvider.name);
  private readonly subscriptions = new Map<string, EventSubscription>();
  private readonly patternSubscriptions = new Map<string, string[]>(); // pattern -> subscription IDs
  private publishedEvents = 0;
  private processedEvents = 0;

  /**
   * Initialize the memory event bus
   */
  initialize(): void {
    this.logger.log('Memory event bus initialized');
  }

  /**
   * Publish event to all matching subscribers
   */
  async publish<T>(event: EventMessage<T>): Promise<void> {
    try {
      this.publishedEvents++;

      // Find matching subscriptions
      const matchingSubscriptions = this.findMatchingSubscriptions(event.type);

      if (matchingSubscriptions.length === 0) {
        this.logger.debug(`No subscribers for event type: ${event.type}`);
        return;
      }

      // Deliver to all matching subscriptions
      const deliveryPromises = matchingSubscriptions.map((subscription) => {
        try {
          // Apply filter if provided
          if (subscription.options.filter && !subscription.options.filter(event)) {
            return;
          }

          this.processedEvents++;

          // Use a service method to handle the event (would be injected in real implementation)
          // For now, we'll call the handler directly
          void subscription.handler(event);
        } catch (error) {
          this.logger.error(`Handler failed for subscription ${subscription.id}:`, error);
        }
      });

      await Promise.allSettled(deliveryPromises);
    } catch (error) {
      this.logger.error('Failed to publish event:', error);
      throw error;
    }
  }

  /**
   * Subscribe to events matching a pattern
   */
  subscribe(pattern: string, subscription: EventSubscription): void {
    try {
      // Store subscription
      this.subscriptions.set(subscription.id, subscription);

      // Add to pattern mapping
      if (!this.patternSubscriptions.has(pattern)) {
        this.patternSubscriptions.set(pattern, []);
      }
      this.patternSubscriptions.get(pattern)!.push(subscription.id);

      this.logger.debug(`Added subscription ${subscription.id} for pattern: ${pattern}`);
    } catch (error) {
      this.logger.error('Failed to add subscription:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): void {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        this.logger.warn(`Subscription not found: ${subscriptionId}`);
        return;
      }

      // Remove from subscriptions
      this.subscriptions.delete(subscriptionId);

      // Remove from pattern mappings
      for (const [pattern, subscriptionIds] of this.patternSubscriptions.entries()) {
        const index = subscriptionIds.indexOf(subscriptionId);
        if (index !== -1) {
          subscriptionIds.splice(index, 1);

          // Clean up empty patterns
          if (subscriptionIds.length === 0) {
            this.patternSubscriptions.delete(pattern);
          }
          break;
        }
      }

      this.logger.debug(`Removed subscription: ${subscriptionId}`);
    } catch (error) {
      this.logger.error('Failed to remove subscription:', error);
      throw error;
    }
  }

  /**
   * Get provider statistics
   */
  getStatistics(): Record<string, any> {
    return {
      type: 'memory',
      totalSubscriptions: this.subscriptions.size,
      totalPatterns: this.patternSubscriptions.size,
      publishedEvents: this.publishedEvents,
      processedEvents: this.processedEvents,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.subscriptions.clear();
    this.patternSubscriptions.clear();
    this.publishedEvents = 0;
    this.processedEvents = 0;
    this.logger.log('Memory event bus cleaned up');
  }

  /**
   * Find subscriptions matching an event type
   */
  private findMatchingSubscriptions(eventType: string): EventSubscription[] {
    const matchingSubscriptions: EventSubscription[] = [];

    for (const [pattern, subscriptionIds] of this.patternSubscriptions.entries()) {
      if (this.matchesPattern(eventType, pattern)) {
        for (const subscriptionId of subscriptionIds) {
          const subscription = this.subscriptions.get(subscriptionId);
          if (subscription) {
            matchingSubscriptions.push(subscription);
          }
        }
      }
    }

    return matchingSubscriptions;
  }

  /**
   * Check if event type matches subscription pattern
   */
  private matchesPattern(eventType: string, pattern: string): boolean {
    // Simple pattern matching - could be enhanced with more sophisticated patterns

    // Exact match
    if (pattern === eventType) {
      return true;
    }

    // Wildcard patterns
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(eventType);
    }

    // Prefix matching (pattern ends with '.')
    if (pattern.endsWith('.')) {
      return eventType.startsWith(pattern);
    }

    return false;
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    // Estimate subscription memory usage
    for (const subscription of this.subscriptions.values()) {
      totalSize +=
        JSON.stringify({
          id: subscription.id,
          pattern: subscription.pattern,
          options: subscription.options,
        }).length * 2; // Unicode characters are 2 bytes
    }

    // Add pattern mapping overhead
    for (const [pattern, subscriptionIds] of this.patternSubscriptions.entries()) {
      totalSize += pattern.length * 2;
      totalSize += subscriptionIds.length * 50; // Estimate per ID
    }

    return totalSize;
  }

  /**
   * Get all active subscriptions (for debugging)
   */
  getActiveSubscriptions(): Array<{ id: string; pattern: string }> {
    const result: Array<{ id: string; pattern: string }> = [];

    for (const [pattern, subscriptionIds] of this.patternSubscriptions.entries()) {
      for (const subscriptionId of subscriptionIds) {
        result.push({ id: subscriptionId, pattern });
      }
    }

    return result;
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.publishedEvents = 0;
    this.processedEvents = 0;
  }
}
