import { getErrorMessage, getErrorStack } from '@lib/shared/common';
import { Injectable, Logger } from '@nestjs/common';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  actor: string; // User or system component that initiated the action
  resource: string; // What was affected
  action: string; // What action was taken
  details: Record<string, unknown>;
  timestamp: Date;
  source: 'user' | 'system' | 'plugin';
  severity: 'low' | 'medium' | 'high' | 'critical';
  success: boolean;
  error?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export type AuditEventType =
  | 'plugin.loaded'
  | 'plugin.unloaded'
  | 'plugin.started'
  | 'plugin.stopped'
  | 'plugin.request'
  | 'plugin.error'
  | 'plugin.permission.granted'
  | 'plugin.permission.revoked'
  | 'system.startup'
  | 'system.shutdown'
  | 'security.violation'
  | 'config.changed'
  | 'file.access'
  | 'admin.action';

export interface AuditQuery {
  type?: AuditEventType;
  actor?: string;
  resource?: string;
  source?: 'user' | 'system' | 'plugin';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  success?: boolean;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<string, number>;
  eventsBySource: Record<string, number>;
  successRate: number;
  lastEvent?: AuditEvent | undefined;
  timeRange: {
    earliest: Date;
    latest: Date;
  };
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly events: AuditEvent[] = [];
  private readonly maxEvents = 50000;
  private readonly retentionDays = 90;

  async logEvent(
    type: AuditEventType,
    actor: string,
    resource: string,
    action: string,
    details: Record<string, unknown> = {},
    options: {
      source?: 'user' | 'system' | 'plugin';
      severity?: 'low' | 'medium' | 'high' | 'critical';
      success?: boolean;
      error?: string | undefined;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      type,
      actor,
      resource,
      action,
      details: { ...details },
      timestamp: new Date(),
      source: options.source ?? 'system',
      severity: options.severity ?? 'low',
      success: options.success ?? true,
      error: options.error,
      metadata: options.metadata,
    };

    this.events.push(event);
    this.trimEventsIfNeeded();

    this.logger.debug(
      `Audit event logged: ${type} - ${action} on ${resource} by ${actor}`,
    );

    if (event.severity === 'critical' || !event.success) {
      this.logger.warn(`Critical audit event: ${JSON.stringify(event)}`);
    }
    return Promise.resolve();
  }

  async logPluginLoaded(
    actor: string,
    pluginName: string,
    version: string,
    instanceId: string,
  ): Promise<void> {
    await this.logEvent(
      'plugin.loaded',
      actor,
      `plugin:${pluginName}`,
      'load',
      {
        pluginName,
        version,
        instanceId,
      },
      {
        source: 'system',
        severity: 'low',
        success: true,
      },
    );
  }

  async logPluginUnloaded(
    actor: string,
    pluginName: string,
    instanceId: string,
    reason?: string,
  ): Promise<void> {
    await this.logEvent(
      'plugin.unloaded',
      actor,
      `plugin:${pluginName}`,
      'unload',
      {
        pluginName,
        instanceId,
        reason,
      },
      {
        source: 'system',
        severity: 'low',
        success: true,
      },
    );
  }

  async logPluginRequest(
    pluginName: string,
    instanceId: string,
    method: string,
    route: string,
    actor: string,
    success: boolean,
    responseTime?: number,
    error?: string,
  ): Promise<void> {
    await this.logEvent(
      'plugin.request',
      actor,
      `plugin:${pluginName}`,
      `${method} ${route}`,
      {
        pluginName,
        instanceId,
        method,
        route,
        responseTime,
      },
      {
        source: 'plugin',
        severity: success ? 'low' : 'medium',
        success,
        error,
      },
    );
  }

  async logPluginError(
    pluginName: string,
    instanceId: string,
    error: Error,
    context?: string,
  ): Promise<void> {
    await this.logEvent(
      'plugin.error',
      'system',
      `plugin:${pluginName}`,
      'error',
      {
        pluginName,
        instanceId,
        errorMessage: getErrorMessage(error),
        errorStack: getErrorStack(error),
        context,
      },
      {
        source: 'plugin',
        severity: 'high',
        success: false,
        error:  getErrorMessage(error),
      },
    );
  }

  async logSecurityViolation(
    actor: string,
    resource: string,
    action: string,
    violation: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await this.logEvent(
      'security.violation',
      actor,
      resource,
      action,
      {
        violation,
        ...details,
      },
      {
        source: 'system',
        severity: 'critical',
        success: false,
        error: violation,
      },
    );
  }

  async logPermissionChange(
    actor: string,
    pluginName: string,
    permission: string,
    granted: boolean,
  ): Promise<void> {
    await this.logEvent(
      granted ? 'plugin.permission.granted' : 'plugin.permission.revoked',
      actor,
      `plugin:${pluginName}`,
      granted ? 'grant permission' : 'revoke permission',
      {
        pluginName,
        permission,
        granted,
      },
      {
        source: 'user',
        severity: 'medium',
        success: true,
      },
    );
  }

