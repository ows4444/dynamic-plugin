import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';

export interface CorrelationContext {
  correlationId: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  pluginId?: string;
  traceId?: string;
  parentRequestId?: string;
  startTime: Date;
  metadata?: Record<string, any>;
}

/**
 * Correlation service for tracking requests and operations across async boundaries
 * Uses AsyncLocalStorage to maintain context throughout the request lifecycle
 */
@Injectable()
export class CorrelationService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

  /**
   * Start a new correlation context
   */
  startContext(options: Partial<CorrelationContext> = {}): string {
    const correlationId = options.correlationId ?? this.generateCorrelationId();

    const context: CorrelationContext = {
      correlationId,
      requestId: options.requestId ?? this.generateRequestId(),
      sessionId: options.sessionId,
      userId: options.userId,
      pluginId: options.pluginId,
      traceId: options.traceId,
      parentRequestId: options.parentRequestId,
      startTime: new Date(),
      metadata: options.metadata ?? {},
    };

    return this.asyncLocalStorage.run(context, () => {
      return correlationId;
    });
  }

  /**
   * Run a function within a correlation context
   */
  runWithContext<T>(context: Partial<CorrelationContext>, fn: () => T): T {
    const fullContext: CorrelationContext = {
      correlationId: context.correlationId ?? this.generateCorrelationId(),
      requestId: context.requestId ?? this.generateRequestId(),
      sessionId: context.sessionId,
      userId: context.userId,
      pluginId: context.pluginId,
      traceId: context.traceId,
      parentRequestId: context.parentRequestId,
      startTime: new Date(),
      metadata: context.metadata ?? {},
    };

    return this.asyncLocalStorage.run(fullContext, fn);
  }

  /**
   * Run a function within the current context, adding additional data
   */
  runWithEnrichedContext<T>(enrichment: Partial<CorrelationContext>, fn: () => T): T {
    const currentContext = this.getCurrentContext();
    if (!currentContext) {
      return this.runWithContext(enrichment, fn);
    }

    const enrichedContext: CorrelationContext = {
      ...currentContext,
      ...enrichment,
      metadata: {
        ...currentContext.metadata,
        ...enrichment.metadata,
      },
    };

    return this.asyncLocalStorage.run(enrichedContext, fn);
  }

  /**
   * Get current correlation context
   */
  getCurrentContext(): CorrelationContext | null {
    return this.asyncLocalStorage.getStore() ?? null;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined {
    const context = this.getCurrentContext();
    return context?.correlationId;
  }

  /**
   * Get current request ID
   */
  getRequestId(): string | undefined {
    const context = this.getCurrentContext();
    return context?.requestId;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    const context = this.getCurrentContext();
    return context?.sessionId;
  }

  /**
   * Get current user ID
   */
  getUserId(): string | undefined {
    const context = this.getCurrentContext();
    return context?.userId;
  }

  /**
   * Get current plugin ID
   */
  getPluginId(): string | undefined {
    const context = this.getCurrentContext();
    return context?.pluginId;
  }

  /**
   * Get current trace ID
   */
  getTraceId(): string | undefined {
    const context = this.getCurrentContext();
    return context?.traceId;
  }

  /**
   * Get context metadata
   */
  getMetadata(): Record<string, any> {
    const context = this.getCurrentContext();
    return context?.metadata ?? {};
  }

  /**
   * Set correlation ID in current context
   */
  setCorrelationId(correlationId: string): void {
    const context = this.getCurrentContext();
    if (context) {
      context.correlationId = correlationId;
    }
  }

  /**
   * Set request ID in current context
   */
  setRequestId(requestId: string): void {
    const context = this.getCurrentContext();
    if (context) {
      context.requestId = requestId;
    }
  }

  /**
   * Set session ID in current context
   */
  setSessionId(sessionId: string): void {
    const context = this.getCurrentContext();
    if (context) {
      context.sessionId = sessionId;
    }
  }

  /**
   * Set user ID in current context
   */
  setUserId(userId: string): void {
    const context = this.getCurrentContext();
    if (context) {
      context.userId = userId;
    }
  }

  /**
   * Set plugin ID in current context
   */
  setPluginId(pluginId: string): void {
    const context = this.getCurrentContext();
    if (context) {
      context.pluginId = pluginId;
    }
  }

  /**
   * Set trace ID in current context
   */
  setTraceId(traceId: string): void {
    const context = this.getCurrentContext();
    if (context) {
      context.traceId = traceId;
    }
  }

  /**
   * Add metadata to current context
   */
  addMetadata(key: string, value: any): void {
    const context = this.getCurrentContext();
    if (context) {
      context.metadata = context.metadata ?? {};
      context.metadata[key] = value;
    }
  }

  /**
   * Add multiple metadata entries to current context
   */
  addMetadataEntries(metadata: Record<string, any>): void {
    const context = this.getCurrentContext();
    if (context) {
      context.metadata = {
        ...context.metadata,
        ...metadata,
      };
    }
  }

  /**
   * Get request duration in milliseconds
   */
  getRequestDuration(): number | undefined {
    const context = this.getCurrentContext();
    if (!context) {
      return undefined;
    }

    return Date.now() - context.startTime.getTime();
  }

  /**
   * Create child correlation context
   */
  createChildContext(options: Partial<CorrelationContext> = {}): CorrelationContext {
    const parentContext = this.getCurrentContext();

    const childContext: CorrelationContext = {
      correlationId: options.correlationId ?? this.generateCorrelationId(),
      requestId: options.requestId ?? this.generateRequestId(),
      sessionId: options.sessionId ?? parentContext?.sessionId,
      userId: options.userId ?? parentContext?.userId,
      pluginId: options.pluginId ?? parentContext?.pluginId,
      traceId: options.traceId ?? parentContext?.traceId,
      parentRequestId: parentContext?.requestId,
      startTime: new Date(),
      metadata: {
        ...parentContext?.metadata,
        ...options.metadata,
      },
    };

    return childContext;
  }

  /**
   * Extract correlation headers for HTTP requests
   */
  getCorrelationHeaders(): Record<string, string> {
    const context = this.getCurrentContext();
    if (!context) {
      return {};
    }

    const headers: Record<string, string> = {};

    if (context.correlationId) {
      headers['x-correlation-id'] = context.correlationId;
    }

    if (context.requestId) {
      headers['x-request-id'] = context.requestId;
    }

    if (context.sessionId) {
      headers['x-session-id'] = context.sessionId;
    }

    if (context.userId) {
      headers['x-user-id'] = context.userId;
    }

    if (context.traceId) {
      headers['x-trace-id'] = context.traceId;
    }

    return headers;
  }

  /**
   * Create correlation context from HTTP headers
   */
  createContextFromHeaders(headers: Record<string, string>): CorrelationContext {
    return {
      correlationId: headers['x-correlation-id'] || this.generateCorrelationId(),
      requestId: headers['x-request-id'] || this.generateRequestId(),
      sessionId: headers['x-session-id'],
      userId: headers['x-user-id'],
      traceId: headers['x-trace-id'],
      parentRequestId: headers['x-parent-request-id'],
      startTime: new Date(),
      metadata: {},
    };
  }

  /**
   * Generate a unique correlation ID
   */
  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${randomBytes(8).toString('hex')}`;
  }

  /**
   * Get correlation summary for debugging
   */
  getCorrelationSummary(): CorrelationSummary | null {
    const context = this.getCurrentContext();
    if (!context) {
      return null;
    }

    return {
      correlationId: context.correlationId,
      requestId: context.requestId,
      sessionId: context.sessionId,
      userId: context.userId,
      pluginId: context.pluginId,
      traceId: context.traceId,
      parentRequestId: context.parentRequestId,
      duration: this.getRequestDuration(),
      metadataKeys: Object.keys(context.metadata ?? {}),
    };
  }

  /**
   * Check if we're currently in a correlation context
   */
  hasContext(): boolean {
    return this.getCurrentContext() !== null;
  }

  /**
   * Clear current context (mainly for testing)
   */
  clearContext(): void {
    // Note: This doesn't actually clear the AsyncLocalStorage context
    // as that's managed by the async execution flow
    // This method is mainly for testing purposes
  }
}

export interface CorrelationSummary {
  correlationId: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  pluginId?: string;
  traceId?: string;
  parentRequestId?: string;
  duration?: number;
  metadataKeys: string[];
}
