import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'success' | 'error' | 'timeout';
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
  logs?: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    fields?: Record<string, any>;
  }>;
}

export interface TracingSummary {
  totalTraces: number;
  activeTraces: number;
  averageDuration: number;
  errorRate: number;
  slowestOperations: Array<{
    operationName: string;
    averageDuration: number;
    callCount: number;
  }>;
}

/**
 * Distributed tracing service for performance monitoring and debugging
 * Provides OpenTelemetry-compatible tracing functionality
 */
@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);
  private readonly activeSpans = new Map<string, TraceSpan>();
  private readonly completedSpans = new Map<string, TraceSpan[]>();
  private readonly operationStats = new Map<string, { totalDuration: number; count: number }>();
  private isInitialized = false;
  private totalTracesCreated = 0;

  /**
   * Initialize tracing service
   */
  initialize(): Promise<void> {
    try {
      this.isInitialized = true;
      this.logger.log('Tracing service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize tracing service:', error);
      throw error;
    }
  }

  /**
   * Start a new trace
   */
  startTrace(operationName: string, metadata?: Record<string, any>): Promise<string> {
    if (!this.isInitialized) {
      this.logger.warn('Tracing service not initialized, skipping trace creation');
      return 'tracing-disabled';
    }

    try {
      const traceId = this.generateTraceId();
      const spanId = this.generateSpanId();

      const span: TraceSpan = {
        traceId,
        spanId,
        operationName,
        startTime: new Date(),
        status: 'success',
        metadata,
        tags: {
          operation: operationName,
          service: 'plugin-system',
        },
        logs: [],
      };

      this.activeSpans.set(traceId, span);
      this.totalTracesCreated++;

      this.logger.debug(`Started trace: ${traceId} for operation: ${operationName}`);
      return traceId;
    } catch (error) {
      this.logger.error(`Failed to start trace for ${operationName}:`, error);
      return 'trace-error';
    }
  }

  /**
   * Start a child span
   */
  startChildSpan(parentTraceId: string, operationName: string, metadata?: Record<string, any>): Promise<string> {
    if (!this.isInitialized) {
      return 'tracing-disabled';
    }

    try {
      const parentSpan = this.activeSpans.get(parentTraceId);
      if (!parentSpan) {
        this.logger.warn(`Parent span not found: ${parentTraceId}`);
        return this.startTrace(operationName, metadata);
      }

      const childTraceId = this.generateTraceId();
      const spanId = this.generateSpanId();

      const childSpan: TraceSpan = {
        traceId: childTraceId,
        spanId,
        parentSpanId: parentSpan.spanId,
        operationName,
        startTime: new Date(),
        status: 'success',
        metadata,
        tags: {
          operation: operationName,
          service: 'plugin-system',
          parent_trace_id: parentTraceId,
        },
        logs: [],
      };

      this.activeSpans.set(childTraceId, childSpan);

      this.logger.debug(`Started child span: ${childTraceId} for operation: ${operationName}`);
      return childTraceId;
    } catch (error) {
      this.logger.error(`Failed to start child span for ${operationName}:`, error);
      return 'trace-error';
    }
  }

  /**
   * End a trace
   */
  endTrace(traceId: string, result?: any, error?: Error): Promise<void> {
    if (!this.isInitialized || traceId === 'tracing-disabled' || traceId === 'trace-error') {
      return;
    }

    try {
      const span = this.activeSpans.get(traceId);
      if (!span) {
        this.logger.warn(`Trace not found: ${traceId}`);
        return;
      }

      // Complete the span
      span.endTime = new Date();
      span.duration = span.endTime.getTime() - span.startTime.getTime();
      span.status = error ? 'error' : 'success';

      // Add result/error metadata
      if (result) {
        span.metadata = { ...span.metadata, result };
      }

      if (error) {
        span.metadata = { ...span.metadata, error: error.message, stack: error.stack };
        this.addLog(traceId, 'error', `Operation failed: ${error.message}`, { error: error.message });
      }

      // Update operation statistics
      this.updateOperationStats(span.operationName, span.duration);

      // Move to completed spans
      this.activeSpans.delete(traceId);

      if (!this.completedSpans.has(span.operationName)) {
        this.completedSpans.set(span.operationName, []);
      }

      const operationSpans = this.completedSpans.get(span.operationName)!;
      operationSpans.push(span);

      // Keep only last 1000 spans per operation
      if (operationSpans.length > 1000) {
        operationSpans.splice(0, operationSpans.length - 1000);
      }

      this.logger.debug(`Ended trace: ${traceId}, duration: ${span.duration}ms`);
    } catch (err) {
      this.logger.error(`Failed to end trace ${traceId}:`, err);
    }
  }

  /**
   * Add a log entry to an active trace
   */
  addLog(traceId: string, level: 'info' | 'warn' | 'error' | 'debug', message: string, fields?: Record<string, any>): void {
    if (!this.isInitialized || traceId === 'tracing-disabled' || traceId === 'trace-error') {
      return;
    }

    try {
      const span = this.activeSpans.get(traceId);
      if (!span) {
        this.logger.warn(`Cannot add log to non-existent trace: ${traceId}`);
        return;
      }

      span.logs = span.logs ?? [];
      span.logs.push({
        timestamp: new Date(),
        level,
        message,
        fields,
      });

      // Keep only last 100 logs per span
      if (span.logs.length > 100) {
        span.logs.splice(0, span.logs.length - 100);
      }

      this.logger.debug(`Added log to trace ${traceId}: ${level} - ${message}`);
    } catch (error) {
      this.logger.error(`Failed to add log to trace ${traceId}:`, error);
    }
  }

  /**
   * Add tags to an active trace
   */
  addTags(traceId: string, tags: Record<string, string>): void {
    if (!this.isInitialized || traceId === 'tracing-disabled' || traceId === 'trace-error') {
      return;
    }

    try {
      const span = this.activeSpans.get(traceId);
      if (!span) {
        this.logger.warn(`Cannot add tags to non-existent trace: ${traceId}`);
        return;
      }

      span.tags = { ...span.tags, ...tags };
      this.logger.debug(`Added tags to trace ${traceId}:`, tags);
    } catch (error) {
      this.logger.error(`Failed to add tags to trace ${traceId}:`, error);
    }
  }

  /**
   * Get active trace
   */
  getActiveTrace(traceId: string): TraceSpan | null {
    return this.activeSpans.get(traceId) ?? null;
  }

  /**
   * Get completed traces for an operation
   */
  getCompletedTraces(operationName: string, limit = 50): TraceSpan[] {
    const spans = this.completedSpans.get(operationName) ?? [];
    return spans.slice(-limit);
  }

  /**
   * Get tracing summary for dashboard
   */
  getTracingSummary(): Promise<TracingSummary> {
    try {
      const activeTraces = this.activeSpans.size;
      const totalTraces = this.totalTracesCreated;

      // Calculate average duration and error rate
      let totalDuration = 0;
      let totalCompleted = 0;
      let totalErrors = 0;

      for (const operationSpans of this.completedSpans.values()) {
        for (const span of operationSpans) {
          if (span.duration) {
            totalDuration += span.duration;
            totalCompleted++;

            if (span.status === 'error') {
              totalErrors++;
            }
          }
        }
      }

      const averageDuration = totalCompleted > 0 ? totalDuration / totalCompleted : 0;
      const errorRate = totalCompleted > 0 ? (totalErrors / totalCompleted) * 100 : 0;

      // Get slowest operations
      const slowestOperations = Array.from(this.operationStats.entries())
        .map(([operationName, stats]) => ({
          operationName,
          averageDuration: stats.count > 0 ? stats.totalDuration / stats.count : 0,
          callCount: stats.count,
        }))
        .sort((a, b) => b.averageDuration - a.averageDuration)
        .slice(0, 10);

      return {
        totalTraces,
        activeTraces,
        averageDuration: Number(averageDuration.toFixed(2)),
        errorRate: Number(errorRate.toFixed(2)),
        slowestOperations,
      };
    } catch (error) {
      this.logger.error('Failed to get tracing summary:', error);
      throw error;
    }
  }

  /**
   * Export traces in JSON format for external tools
   */
  exportTraces(operationName?: string, limit = 100): TraceSpan[] {
    try {
      if (operationName) {
        return this.getCompletedTraces(operationName, limit);
      }

      // Export all traces
      const allTraces: TraceSpan[] = [];
      for (const operationSpans of this.completedSpans.values()) {
        allTraces.push(...operationSpans);
      }

      // Sort by start time and limit
      allTraces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      return allTraces.slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to export traces:', error);
      return [];
    }
  }

  /**
   * Clear all trace data
   */
  clearTraces(): Promise<void> {
    try {
      this.activeSpans.clear();
      this.completedSpans.clear();
      this.operationStats.clear();
      this.totalTracesCreated = 0;

      this.logger.log('All trace data cleared');
    } catch (error) {
      this.logger.error('Failed to clear trace data:', error);
      throw error;
    }
  }

  /**
   * Get operation performance statistics
   */
  getOperationStats(operationName: string): { averageDuration: number; callCount: number } | null {
    const stats = this.operationStats.get(operationName);
    if (!stats) {
      return null;
    }

    return {
      averageDuration: stats.count > 0 ? stats.totalDuration / stats.count : 0,
      callCount: stats.count,
    };
  }

  /**
   * Update operation statistics
   */
  private updateOperationStats(operationName: string, duration: number): void {
    if (!this.operationStats.has(operationName)) {
      this.operationStats.set(operationName, { totalDuration: 0, count: 0 });
    }

    const stats = this.operationStats.get(operationName)!;
    stats.totalDuration += duration;
    stats.count += 1;
  }

  /**
   * Generate unique trace ID
   */
  private generateTraceId(): string {
    return `trace-${Date.now()}-${randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate unique span ID
   */
  private generateSpanId(): string {
    return `span-${randomBytes(8).toString('hex')}`;
  }

  /**
   * Check if tracing service is healthy
   */
  isHealthy(): Promise<boolean> {
    return this.isInitialized;
  }

  /**
   * Shutdown tracing service
   */
  async shutdown(): Promise<void> {
    try {
      // End all active traces
      const activeTraceIds = Array.from(this.activeSpans.keys());
      const endPromises = activeTraceIds.map((traceId) => this.endTrace(traceId, null, new Error('Service shutdown')));

      await Promise.allSettled(endPromises);

      this.isInitialized = false;
      this.logger.log('Tracing service shut down');
    } catch (error) {
      this.logger.error('Error during tracing service shutdown:', error);
    }
  }
}