  async logSystemEvent(
    type: 'startup' | 'shutdown',
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await this.logEvent(
      type === 'startup' ? 'system.startup' : 'system.shutdown',
      'system',
      'system',
      type,
      details,
      {
        source: 'system',
        severity: 'low',
        success: true,
      },
    );
  }

  async logAdminAction(
    actor: string,
    resource: string,
    action: string,
    details: Record<string, unknown> = {},
    success = true,
    error?: string,
  ): Promise<void> {
    await this.logEvent('admin.action', actor, resource, action, details, {
      source: 'user',
      severity: 'medium',
      success,
      error,
    });
  }

  async queryEvents(query: AuditQuery = {}): Promise<AuditEvent[]> {
    let filteredEvents = [...this.events];

    if (query.type) {
      filteredEvents = filteredEvents.filter((e) => e.type === query.type);
    }

    if (query.actor != null) {
      filteredEvents = filteredEvents.filter((e) => e.actor === query.actor);
    }

    if (query.resource != null) {
      filteredEvents = filteredEvents.filter((e) =>
        e.resource.includes(query.resource!),
      );
    }

    if (query.source) {
      filteredEvents = filteredEvents.filter((e) => e.source === query.source);
    }

    if (query.severity) {
      filteredEvents = filteredEvents.filter(
        (e) => e.severity === query.severity,
      );
    }

    if (query.success !== undefined) {
      filteredEvents = filteredEvents.filter(
        (e) => e.success === query.success,
      );
    }

    if (query.fromDate) {
      filteredEvents = filteredEvents.filter(
        (e) => e.timestamp >= query.fromDate!,
      );
    }

    if (query.toDate) {
      filteredEvents = filteredEvents.filter(
        (e) => e.timestamp <= query.toDate!,
      );
    }

    // Sort by timestamp (newest first)
    filteredEvents.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;

    return Promise.resolve(filteredEvents.slice(offset, offset + limit));
  }

  async getSummary(fromDate?: Date, toDate?: Date): Promise<AuditSummary> {
    const query: AuditQuery = {};
    if (fromDate) query.fromDate = fromDate;
    if (toDate) query.toDate = toDate;

    const events = await this.queryEvents({
      ...query,
      limit: this.events.length,
    });

    const eventsByType: Record<AuditEventType, number> = {} as Record<
      AuditEventType,
      number
    >;
    const eventsBySeverity: Record<string, number> = {};
    const eventsBySource: Record<string, number> = {};

    let successCount = 0;

    for (const event of events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySeverity[event.severity] =
        (eventsBySeverity[event.severity] ?? 0) + 1;
      eventsBySource[event.source] = (eventsBySource[event.source] ?? 0) + 1;

      if (event.success) {
        successCount++;
      }
    }

    const timeRange =
      events.length > 0
        ? {
            earliest: events[events.length - 1]?.timestamp ?? new Date(),
            latest: events[0]?.timestamp ?? new Date(),
          }
        : {
            earliest: new Date(),
            latest: new Date(),
          };

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      eventsBySource,
      successRate: events.length > 0 ? (successCount / events.length) * 100 : 0,
      lastEvent: events[0] ?? undefined,
      timeRange,
    };
  }

  async exportEvents(
    query: AuditQuery = {},
    format: 'json' | 'csv' = 'json',
  ): Promise<string> {
    const events = await this.queryEvents({
      ...query,
      limit: this.events.length,
    });

    if (format === 'csv') {
      return this.convertToCSV(events);
    }

    return JSON.stringify(events, null, 2);
  }

  async cleanupOldEvents(): Promise<number> {
    const cutoffDate = new Date(
      Date.now() - this.retentionDays * 24 * 60 * 60 * 1000,
    );
    const initialCount = this.events.length;

    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i];
      if (event && event.timestamp < cutoffDate) {
        this.events.splice(i, 1);
      }
    }

    const cleanedCount = initialCount - this.events.length;

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} old audit events`);
    }

    return Promise.resolve(cleanedCount);
  }

  private generateEventId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private trimEventsIfNeeded(): void {
    if (this.events.length > this.maxEvents) {
      const removeCount = this.events.length - this.maxEvents;
      this.events.splice(0, removeCount);
      this.logger.debug(`Trimmed ${removeCount} oldest audit events`);
    }
  }

  private convertToCSV(events: AuditEvent[]): string {
    if (events.length === 0) return '';

    const headers = [
      'id',
      'type',
      'actor',
      'resource',
      'action',
      'timestamp',
      'source',
      'severity',
      'success',
      'error',
    ];

    const lines = [headers.join(',')];

    for (const event of events) {
      const row = [
        event.id,
        event.type,
        event.actor,
        event.resource,
        event.action,
        event.timestamp.toISOString(),
        event.source,
        event.severity,
        event.success.toString(),
        event.error ?? '',
      ];

      lines.push(row.map((field) => `"${field}"`).join(','));
    }

    return lines.join('\n');
  }
}
