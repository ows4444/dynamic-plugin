import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner, SelectQueryBuilder } from 'typeorm';

export interface QueryPerformanceMetrics {
  query: string;
  executionTime: number;
  rowsAffected: number;
  parameters?: unknown[];
  timestamp: Date;
  isSlowQuery: boolean;
}

export interface QueryOptimizationSuggestion {
  type: 'index' | 'query_rewrite' | 'pagination' | 'caching';
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion: string;
  query: string;
}

@Injectable()
export class QueryOptimizerService {
  private readonly logger = new Logger(QueryOptimizerService.name);
  private readonly slowQueryThreshold = 1000; // 1 second
  private readonly performanceMetrics: QueryPerformanceMetrics[] = [];
  private readonly maxMetricsHistory = 1000;

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Execute a query with performance monitoring
   */
  async executeWithMonitoring<T>(
    queryBuilder: SelectQueryBuilder<T>,
  ): Promise<{ result: T[]; metrics: QueryPerformanceMetrics }> {
    const startTime = Date.now();
    const query = queryBuilder.getQuery();
    const parameters = queryBuilder.getParameters();

    try {
      const result = await queryBuilder.getMany();
      const executionTime = Date.now() - startTime;

      const metrics: QueryPerformanceMetrics = {
        query,
        executionTime,
        rowsAffected: result.length,
        parameters,
        timestamp: new Date(),
        isSlowQuery: executionTime > this.slowQueryThreshold,
      };

      this.recordMetrics(metrics);

      if (metrics.isSlowQuery) {
        this.logger.warn(
          `Slow query detected: ${executionTime}ms - ${query.substring(0, 100)}...`,
        );
        this.analyzeSqlForOptimization(query, parameters);
      }

      return { result, metrics };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(
        `Query failed after ${executionTime}ms: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Analyze SQL query and provide optimization suggestions
   */
  analyzeSqlForOptimization(
    query: string,
    parameters?: unknown[],
  ): QueryOptimizationSuggestion[] {
    const suggestions: QueryOptimizationSuggestion[] = [];
    const normalizedQuery = query.toLowerCase();

    // Check for missing LIMIT clause
    if (
      normalizedQuery.includes('select') &&
      !normalizedQuery.includes('limit') &&
      !normalizedQuery.includes('top')
    ) {
      suggestions.push({
        type: 'pagination',
        severity: 'medium',
        message: 'Query without LIMIT clause detected',
        suggestion: 'Add LIMIT clause to prevent large result sets',
        query,
      });
    }

    // Check for SELECT *
    if (normalizedQuery.includes('select *')) {
      suggestions.push({
        type: 'query_rewrite',
        severity: 'medium',
        message: 'SELECT * detected',
        suggestion: 'Select only required columns to improve performance',
        query,
      });
    }

    // Check for OR conditions (might benefit from UNION)
    if (normalizedQuery.includes(' or ')) {
      suggestions.push({
        type: 'query_rewrite',
        severity: 'low',
        message: 'OR condition detected',
        suggestion: 'Consider using UNION for better index utilization',
        query,
      });
    }

    // Check for LIKE '%term%' (full table scan)
    if (normalizedQuery.includes("like '%") && normalizedQuery.includes("%'")) {
      suggestions.push({
        type: 'index',
        severity: 'high',
        message: 'Full-text LIKE pattern detected',
        suggestion: 'Consider using full-text search or GIN indexes',
        query,
      });
    }

    // Check for subqueries that might benefit from JOINs
    if (normalizedQuery.includes('in (select')) {
      suggestions.push({
        type: 'query_rewrite',
        severity: 'medium',
        message: 'IN with subquery detected',
        suggestion: 'Consider rewriting as JOIN for better performance',
        query,
      });
    }

    // Check for ORDER BY without INDEX
    if (normalizedQuery.includes('order by') && !normalizedQuery.includes('limit')) {
      suggestions.push({
        type: 'index',
        severity: 'medium',
        message: 'ORDER BY without LIMIT detected',
        suggestion: 'Ensure ORDER BY columns are indexed',
        query,
      });
    }

    // Log suggestions
    if (suggestions.length > 0) {
      this.logger.debug(
        `Query optimization suggestions: ${suggestions.length} found`,
      );
      suggestions.forEach(suggestion => {
        this.logger.debug(`[${suggestion.severity.toUpperCase()}] ${suggestion.message}: ${suggestion.suggestion}`);
      });
    }

    return suggestions;
  }

  /**
   * Get query performance statistics
   */
  getPerformanceStats(): {
    totalQueries: number;
    slowQueries: number;
    averageExecutionTime: number;
    slowestQueries: QueryPerformanceMetrics[];
  } {
    const totalQueries = this.performanceMetrics.length;
    const slowQueries = this.performanceMetrics.filter(m => m.isSlowQuery).length;
    
    const averageExecutionTime = totalQueries > 0
      ? this.performanceMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries
      : 0;

    const slowestQueries = this.performanceMetrics
      .filter(m => m.isSlowQuery)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    return {
      totalQueries,
      slowQueries,
      averageExecutionTime,
      slowestQueries,
    };
  }

  /**
   * Optimize a TypeORM QueryBuilder
   */
  optimizeQueryBuilder<T>(queryBuilder: SelectQueryBuilder<T>): SelectQueryBuilder<T> {
    // Add default limit if none specified
    const query = queryBuilder.getQuery().toLowerCase();
    if (!query.includes('limit') && !query.includes('top')) {
      queryBuilder.limit(100); // Default safety limit
      this.logger.debug('Added default LIMIT 100 to query for safety');
    }

    return queryBuilder;
  }

  /**
   * Create optimized indexes based on query patterns
   */
  async suggestIndexes(): Promise<string[]> {
    const suggestions: string[] = [];
    const frequentQueries = this.getFrequentQueryPatterns();

    for (const pattern of frequentQueries) {
      if (pattern.includes('where') && pattern.includes('=')) {
        // Extract column names from WHERE clauses
        const whereColumns = this.extractWhereColumns(pattern);
        if (whereColumns.length > 0) {
          suggestions.push(
            `CREATE INDEX IF NOT EXISTS idx_optimized_${whereColumns.join('_')} ON table_name(${whereColumns.join(', ')});`
          );
        }
      }

      if (pattern.includes('order by')) {
        // Extract ORDER BY columns
        const orderColumns = this.extractOrderByColumns(pattern);
        if (orderColumns.length > 0) {
          suggestions.push(
            `CREATE INDEX IF NOT EXISTS idx_order_${orderColumns.join('_')} ON table_name(${orderColumns.join(', ')});`
          );
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate a performance report
   */
  generatePerformanceReport(): string {
    const stats = this.getPerformanceStats();
    const suggestions = this.getOptimizationSuggestions();

    let report = '# Database Performance Report\n\n';
    report += `## Summary\n`;
    report += `- Total Queries: ${stats.totalQueries}\n`;
    report += `- Slow Queries: ${stats.slowQueries} (${((stats.slowQueries / stats.totalQueries) * 100).toFixed(1)}%)\n`;
    report += `- Average Execution Time: ${stats.averageExecutionTime.toFixed(2)}ms\n\n`;

    if (stats.slowestQueries.length > 0) {
      report += `## Slowest Queries\n`;
      stats.slowestQueries.forEach((query, index) => {
        report += `${index + 1}. ${query.executionTime}ms - ${query.query.substring(0, 100)}...\n`;
      });
      report += '\n';
    }

    if (suggestions.length > 0) {
      report += `## Optimization Suggestions\n`;
      suggestions.forEach((suggestion, index) => {
        report += `${index + 1}. [${suggestion.severity.toUpperCase()}] ${suggestion.message}\n`;
        report += `   Suggestion: ${suggestion.suggestion}\n\n`;
      });
    }

    return report;
  }

  private recordMetrics(metrics: QueryPerformanceMetrics): void {
    this.performanceMetrics.push(metrics);

    // Keep only recent metrics to prevent memory issues
    if (this.performanceMetrics.length > this.maxMetricsHistory) {
      this.performanceMetrics.shift();
    }
  }

  private getFrequentQueryPatterns(): string[] {
    const patterns = new Map<string, number>();

    this.performanceMetrics.forEach(metric => {
      // Normalize query by removing parameters
      const normalizedQuery = this.normalizeQuery(metric.query);
      patterns.set(normalizedQuery, (patterns.get(normalizedQuery) || 0) + 1);
    });

    // Return patterns that appear more than once, sorted by frequency
    return Array.from(patterns.entries())
      .filter(([_, count]) => count > 1)
      .sort(([_, a], [__, b]) => b - a)
      .map(([pattern, _]) => pattern);
  }

  private normalizeQuery(query: string): string {
    return query
      .replace(/\$\d+/g, '?') // Replace PostgreSQL parameters
      .replace(/\b\d+\b/g, '?') // Replace numbers
      .replace(/'[^']*'/g, '?') // Replace string literals
      .toLowerCase()
      .trim();
  }

  private extractWhereColumns(query: string): string[] {
    const whereMatch = query.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/i);
    if (!whereMatch) return [];

    const whereClause = whereMatch[1];
    const columns: string[] = [];
    
    // Simple extraction of column = value patterns
    const matches = whereClause.match(/(\w+)\s*=\s*\?/g);
    if (matches) {
      matches.forEach(match => {
        const column = match.match(/(\w+)\s*=/);
        if (column) columns.push(column[1]);
      });
    }

    return columns;
  }

  private extractOrderByColumns(query: string): string[] {
    const orderMatch = query.match(/order\s+by\s+(.+?)(?:\s+limit|$)/i);
    if (!orderMatch) return [];

    return orderMatch[1]
      .split(',')
      .map(col => col.trim().split(' ')[0]) // Remove ASC/DESC
      .filter(col => col && /^\w+$/.test(col));
  }

  private getOptimizationSuggestions(): QueryOptimizationSuggestion[] {
    const allSuggestions: QueryOptimizationSuggestion[] = [];
    
    this.performanceMetrics
      .filter(m => m.isSlowQuery)
      .forEach(metric => {
        const suggestions = this.analyzeSqlForOptimization(metric.query, metric.parameters);
        allSuggestions.push(...suggestions);
      });

    // Deduplicate suggestions
    const uniqueSuggestions = allSuggestions.filter((suggestion, index, self) =>
      index === self.findIndex(s => s.message === suggestion.message && s.type === suggestion.type)
    );

    return uniqueSuggestions;
  }
}