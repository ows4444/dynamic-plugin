import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  pluginId: string;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  details: any;
  result: 'success' | 'failure' | 'error';
  error?: string;
  metadata?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'performance' | 'configuration' | 'lifecycle' | 'error';
  source: string;
  correlationId?: string;
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context: string;
  pluginId?: string;
  userId?: string;
  sessionId?: string;
  data?: any;
  traceId?: string;
  spanId?: string;
  parentId?: string;
}

export interface AuditQuery {
  pluginId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  result?: 'success' | 'failure' | 'error';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'security' | 'performance' | 'configuration' | 'lifecycle' | 'error';
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEvents: number;
  successCount: number;
  failureCount: number;
  errorCount: number;
  severityBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  topActions: Array<{ action: string; count: number }>;
  topResources: Array<{ resource: string; count: number }>;
  timeRange: { from: Date; to: Date };
}

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text' | 'structured';
  output: 'console' | 'file' | 'both';
  rotation: {
    enabled: boolean;
    maxSize: string;
    maxFiles: number;
    maxAge: string;
  };
  filters: {
    includePlugins: string[];
    excludePlugins: string[];
    includeUsers: string[];
    excludeUsers: string[];
  };
}

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);
  private readonly auditEvents = new Map<string, AuditEvent[]>();
  private readonly logEntries = new Map<string, LogEntry[]>();
  private readonly activeTraces = new Map<string, any>();
  private readonly logConfig: LoggerConfig;
  private readonly auditDir: string;
  private readonly logDir: string;
  private auditFileStream: fs.WriteStream;
  private logFileStream: fs.WriteStream;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.logConfig = {
      level: 'info',
      format: 'json',
      output: 'both',
      rotation: {
        enabled: true,
        maxSize: '10MB',
        maxFiles: 10,
        maxAge: '30d'
      },
      filters: {
        includePlugins: [],
        excludePlugins: [],
        includeUsers: [],
        excludeUsers: []
      }
    };

    this.auditDir = path.join(process.cwd(), 'logs', 'audit');
    this.logDir = path.join(process.cwd(), 'logs', 'plugins');
    
    this.initializeLoggers();
    this.setupEventListeners();
  }

  async logAuditEvent(event: Partial<AuditEvent>): Promise<void> {
    const auditEvent: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      pluginId: event.pluginId || 'system',
      userId: event.userId,
      sessionId: event.sessionId,
      action: event.action || 'unknown',
      resource: event.resource || 'unknown',
      details: event.details || {},
      result: event.result || 'success',
      error: event.error,
      metadata: event.metadata,
      severity: event.severity || 'low',
      category: event.category || 'lifecycle',
      source: event.source || 'plugin-manager',
      correlationId: event.correlationId
    };

    // Store in memory
    if (!this.auditEvents.has(auditEvent.pluginId)) {
      this.auditEvents.set(auditEvent.pluginId, []);
    }
    
    const events = this.auditEvents.get(auditEvent.pluginId);
    events.push(auditEvent);
    
    // Keep only last 1000 events per plugin
    if (events.length > 1000) {
      events.shift();
    }

    // Write to file
    await this.writeAuditToFile(auditEvent);

    // Emit event
    this.eventEmitter.emit('audit.logged', auditEvent);

    // Check for alerts
    this.checkAuditAlerts(auditEvent);
  }

  async logMessage(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context: string,
    data?: any,
    pluginId?: string
  ): Promise<void> {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      pluginId,
      data,
      traceId: this.getCurrentTraceId(),
      spanId: this.getCurrentSpanId()
    };

    // Store in memory
    const key = pluginId || 'system';
    if (!this.logEntries.has(key)) {
      this.logEntries.set(key, []);
    }
    
    const entries = this.logEntries.get(key);
    entries.push(logEntry);
    
    // Keep only last 1000 entries per plugin
    if (entries.length > 1000) {
      entries.shift();
    }

    // Write to file
    await this.writeLogToFile(logEntry);

    // Output to console if configured
    if (this.logConfig.output === 'console' || this.logConfig.output === 'both') {
      this.outputToConsole(logEntry);
    }
  }

  startTrace(traceId: string, operation: string, pluginId?: string): void {
    this.activeTraces.set(traceId, {
      traceId,
      operation,
      pluginId,
      startTime: new Date(),
      spans: []
    });
  }

  startSpan(traceId: string, spanId: string, operation: string, parentId?: string): void {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.spans.push({
        spanId,
        operation,
        parentId,
        startTime: new Date()
      });
    }
  }

  endSpan(traceId: string, spanId: string, result?: any, error?: Error): void {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      const span = trace.spans.find(s => s.spanId === spanId);
      if (span) {
        span.endTime = new Date();
        span.duration = span.endTime.getTime() - span.startTime.getTime();
        span.result = result;
        span.error = error;
      }
    }
  }

  endTrace(traceId: string): void {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.endTime = new Date();
      trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
      
      // Log trace completion
      this.logAuditEvent({
        action: 'trace_completed',
        resource: 'trace',
        pluginId: trace.pluginId,
        details: {
          traceId,
          operation: trace.operation,
          duration: trace.duration,
          spans: trace.spans.length
        },
        category: 'performance',
        severity: 'low'
      });
      
      this.activeTraces.delete(traceId);
    }
  }

  async queryAuditEvents(query: AuditQuery): Promise<AuditEvent[]> {
    let events: AuditEvent[] = [];

    if (query.pluginId) {
      events = this.auditEvents.get(query.pluginId) || [];
    } else {
      // Get all events
      for (const pluginEvents of this.auditEvents.values()) {
        events.push(...pluginEvents);
      }
    }

    // Apply filters
    let filtered = events;

    if (query.userId) {
      filtered = filtered.filter(e => e.userId === query.userId);
    }

    if (query.action) {
      filtered = filtered.filter(e => e.action === query.action);
    }

    if (query.resource) {
      filtered = filtered.filter(e => e.resource === query.resource);
    }

    if (query.result) {
      filtered = filtered.filter(e => e.result === query.result);
    }

    if (query.severity) {
      filtered = filtered.filter(e => e.severity === query.severity);
    }

    if (query.category) {
      filtered = filtered.filter(e => e.category === query.category);
    }

    if (query.fromDate) {
      filtered = filtered.filter(e => e.timestamp >= query.fromDate);
    }

    if (query.toDate) {
      filtered = filtered.filter(e => e.timestamp <= query.toDate);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    
    return filtered.slice(offset, offset + limit);
  }

  async getAuditSummary(query: AuditQuery): Promise<AuditSummary> {
    const events = await this.queryAuditEvents(query);
    
    const summary: AuditSummary = {
      totalEvents: events.length,
      successCount: events.filter(e => e.result === 'success').length,
      failureCount: events.filter(e => e.result === 'failure').length,
      errorCount: events.filter(e => e.result === 'error').length,
      severityBreakdown: {},
      categoryBreakdown: {},
      topActions: [],
      topResources: [],
      timeRange: {
        from: events.length > 0 ? events[events.length - 1].timestamp : new Date(),
        to: events.length > 0 ? events[0].timestamp : new Date()
      }
    };

    // Calculate breakdowns
    const severityCount = new Map<string, number>();
    const categoryCount = new Map<string, number>();
    const actionCount = new Map<string, number>();
    const resourceCount = new Map<string, number>();

    for (const event of events) {
      // Severity breakdown
      severityCount.set(event.severity, (severityCount.get(event.severity) || 0) + 1);
      
      // Category breakdown
      categoryCount.set(event.category, (categoryCount.get(event.category) || 0) + 1);
      
      // Action count
      actionCount.set(event.action, (actionCount.get(event.action) || 0) + 1);
      
      // Resource count
      resourceCount.set(event.resource, (resourceCount.get(event.resource) || 0) + 1);
    }

    // Convert to objects
    summary.severityBreakdown = Object.fromEntries(severityCount);
    summary.categoryBreakdown = Object.fromEntries(categoryCount);

    // Get top actions and resources
    summary.topActions = Array.from(actionCount.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    summary.topResources = Array.from(resourceCount.entries())
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return summary;
  }

  getLogEntries(pluginId?: string, level?: string, limit = 100): LogEntry[] {
    let entries: LogEntry[] = [];

    if (pluginId) {
      entries = this.logEntries.get(pluginId) || [];
    } else {
      for (const pluginEntries of this.logEntries.values()) {
        entries.push(...pluginEntries);
      }
    }

    if (level) {
      entries = entries.filter(e => e.level === level);
    }

    return entries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async exportAuditLog(query: AuditQuery, format: 'json' | 'csv' | 'xml' = 'json'): Promise<string> {
    const events = await this.queryAuditEvents(query);
    
    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);
      
      case 'csv':
        return this.convertToCSV(events);
      
      case 'xml':
        return this.convertToXML(events);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async initializeLoggers(): Promise<void> {
    try {
      // Ensure directories exist
      await fs.ensureDir(this.auditDir);
      await fs.ensureDir(this.logDir);

      // Create file streams
      const auditFile = path.join(this.auditDir, `audit-${new Date().toISOString().split('T')[0]}.log`);
      const logFile = path.join(this.logDir, `plugin-${new Date().toISOString().split('T')[0]}.log`);

      this.auditFileStream = fs.createWriteStream(auditFile, { flags: 'a' });
      this.logFileStream = fs.createWriteStream(logFile, { flags: 'a' });

      this.logger.log('Audit logger initialized');
    } catch (error) {
      this.logger.error('Failed to initialize audit logger:', error);
    }
  }

  private setupEventListeners(): void {
    // Listen to plugin events
    this.eventEmitter.on('plugin.loaded', (event) => {
      this.logAuditEvent({
        action: 'plugin_loaded',
        resource: 'plugin',
        pluginId: event.pluginId,
        details: event,
        category: 'lifecycle',
        severity: 'low'
      });
    });

    this.eventEmitter.on('plugin.unloaded', (event) => {
      this.logAuditEvent({
        action: 'plugin_unloaded',
        resource: 'plugin',
        pluginId: event.pluginId,
        details: event,
        category: 'lifecycle',
        severity: 'low'
      });
    });

    this.eventEmitter.on('plugin.error', (event) => {
      this.logAuditEvent({
        action: 'plugin_error',
        resource: 'plugin',
        pluginId: event.pluginId,
        details: event,
        result: 'error',
        category: 'error',
        severity: 'high'
      });
    });

    this.eventEmitter.on('plugin.security.violation', (event) => {
      this.logAuditEvent({
        action: 'security_violation',
        resource: 'security',
        pluginId: event.pluginId,
        details: event,
        result: 'failure',
        category: 'security',
        severity: 'critical'
      });
    });
  }

  private async writeAuditToFile(event: AuditEvent): Promise<void> {
    if (this.auditFileStream) {
      const line = JSON.stringify(event) + '\n';
      this.auditFileStream.write(line);
    }
  }

  private async writeLogToFile(entry: LogEntry): Promise<void> {
    if (this.logFileStream) {
      const line = this.formatLogEntry(entry) + '\n';
      this.logFileStream.write(line);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    switch (this.logConfig.format) {
      case 'json':
        return JSON.stringify(entry);
      
      case 'structured':
        return `[${entry.timestamp.toISOString()}] ${entry.level.toUpperCase()} ${entry.context}: ${entry.message}${entry.data ? ' ' + JSON.stringify(entry.data) : ''}`;
      
      case 'text':
      default:
        return `${entry.timestamp.toISOString()} [${entry.level.toUpperCase()}] ${entry.context}: ${entry.message}`;
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const formatted = this.formatLogEntry(entry);
    
    switch (entry.level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'debug':
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logConfig.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  private getCurrentTraceId(): string | undefined {
    // This would integrate with a tracing system like OpenTelemetry
    return undefined;
  }

  private getCurrentSpanId(): string | undefined {
    // This would integrate with a tracing system like OpenTelemetry
    return undefined;
  }

  private checkAuditAlerts(event: AuditEvent): void {
    // Check for security alerts
    if (event.category === 'security' && event.severity === 'critical') {
      this.eventEmitter.emit('audit.security.alert', event);
    }

    // Check for high error rates
    if (event.result === 'error' && event.severity === 'high') {
      this.eventEmitter.emit('audit.error.alert', event);
    }
  }

  private convertToCSV(events: AuditEvent[]): string {
    const headers = ['timestamp', 'pluginId', 'action', 'resource', 'result', 'severity', 'category'];
    const rows = events.map(event => [
      event.timestamp.toISOString(),
      event.pluginId,
      event.action,
      event.resource,
      event.result,
      event.severity,
      event.category
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertToXML(events: AuditEvent[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<audit_events>\n';
    
    for (const event of events) {
      xml += '  <event>\n';
      xml += `    <id>${event.id}</id>\n`;
      xml += `    <timestamp>${event.timestamp.toISOString()}</timestamp>\n`;
      xml += `    <pluginId>${event.pluginId}</pluginId>\n`;
      xml += `    <action>${event.action}</action>\n`;
      xml += `    <resource>${event.resource}</resource>\n`;
      xml += `    <result>${event.result}</result>\n`;
      xml += `    <severity>${event.severity}</severity>\n`;
      xml += `    <category>${event.category}</category>\n`;
      xml += '  </event>\n';
    }
    
    xml += '</audit_events>';
    return xml;
  }
}