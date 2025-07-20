import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ActivitySummary, PluginActivity, PluginSecurityInfo, PluginSeverity, SecurityMetadata, SecurityReport, SecurityViolation } from '@types';

/**
 * Service responsible for plugin activity auditing and security reporting
 */
@Injectable()
export class PluginAuditService {
  private readonly logger = new Logger(PluginAuditService.name);
  private readonly activityLog: PluginActivity[] = [];
  private readonly auditLogPath: string;
  private readonly maxLogSize = 10000; // Maximum number of activities to keep in memory

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.auditLogPath = path.join(process.cwd(), 'logs', 'plugin-audit.log');
    void this.initializeAuditLog();
  }

  /**
   * Initialize audit log file
   */
  private async initializeAuditLog(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.auditLogPath));
      this.logger.log('Plugin audit service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize audit log:', error);
    }
  }

  /**
   * Log plugin activity for auditing
   */
  auditActivity(activity: PluginActivity): void {
    try {
      activity.timestamp = activity.timestamp ?? new Date();

      // Add to in-memory log
      this.activityLog.push(activity);

      // Maintain log size limit
      if (this.activityLog.length > this.maxLogSize) {
        this.activityLog.splice(0, this.activityLog.length - this.maxLogSize);
      }

      // Write to persistent log
      void this.writeToPersistentLog(activity);

      // Emit audit event for real-time monitoring
      this.eventEmitter.emit('plugin.activity.audited', activity);

      // Check for security-relevant activities
      if (this.isSecurityRelevantActivity(activity)) {
        this.handleSecurityRelevantActivity(activity);
      }

      this.logger.debug(`Activity audited for plugin ${activity.pluginId}: ${activity.action}`);
    } catch (error) {
      this.logger.error('Failed to audit plugin activity:', error);
    }
  }

  /**
   * Get activity log for a specific plugin
   */
  getPluginActivityLog(
    pluginId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      actions?: string[];
    } = {},
  ): PluginActivity[] {
    try {
      let activities = this.activityLog.filter((activity) => activity.pluginId === pluginId);

      // Apply date filters
      if (options.startDate) {
        activities = activities.filter((activity) => activity.timestamp >= options.startDate!);
      }

      if (options.endDate) {
        activities = activities.filter((activity) => activity.timestamp <= options.endDate!);
      }

      // Apply action filters
      if (options.actions && options.actions.length > 0) {
        activities = activities.filter((activity) => options.actions!.some((action) => activity.action.includes(action)));
      }

      // Sort by timestamp (newest first)
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = options.offset ?? 0;
      const limit = options.limit ?? 100;

      return activities.slice(offset, offset + limit);
    } catch (error) {
      this.logger.error(`Failed to get activity log for plugin ${pluginId}:`, error);
      return [];
    }
  }

  /**
   * Get all activity logs
   */
  getAllActivityLogs(
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      pluginIds?: string[];
    } = {},
  ): PluginActivity[] {
    try {
      let activities = [...this.activityLog];

      // Apply plugin filters
      if (options.pluginIds && options.pluginIds.length > 0) {
        activities = activities.filter((activity) => options.pluginIds!.includes(activity.pluginId));
      }

      // Apply date filters
      if (options.startDate) {
        activities = activities.filter((activity) => activity.timestamp >= options.startDate!);
      }

      if (options.endDate) {
        activities = activities.filter((activity) => activity.timestamp <= options.endDate!);
      }

      // Sort by timestamp (newest first)
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = options.offset ?? 0;
      const limit = options.limit ?? 100;

      return activities.slice(offset, offset + limit);
    } catch (error) {
      this.logger.error('Failed to get all activity logs:', error);
      return [];
    }
  }

  /**
   * Generate security report
   */
  generateSecurityReport(
    options: {
      pluginId?: string;
      timeRange?: { start: Date; end: Date };
      includeDetails?: boolean;
    } = {},
  ): SecurityReport {
    try {
      const { pluginId, timeRange, includeDetails = false } = options;

      const activities = pluginId
        ? this.getPluginActivityLog(pluginId, {
            startDate: timeRange?.start,
            endDate: timeRange?.end,
            limit: 1000,
          })
        : this.getAllActivityLogs({
            startDate: timeRange?.start,
            endDate: timeRange?.end,
            limit: 1000,
          });

      // Generate activity summaries
      const recentActivities: ActivitySummary[] = activities.slice(0, 50).map((activity) => ({
        pluginId: activity.pluginId,
        action: activity.action,
        timestamp: activity.timestamp,
        metadata: activity.metadata,
      }));

      // Find security violations
      const securityViolations = activities.filter((activity) => this.isSecurityViolation(activity));

      // Find rate limit violations
      const rateLimitViolations = activities
        .filter((activity) => activity.action.includes('rate_limit') || activity.metadata?.rateLimitExceeded === true)
        .map((activity) => ({
          pluginId: activity.pluginId,
          operation: activity.metadata?.operation ?? activity.action,
          currentCount: activity.metadata?.currentCount ?? 0,
          limit: activity.metadata?.limit ?? 0,
          timestamp: activity.timestamp,
          windowStart: new Date(activity.timestamp.getTime() - 60000), // 1 minute window
          windowEnd: activity.timestamp,
        }));

      // Generate plugin security info
      const plugins: PluginSecurityInfo[] = [];
      if (includeDetails) {
        const _uniquePluginIds = [...new Set(activities.map((a) => a.pluginId))];
        // This would be populated with detailed plugin security information
        // For now, we'll leave it empty as it requires integration with other services
      }

      const report: SecurityReport = {
        timestamp: new Date(),
        timeframe: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
          end: new Date(),
        },
        summary: {
          totalPlugins: plugins.length,
          totalActivities: activities.length,
          securityEvents: securityViolations.length,
          violations: securityViolations.length,
          riskScore: 0,
        },
        activities: [],
        events: [],
        violations: securityViolations.map((activity) => ({
          id: activity.id,
          pluginId: activity.source,
          type: 'policy_violation' as const,
          severity: activity.priority as unknown as PluginSeverity,
          description: `Security activity: ${activity.type}`,
          timestamp: activity.timestamp,
          resolved: false,
          metadata: activity.data as SecurityMetadata,
        })),
        rateLimitViolations,
        plugins,
        recommendations: [],
      };

      this.eventEmitter.emit('security.report.generated', {
        reportId: this.generateReportId(),
        pluginId,
        timeRange,
        violationsCount: securityViolations.length,
        timestamp: new Date(),
      });

      return report;
    } catch (error) {
      this.logger.error('Failed to generate security report:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics
   */
  getActivityStatistics(pluginId?: string): ActivityStatistics {
    try {
      const activities = pluginId ? this.activityLog.filter((a) => a.pluginId === pluginId) : this.activityLog;

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const lastHour = activities.filter((a) => a.timestamp >= oneHourAgo);
      const lastDay = activities.filter((a) => a.timestamp >= oneDayAgo);
      const lastWeek = activities.filter((a) => a.timestamp >= oneWeekAgo);

      const securityEvents = activities.filter((a) => this.isSecurityRelevantActivity(a));
      const violations = activities.filter((a) => this.isSecurityViolation(a));

      // Top actions
      const actionCounts = new Map<string, number>();
      activities.forEach((activity) => {
        const count = actionCounts.get(activity.action) ?? 0;
        actionCounts.set(activity.action, count + 1);
      });

      const topActions = Array.from(actionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }));

      return {
        total: activities.length,
        lastHour: lastHour.length,
        lastDay: lastDay.length,
        lastWeek: lastWeek.length,
        securityEvents: securityEvents.length,
        violations: violations.length,
        topActions,
        timeRange: {
          start: activities.length > 0 ? new Date(Math.min(...activities.map((a) => a.timestamp.getTime()))) : new Date(),
          end: activities.length > 0 ? new Date(Math.max(...activities.map((a) => a.timestamp.getTime()))) : new Date(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to get activity statistics:', error);
      return {
        total: 0,
        lastHour: 0,
        lastDay: 0,
        lastWeek: 0,
        securityEvents: 0,
        violations: 0,
        topActions: [],
        timeRange: { start: new Date(), end: new Date() },
      };
    }
  }

  /**
   * Export audit logs
   */
  exportAuditLogs(options: { pluginId?: string; format: 'json' | 'csv'; timeRange?: { start: Date; end: Date } }): string {
    try {
      const activities = options.pluginId
        ? this.getPluginActivityLog(options.pluginId, {
            startDate: options.timeRange?.start,
            endDate: options.timeRange?.end,
            limit: 10000,
          })
        : this.getAllActivityLogs({
            startDate: options.timeRange?.start,
            endDate: options.timeRange?.end,
            limit: 10000,
          });

      if (options.format === 'json') {
        return JSON.stringify(activities, null, 2);
      } else {
        // CSV format
        const headers = ['Timestamp', 'Plugin ID', 'Action', 'Metadata'];
        const rows = activities.map((activity) => [activity.timestamp.toISOString(), activity.pluginId, activity.action, JSON.stringify(activity.metadata ?? {})]);

        const csvContent = [headers, ...rows].map((row) => row.map((field) => `"${field}"`).join(',')).join('\n');

        return csvContent;
      }
    } catch (error) {
      this.logger.error('Failed to export audit logs:', error);
      throw error;
    }
  }

  /**
   * Check if activity is security-relevant
   */
  private isSecurityRelevantActivity(activity: PluginActivity): boolean {
    const securityActions = ['permission:', 'auth:', 'file:write', 'file:delete', 'network:connect', 'process:spawn', 'system:access', 'config:change', 'admin:'];

    return securityActions.some((action) => activity.action.includes(action));
  }

  /**
   * Check if activity is a security violation
   */
  private isSecurityViolation(activity: PluginActivity): boolean {
    return (
      (activity.action.includes('permission:') && activity.metadata?.granted === false) ||
      activity.action.includes('denied') ||
      activity.action.includes('blocked') ||
      activity.action.includes('violation')
    );
  }

  /**
   * Handle security-relevant activities
   */
  private handleSecurityRelevantActivity(activity: PluginActivity): void {
    this.logger.log(`Security activity logged for ${activity.pluginId}: ${activity.action}`);

    // Emit security event for real-time monitoring
    this.eventEmitter.emit('plugin.security.activity', {
      pluginId: activity.pluginId,
      action: activity.action,
      timestamp: activity.timestamp,
      metadata: activity.metadata,
    });

    // Check for potential security threats
    if (this.isSecurityViolation(activity)) {
      this.eventEmitter.emit('plugin.security.violation', {
        pluginId: activity.pluginId,
        violation: activity.action,
        timestamp: activity.timestamp,
        metadata: activity.metadata,
      });
    }
  }

  /**
   * Write activity to persistent log file
   */
  private async writeToPersistentLog(activity: PluginActivity): Promise<void> {
    try {
      const logEntry = {
        timestamp: activity.timestamp.toISOString(),
        pluginId: activity.pluginId,
        action: activity.action,
        metadata: activity.metadata,
      };

      const logLine = `${JSON.stringify(logEntry)}\n`;
      await fs.appendFile(this.auditLogPath, logLine);
    } catch (error) {
      this.logger.error('Failed to write to persistent audit log:', error);
    }
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Clean up old audit logs
   */
  cleanupOldLogs(daysToKeep = 30): void {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      // Remove old activities from memory
      const beforeCount = this.activityLog.length;
      for (let i = this.activityLog.length - 1; i >= 0; i--) {
        if (this.activityLog[i].timestamp < cutoffDate) {
          this.activityLog.splice(i, 1);
        }
      }

      const afterCount = this.activityLog.length;
      const removedCount = beforeCount - afterCount;

      if (removedCount > 0) {
        this.logger.log(`Cleaned up ${removedCount} old audit log entries`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old audit logs:', error);
    }
  }
}

interface ActivityStatistics {
  total: number;
  lastHour: number;
  lastDay: number;
  lastWeek: number;
  securityEvents: number;
  violations: number;
  topActions: Array<{ action: string; count: number }>;
  timeRange: { start: Date; end: Date };
}
