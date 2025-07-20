import { Injectable, Logger } from '@nestjs/common';

export interface SecurityEvent {
  id: string;
  event: string;
  userId?: string;
  success: boolean;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

/**
 * Audit service for logging and tracking security events
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly auditLog: SecurityEvent[] = [];
  private isInitialized = false;

  initialize(): void {
    this.isInitialized = true;
    this.logger.log('Audit service initialized');
  }

  logSecurityEvent(event: { event: string; userId?: string; success: boolean; ipAddress?: string; userAgent?: string; details?: Record<string, any> }): void {
    try {
      const securityEvent: SecurityEvent = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        ...event,
      };

      this.auditLog.push(securityEvent);

      // Keep only last 10000 events
      if (this.auditLog.length > 10000) {
        this.auditLog.splice(0, this.auditLog.length - 10000);
      }

      this.logger.log(`Security event logged: ${event.event} - ${event.success ? 'SUCCESS' : 'FAILURE'}`);
    } catch (error) {
      this.logger.error('Failed to log security event:', error);
    }
  }

  getAuditLog(filter?: { userId?: string; event?: string; success?: boolean; limit?: number }): SecurityEvent[] {
    let filteredLog = [...this.auditLog];

    if (filter) {
      if (filter.userId) {
        filteredLog = filteredLog.filter((event) => event.userId === filter.userId);
      }
      if (filter.event) {
        filteredLog = filteredLog.filter((event) => event.event === filter.event);
      }
      if (filter.success !== undefined) {
        filteredLog = filteredLog.filter((event) => event.success === filter.success);
      }
      if (filter.limit) {
        filteredLog = filteredLog.slice(-filter.limit);
      }
    }

    return filteredLog.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getStatistics(): {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    recentEvents: SecurityEvent[];
  } {
    const totalEvents = this.auditLog.length;
    const successfulEvents = this.auditLog.filter((e) => e.success).length;
    const failedEvents = totalEvents - successfulEvents;

    return {
      totalEvents,
      successfulEvents,
      failedEvents,
      recentEvents: this.auditLog.slice(-10),
    };
  }

  isHealthy(): boolean {
    return this.isInitialized;
  }

  shutdown(): void {
    this.isInitialized = false;
    this.logger.log('Audit service shut down');
  }
}
