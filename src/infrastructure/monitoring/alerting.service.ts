import { Injectable, Logger } from '@nestjs/common';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  actions: AlertAction[];
  enabled: boolean;
  cooldownPeriod: number; // milliseconds
  lastTriggered?: Date;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  threshold: number;
  duration?: number; // milliseconds - condition must persist for this duration
}

export interface AlertAction {
  type: 'log' | 'email' | 'webhook' | 'slack';
  config: Record<string, any>;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface AlertingSummary {
  totalRules: number;
  activeRules: number;
  totalAlerts: number;
  activeAlerts: number;
  recentAlerts: Alert[];
  alertsByLevel: Record<string, number>;
}

/**
 * Alerting service for monitoring-based notifications and actions
 * Provides rule-based alerting with multiple notification channels
 */
@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private readonly alertRules = new Map<string, AlertRule>();
  private readonly activeAlerts = new Map<string, Alert>();
  private readonly alertHistory: Alert[] = [];
  private isInitialized = false;
  private totalAlertsGenerated = 0;

  /**
   * Initialize alerting service
   */
  initialize(): void {
    try {
      // Register built-in alert rules
      this.registerBuiltInAlertRules();

      this.isInitialized = true;
      this.logger.log('Alerting service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize alerting service:', error);
      throw error;
    }
  }

  /**
   * Register built-in alert rules
   */
  private registerBuiltInAlertRules(): void {
    const builtInRules: Array<Omit<AlertRule, 'id'>> = [
      {
        name: 'High CPU Usage',
        description: 'Alert when CPU usage exceeds 80% for more than 5 minutes',
        condition: {
          metric: 'system.cpu.usage',
          operator: 'gt',
          threshold: 80,
          duration: 5 * 60 * 1000, // 5 minutes
        },
        actions: [
          {
            type: 'log',
            config: { level: 'warning' },
          },
        ],
        enabled: true,
        cooldownPeriod: 10 * 60 * 1000, // 10 minutes
      },
      {
        name: 'High Memory Usage',
        description: 'Alert when memory usage exceeds 85%',
        condition: {
          metric: 'system.memory.usage',
          operator: 'gt',
          threshold: 85,
        },
        actions: [
          {
            type: 'log',
            config: { level: 'warning' },
          },
        ],
        enabled: true,
        cooldownPeriod: 10 * 60 * 1000,
      },
      {
        name: 'Plugin Error Rate',
        description: 'Alert when plugin error rate exceeds 5%',
        condition: {
          metric: 'plugin.errors.rate',
          operator: 'gt',
          threshold: 5,
        },
        actions: [
          {
            type: 'log',
            config: { level: 'error' },
          },
        ],
        enabled: true,
        cooldownPeriod: 5 * 60 * 1000,
      },
      {
        name: 'API Response Time',
        description: 'Alert when API response time exceeds 2 seconds',
        condition: {
          metric: 'api.response.duration',
          operator: 'gt',
          threshold: 2000,
        },
        actions: [
          {
            type: 'log',
            config: { level: 'warning' },
          },
        ],
        enabled: true,
        cooldownPeriod: 15 * 60 * 1000,
      },
    ];

    for (const rule of builtInRules) {
      this.createAlertRule(rule);
    }
  }

  /**
   * Create a new alert rule
   */
  createAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = this.generateAlertRuleId();
    const alertRule: AlertRule = {
      ...rule,
      id,
    };

    this.alertRules.set(id, alertRule);
    this.logger.debug(`Created alert rule: ${rule.name} (${id})`);

