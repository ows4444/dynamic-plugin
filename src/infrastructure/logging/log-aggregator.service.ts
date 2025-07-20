import { Injectable, Logger } from '@nestjs/common';

export interface LogAggregation {
  level: string;
  context: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  metadata?: Record<string, any>;
}

export interface AggregationStatistics {
  totalAggregations: number;
  topContexts: Array<{
    context: string;
    count: number;
    levels: Record<string, number>;
  }>;
  topLevels: Array<{
    level: string;
    count: number;
  }>;
  timeDistribution: Record<string, number>;
  errorRate: number;
}

/**
 * Log aggregation service for collecting and summarizing log patterns
 * Provides insights into logging patterns and system behavior
 */
@Injectable()
export class LogAggregatorService {
  private readonly logger = new Logger(LogAggregatorService.name);
  private readonly aggregations = new Map<string, LogAggregation>();
  private readonly timeWindows = new Map<string, number>();
  private isInitialized = false;
  private aggregationInterval: NodeJS.Timeout | null = null;
  private readonly windowSize = 5 * 60 * 1000; // 5 minutes
  private readonly maxAggregations = 10000;

  /**
   * Initialize log aggregator
   */
  initialize(): void {
    try {
      // Start periodic aggregation summary
      this.aggregationInterval = setInterval(() => {
        this.generateAggregationSummary();
      }, this.windowSize);

      this.isInitialized = true;
      this.logger.log('Log aggregator service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize log aggregator service:', error);
      throw error;
    }
  }

  /**
   * Aggregate a log entry
   */
  aggregate(level: string, context?: string, metadata?: Record<string, any>): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      const normalizedContext = context ?? 'Unknown';
      const aggregationKey = this.generateAggregationKey(level, normalizedContext);

      const existingAggregation = this.aggregations.get(aggregationKey);
      const now = new Date();

      if (existingAggregation) {
        // Update existing aggregation
        existingAggregation.count++;
        existingAggregation.lastSeen = now;

        // Merge metadata if provided
        if (metadata) {
          existingAggregation.metadata = {
            ...existingAggregation.metadata,
            ...this.extractAggregableMetadata(metadata),
          };
        }
      } else {
        // Create new aggregation
        const newAggregation: LogAggregation = {
          level,
          context: normalizedContext,
          count: 1,
          firstSeen: now,
          lastSeen: now,
          metadata: metadata ? this.extractAggregableMetadata(metadata) : {},
        };

        this.aggregations.set(aggregationKey, newAggregation);

        // Maintain aggregation limit
        if (this.aggregations.size > this.maxAggregations) {
          this.pruneOldAggregations();
        }
      }