    return id;
  }

  /**
   * Update an existing alert rule
   */
  updateAlertRule(id: string, updates: Partial<Omit<AlertRule, 'id'>>): boolean {
    const rule = this.alertRules.get(id);
    if (!rule) {
      return false;
    }

    Object.assign(rule, updates);
    this.logger.debug(`Updated alert rule: ${id}`);

    return true;
  }

  /**
   * Delete an alert rule
   */
  deleteAlertRule(id: string): boolean {
    const deleted = this.alertRules.delete(id);
    if (deleted) {
      this.logger.debug(`Deleted alert rule: ${id}`);
    }
    return deleted;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get specific alert rule
   */
  getAlertRule(id: string): AlertRule | null {
    return this.alertRules.get(id) ?? null;
  }

  /**
   * Enable/disable an alert rule
   */
  toggleAlertRule(id: string, enabled: boolean): boolean {
    const rule = this.alertRules.get(id);
    if (!rule) {
      return false;
    }

    rule.enabled = enabled;
    this.logger.debug(`${enabled ? 'Enabled' : 'Disabled'} alert rule: ${id}`);

    return true;
  }

  /**
   * Evaluate metric value against alert rules
   */
  async evaluateMetric(metricName: string, value: number, metadata?: Record<string, any>): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      for (const rule of this.alertRules.values()) {
        if (!rule.enabled || rule.condition.metric !== metricName) {
          continue;
        }

        // Check if rule is in cooldown period
        if (this.isInCooldown(rule)) {
          continue;
        }

        // Evaluate condition
        const conditionMet = this.evaluateCondition(rule.condition, value);

        if (conditionMet) {
          await this.triggerAlert(rule, value, metadata);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate metric ${metricName}:`, error);
    }
  }

  /**
   * Send alert manually
   */
  async sendAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): Promise<string> {
    try {
      const alertId = this.generateAlertId();
      const fullAlert: Alert = {
        ...alert,
        id: alertId,
        timestamp: new Date(),
        acknowledged: false,
      };

      // Store alert
      this.activeAlerts.set(alertId, fullAlert);
      this.alertHistory.push(fullAlert);
      this.totalAlertsGenerated++;

      // Trim history if too large
      if (this.alertHistory.length > 1000) {
        this.alertHistory.splice(0, this.alertHistory.length - 1000);
      }

      // Execute alert actions (using a mock rule for manual alerts)
      const mockRule: AlertRule = {
        id: 'manual',
        name: 'Manual Alert',
        description: 'Manually triggered alert',
        condition: { metric: '', operator: 'gt', threshold: 0 },
        actions: [{ type: 'log', config: { level: alert.severity } }],
        enabled: true,
        cooldownPeriod: 0,
      };

      await this.executeAlertActions(mockRule, fullAlert);

      this.logger.debug(`Manual alert sent: ${alertId}`);
      return alertId;
    } catch (error) {
      this.logger.error('Failed to send manual alert:', error);
      throw error;
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    this.logger.debug(`Alert acknowledged: ${alertId}`);

    return true;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolvedAt = new Date();
    this.activeAlerts.delete(alertId);
    this.logger.debug(`Alert resolved: ${alertId}`);

    return true;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get alerting summary for dashboard
   */
  getAlertingSummary(): AlertingSummary {
    try {
      const totalRules = this.alertRules.size;
      const activeRules = Array.from(this.alertRules.values()).filter((rule) => rule.enabled).length;
      const totalAlerts = this.totalAlertsGenerated;
      const activeAlerts = this.activeAlerts.size;
      const recentAlerts = this.alertHistory.slice(-10);

      // Count alerts by severity level
      const alertsByLevel: Record<string, number> = {
        info: 0,
        warning: 0,
        error: 0,
        critical: 0,
      };

      for (const alert of this.activeAlerts.values()) {
        alertsByLevel[alert.severity] = (alertsByLevel[alert.severity] || 0) + 1;
      }

      return {
        totalRules,
        activeRules,
        totalAlerts,
        activeAlerts,
        recentAlerts,
        alertsByLevel,
      };
    } catch (error) {
      this.logger.error('Failed to get alerting summary:', error);
      throw error;
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, value: number, metadata?: Record<string, any>): Promise<void> {
    try {
      const severity = this.determineSeverity(rule, value);
      const alertId = this.generateAlertId();

      const alert: Alert = {
        id: alertId,
        ruleId: rule.id,
        severity,
        title: rule.name,
        message: `${rule.description}. Current value: ${value}, threshold: ${rule.condition.threshold}`,
        value,
        threshold: rule.condition.threshold,
        timestamp: new Date(),
        acknowledged: false,
        metadata,
      };

      // Store alert
      this.activeAlerts.set(alertId, alert);
      this.alertHistory.push(alert);
      this.totalAlertsGenerated++;

      // Update rule's last triggered time
      rule.lastTriggered = new Date();

      // Execute alert actions
      await this.executeAlertActions(rule, alert);

      this.logger.debug(`Alert triggered: ${rule.name} (${alertId})`);
    } catch (error) {
      this.logger.error(`Failed to trigger alert for rule ${rule.id}:`, error);
    }
  }

  /**
   * Execute alert actions
   */
  private async executeAlertActions(rule: AlertRule, alert: Alert): Promise<void> {
    const actionPromises = rule.actions.map((action) => this.executeAction(action, alert));
    await Promise.allSettled(actionPromises);
  }

  /**
   * Execute a single alert action
   */
  private async executeAction(action: AlertAction, alert: Alert): Promise<void> {
    try {
      switch (action.type) {
        case 'log':
          this.executeLogAction(action, alert);
          break;
        case 'email':
          await this.executeEmailAction(action, alert);
          break;
        case 'webhook':
          await this.executeWebhookAction(action, alert);
          break;
        case 'slack':
          await this.executeSlackAction(action, alert);
          break;
        default:
          this.logger.warn(`Unknown alert action type: ${String(action.type)}`);
      }
    } catch (error) {
      this.logger.error(`Failed to execute alert action ${action.type}:`, error);
    }
  }

  /**
   * Execute log action
   */
  private executeLogAction(action: AlertAction, alert: Alert): void {
    const level = action.config.level || 'info';
    const message = `ALERT: ${alert.title} - ${alert.message}`;

    switch (level) {
      case 'error':
        this.logger.error(message);
        break;
      case 'warning':
        this.logger.warn(message);
        break;
      case 'debug':
        this.logger.debug(message);
        break;
      default:
        this.logger.log(message);
    }
  }

  /**
   * Execute email action (mock implementation)
   */
  private async executeEmailAction(action: AlertAction, alert: Alert): Promise<void> {
    // Mock email sending
    this.logger.debug(`Would send email alert: ${alert.title} to ${action.config.to}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Execute webhook action (mock implementation)
   */
  private async executeWebhookAction(action: AlertAction, alert: Alert): Promise<void> {
    // Mock webhook call
    this.logger.debug(`Would send webhook alert to: ${action.config.url}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Execute Slack action (mock implementation)
   */
  private async executeSlackAction(action: AlertAction, alert: Alert): Promise<void> {
    // Mock Slack notification
    this.logger.debug(`Would send Slack alert to: ${action.config.channel}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case 'gt':
        return value > condition.threshold;
      case 'lt':
        return value < condition.threshold;
      case 'eq':
        return value === condition.threshold;
      case 'gte':
        return value >= condition.threshold;
      case 'lte':
        return value <= condition.threshold;
      case 'ne':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Determine alert severity
   */
  private determineSeverity(rule: AlertRule, value: number): 'info' | 'warning' | 'error' | 'critical' {
    const threshold = rule.condition.threshold;
    const ratio = Math.abs(value - threshold) / threshold;

    if (ratio > 0.5) {
      return 'critical';
    } else if (ratio > 0.2) {
      return 'error';
    } else if (ratio > 0.1) {
      return 'warning';
    } else {
      return 'info';
    }
  }

  /**
   * Check if rule is in cooldown period
   */
  private isInCooldown(rule: AlertRule): boolean {
    if (!rule.lastTriggered) {
      return false;
    }

    const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
    return timeSinceLastTrigger < rule.cooldownPeriod;
  }

  /**
   * Generate unique alert rule ID
   */
  private generateAlertRuleId(): string {
    return `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if alerting service is healthy
   */
  isHealthy(): boolean {
    return this.isInitialized;
  }

  /**
   * Shutdown alerting service
   */
  shutdown(): void {
    try {
      this.isInitialized = false;
      this.alertRules.clear();
      this.activeAlerts.clear();
      this.alertHistory.length = 0;
      this.totalAlertsGenerated = 0;

      this.logger.log('Alerting service shut down');
    } catch (error) {
      this.logger.error('Error during alerting service shutdown:', error);
    }
  }
}