      // Update time window statistics
      this.updateTimeWindows(level);
    } catch (error) {
      this.logger.error('Failed to aggregate log entry:', error);
    }
  }

  /**
   * Get current aggregations
   */
  getAggregations(): LogAggregation[] {
    return Array.from(this.aggregations.values());
  }

  /**
   * Get aggregations by context
   */
  getAggregationsByContext(context: string): LogAggregation[] {
    return this.getAggregations().filter((agg) => agg.context === context);
  }

  /**
   * Get aggregations by level
   */
  getAggregationsByLevel(level: string): LogAggregation[] {
    return this.getAggregations().filter((agg) => agg.level === level);
  }

  /**
   * Get top aggregations by count
   */
  getTopAggregations(limit = 10): LogAggregation[] {
    return this.getAggregations()
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get recent aggregations
   */
  getRecentAggregations(minutes = 60): LogAggregation[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

    return this.getAggregations().filter((agg) => agg.lastSeen >= cutoffTime);
  }

  /**
   * Get aggregation statistics
   */
  getAggregationStatistics(): AggregationStatistics {
    try {
      const aggregations = this.getAggregations();

      // Calculate top contexts
      const contextMap = new Map<string, { count: number; levels: Record<string, number> }>();

      for (const agg of aggregations) {
        if (!contextMap.has(agg.context)) {
          contextMap.set(agg.context, { count: 0, levels: {} });
        }

        const contextData = contextMap.get(agg.context)!;
        contextData.count += agg.count;
        contextData.levels[agg.level] = (contextData.levels[agg.level] || 0) + agg.count;
      }

      const topContexts = Array.from(contextMap.entries())
        .map(([context, data]) => ({ context, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate top levels
      const levelMap = new Map<string, number>();
      let totalLogs = 0;
      let errorLogs = 0;

      for (const agg of aggregations) {
        levelMap.set(agg.level, (levelMap.get(agg.level) ?? 0) + agg.count);
        totalLogs += agg.count;

        if (agg.level === 'error') {
          errorLogs += agg.count;
        }
      }

      const topLevels = Array.from(levelMap.entries())
        .map(([level, count]) => ({ level, count }))
        .sort((a, b) => b.count - a.count);

      // Calculate error rate
      const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;

      // Get time distribution
      const timeDistribution = Object.fromEntries(this.timeWindows);

      return {
        totalAggregations: aggregations.length,
        topContexts,
        topLevels,
        timeDistribution,
        errorRate: Number(errorRate.toFixed(2)),
      };
    } catch (error) {
      this.logger.error('Failed to get aggregation statistics:', error);
      throw error;
    }
  }

  /**
   * Search aggregations
   */
  searchAggregations(query: { level?: string; context?: string; minCount?: number; startTime?: Date; endTime?: Date }): LogAggregation[] {
    let results = this.getAggregations();

    if (query.level) {
      results = results.filter((agg) => agg.level === query.level);
    }

    if (query.context) {
      results = results.filter((agg) => agg.context.toLowerCase().includes(query.context!.toLowerCase()));
    }

    if (query.minCount) {
      results = results.filter((agg) => agg.count >= query.minCount!);
    }

    if (query.startTime) {
      results = results.filter((agg) => agg.lastSeen >= query.startTime!);
    }

    if (query.endTime) {
      results = results.filter((agg) => agg.firstSeen <= query.endTime!);
    }

    return results.sort((a, b) => b.count - a.count);
  }

  /**
   * Export aggregations to various formats
   */
  exportAggregations(format: 'json' | 'csv' | 'text'): string {
    const aggregations = this.getAggregations();

    switch (format) {
      case 'json':
        return JSON.stringify(aggregations, null, 2);
      case 'csv':
        return this.exportToCSV(aggregations);
      case 'text':
        return this.exportToText(aggregations);
      default:
        throw new Error(`Unsupported export format: ${String(format)}`);
    }
  }

  /**
   * Clear all aggregations
   */
  clearAggregations(): void {
    this.aggregations.clear();
    this.timeWindows.clear();
    this.logger.log('Log aggregations cleared');
  }

  /**
   * Generate aggregation key
   */
  private generateAggregationKey(level: string, context: string): string {
    return `${level}:${context}`;
  }

  /**
   * Extract aggregable metadata
   */
  private extractAggregableMetadata(metadata: Record<string, any>): Record<string, any> {
    const aggregableKeys = ['plugin_id', 'user_id', 'http_method', 'status_code', 'db_operation', 'cache_operation', 'security_event', 'severity', 'has_error'];

    const result: Record<string, any> = {};

    for (const key of aggregableKeys) {
      if (metadata[key] !== undefined) {
        result[key] = metadata[key];
      }
    }

    return result;
  }

  /**
   * Update time window statistics
   */
  private updateTimeWindows(level: string): void {
    const windowKey = this.getTimeWindowKey();
    const currentCount = this.timeWindows.get(windowKey) ?? 0;
    this.timeWindows.set(windowKey, currentCount + 1);

    // Clean up old windows (keep last 24 hours)
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;

    for (const [key] of this.timeWindows) {
      const windowTime = parseInt(key.split('-')[0], 10);
      if (windowTime < cutoffTime) {
        this.timeWindows.delete(key);
      }
    }
  }

  /**
   * Get current time window key
   */
  private getTimeWindowKey(): string {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowSize) * this.windowSize;
    return `${windowStart}-${windowStart + this.windowSize}`;
  }

  /**
   * Prune old aggregations to maintain memory limits
   */
  private pruneOldAggregations(): void {
    const aggregations = this.getAggregations();

    // Sort by last seen time and remove oldest 10%
    aggregations.sort((a, b) => a.lastSeen.getTime() - b.lastSeen.getTime());

    const pruneCount = Math.floor(aggregations.length * 0.1);
    const toPrune = aggregations.slice(0, pruneCount);

    for (const agg of toPrune) {
      const key = this.generateAggregationKey(agg.level, agg.context);
      this.aggregations.delete(key);
    }

    this.logger.debug(`Pruned ${pruneCount} old aggregations`);
  }

  /**
   * Generate periodic aggregation summary
   */
  private generateAggregationSummary(): void {
    try {
      const recentAggregations = this.getRecentAggregations(5);
      const errorAggregations = recentAggregations.filter((agg) => agg.level === 'error');

      if (recentAggregations.length > 0) {
        this.logger.debug(`Aggregation Summary: ${recentAggregations.length} recent aggregations, ${errorAggregations.length} errors`);
      }

      // Log top contexts if there are many recent logs
      if (recentAggregations.length > 100) {
        const topContexts = this.getTopAggregations(5);
        const contextSummary = topContexts.map((agg) => `${agg.context}(${agg.count})`).join(', ');
        this.logger.debug(`Top contexts: ${contextSummary}`);
      }
    } catch (error) {
      this.logger.error('Failed to generate aggregation summary:', error);
    }
  }

  /**
   * Export aggregations to CSV
   */
  private exportToCSV(aggregations: LogAggregation[]): string {
    const headers = ['level', 'context', 'count', 'firstSeen', 'lastSeen'];
    const rows = [headers.join(',')];

    for (const agg of aggregations) {
      const row = [agg.level, `"${agg.context.replace(/"/g, '""')}"`, agg.count.toString(), agg.firstSeen.toISOString(), agg.lastSeen.toISOString()];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Export aggregations to text
   */
  private exportToText(aggregations: LogAggregation[]): string {
    const sorted = aggregations.sort((a, b) => b.count - a.count);

    return sorted
      .map((agg) => {
        const duration = agg.lastSeen.getTime() - agg.firstSeen.getTime();
        const durationStr = duration > 0 ? `(${Math.floor(duration / 1000)}s)` : '';

        return `${agg.level.toUpperCase().padEnd(7)} ${agg.context.padEnd(20)} Count: ${agg.count.toString().padStart(6)} ${durationStr}`;
      })
      .join('\n');
  }

  /**
   * Check if aggregator is healthy
   */
  isHealthy(): boolean {
    return this.isInitialized && this.aggregations.size < this.maxAggregations;
  }

  /**
   * Shutdown aggregator
   */
  shutdown(): void {
    try {
      if (this.aggregationInterval) {
        clearInterval(this.aggregationInterval);
        this.aggregationInterval = null;
      }

      // Generate final summary
      this.generateAggregationSummary();

      this.isInitialized = false;
      this.logger.log('Log aggregator service shut down');
    } catch (error) {
      this.logger.error('Error during log aggregator shutdown:', error);
    }
  }
}
