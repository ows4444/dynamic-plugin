import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  ActivitySummary,
  PluginActivity,
  PluginPackage,
  PluginPermissions,
  PluginRateLimits,
  PluginSecurityInfo,
  RateLimitOperation,
  ResourceLimits,
  SecurityAction,
  SecurityContext,
  SecurityReport,
  SecurityResourceType,
} from '@/types/plugin.types';

@Injectable()
export class PluginSecurityService {
  private readonly logger = new Logger(PluginSecurityService.name);
  private readonly securityContexts = new Map<string, SecurityContext>();
  private readonly rateLimits: PluginRateLimits = new Map<string, RateLimitOperation>();
  private readonly activityLog: PluginActivity[] = [];

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async validatePluginSignature(plugin: PluginPackage): Promise<boolean> {
    try {
      this.logger.debug('Validating plugin signature...');

      if (!plugin.signature) {
        this.logger.warn('Plugin has no signature');
        return false;
      }

      // Calculate checksum of plugin files
      const calculatedChecksum = this.calculatePluginChecksum(plugin);

      if (calculatedChecksum !== plugin.checksum) {
        this.logger.error('Plugin checksum mismatch');
        return false;
      }

      // In a real implementation, this would verify the digital signature
      // using a public key from a trusted authority
      const isValidSignature = await this.verifyDigitalSignature(plugin.checksum, plugin.signature);

      if (!isValidSignature) {
        this.logger.error('Invalid plugin signature');
        return false;
      }

      this.logger.debug('Plugin signature validation successful');
      return true;
    } catch (error) {
      this.logger.error('Plugin signature validation failed:', error);
      return false;
    }
  }

  private calculatePluginChecksum(plugin: PluginPackage): string {
    const hash = crypto.createHash('sha256');

    // Sort files by name for consistent checksum
    const sortedFiles = Array.from(plugin.files.entries()).sort();

    for (const [filename, content] of sortedFiles) {
      hash.update(filename);
      hash.update(content);
    }

    return hash.digest('hex');
  }

  private async verifyDigitalSignature(data: string, signature: string): Promise<boolean> {
    try {
      // In a real implementation, this would use actual cryptographic verification
      // For now, we'll simulate signature verification

      // Load public key (in real implementation, this would be from a trusted source)
      const publicKeyPath = path.join(process.cwd(), 'keys', 'plugin-verification.pub');

      if (!(await fs.pathExists(publicKeyPath))) {
        this.logger.warn('Public key not found for signature verification');
        return false; // In development, might return true for testing
      }

      // Simulate signature verification
      // In production, use crypto.verify() with actual keys
      const isValid = signature.length > 0 && data.length > 0;

      return isValid;
    } catch (error) {
      this.logger.error('Digital signature verification failed:', error);
      return false;
    }
  }

  checkPermissions(pluginId: string, resource: SecurityResourceType | string, action: SecurityAction | string): boolean {
    try {
      const context = this.securityContexts.get(pluginId);
      if (!context) {
        this.logger.warn(`Security context not found for plugin: ${pluginId}`);
        return false;
      }

      const hasPermission = this.evaluatePermission(context.permissions, resource, action);

      // Log permission check
      this.auditPluginActivity({
        pluginId,
        action: `permission:${resource}:${action}`,
        timestamp: new Date(),
        metadata: {
          resource,
          action,
          granted: hasPermission,
        },
      });

      if (!hasPermission) {
        this.logger.warn(`Permission denied for ${pluginId}: ${resource}:${action}`);
        this.eventEmitter.emit('plugin.permission.denied', {
          pluginId,
          resource,
          action,
          timestamp: new Date(),
        });
      }

      return hasPermission;
    } catch (error) {
      this.logger.error(`Permission check failed for ${pluginId}:`, error);
      return false;
    }
  }

  private evaluatePermission(permissions: PluginPermissions, resource: SecurityResourceType | string, action: SecurityAction | string): boolean {
    const resourcePermissions = permissions[resource];

    if (!resourcePermissions || !Array.isArray(resourcePermissions)) {
      return false;
    }

    // Check if action is explicitly allowed
    if (resourcePermissions.includes(action)) {
      return true;
    }

    // Check for wildcard permissions
    if (resourcePermissions.includes(SecurityAction.WILDCARD)) {
      return true;
    }

    // Check for read/write hierarchies
    if (action === 'read' && resourcePermissions.includes(SecurityAction.WRITE)) {
      return true; // write permission implies read permission
    }

    return false;
  }

  createSecurityContext(pluginId: string, permissions: PluginPermissions, resourceLimits?: ResourceLimits): SecurityContext {
    try {
      const context: SecurityContext = {
        pluginId,
        permissions,
        isolation: false, // Would be configurable based on plugin trust level
        resourceLimits: resourceLimits ?? {
          memory: 512 * 1024 * 1024, // 512MB
          cpu: 100, // 100%
          network: 100 * 1024 * 1024, // 100MB
          filesystem: 1024 * 1024 * 1024, // 1GB
        },
      };

      this.securityContexts.set(pluginId, context);

      this.logger.debug(`Security context created for plugin: ${pluginId}`);

      this.eventEmitter.emit('plugin.security.context.created', {
        pluginId,
        permissions: Object.keys(permissions),
        isolation: context.isolation,
      });

      return context;
    } catch (error) {
      this.logger.error(`Failed to create security context for ${pluginId}:`, error);
      throw error;
    }
  }

  destroySecurityContext(pluginId: string): void {
    try {
      const context = this.securityContexts.get(pluginId);
      if (!context) {
        this.logger.warn(`Security context not found for plugin: ${pluginId}`);
        return;
      }

      this.securityContexts.delete(pluginId);
      this.rateLimits.delete(pluginId);

      this.logger.debug(`Security context destroyed for plugin: ${pluginId}`);

      this.eventEmitter.emit('plugin.security.context.destroyed', { pluginId });
    } catch (error) {
      this.logger.error(`Failed to destroy security context for ${pluginId}:`, error);
    }
  }

  auditPluginActivity(activity: PluginActivity): void {
    try {
      // Add to in-memory log (in production, this would go to a persistent store)
      this.activityLog.push(activity);

      // Keep only last 10000 activities to prevent memory leaks
      if (this.activityLog.length > 10000) {
        this.activityLog.splice(0, this.activityLog.length - 10000);
      }

      // Emit audit event for external monitoring systems
      this.eventEmitter.emit('plugin.activity.audit', activity);

      // Log security-relevant activities
      if (this.isSecurityRelevantActivity(activity)) {
        this.logger.log(`Security activity logged for ${activity.pluginId}: ${activity.action}`);
      }
    } catch (error) {
      this.logger.error('Failed to audit plugin activity:', error);
    }
  }

  private isSecurityRelevantActivity(activity: PluginActivity): boolean {
    const securityActions = ['permission:', 'file:write', 'file:delete', 'network:connect', 'process:spawn', 'system:access'];

    return securityActions.some((action) => activity.action.includes(action));
  }

  enforceRateLimit(pluginId: string, operation: string, limit = 100): boolean {
    try {
      const now = Date.now();
      const windowMs = 60000; // 1 minute window

      if (!this.rateLimits.has(pluginId)) {
        this.rateLimits.set(pluginId, new Map());
      }

      const pluginLimits = this.rateLimits.get(pluginId);
      if (!pluginLimits) {
        this.logger.error(`Plugin limits not found for: ${pluginId}`);
        return false;
      }

      const operationKey = `${operation}:${Math.floor(now / windowMs)}`;
      const currentCount = pluginLimits.get(operationKey) ?? 0;

      if (currentCount >= limit) {
        this.logger.warn(`Rate limit exceeded for ${pluginId}: ${operation} (${currentCount}/${limit})`);

        this.eventEmitter.emit('plugin.rate_limit.exceeded', {
          pluginId,
          operation,
          currentCount,
          limit,
          timestamp: new Date(),
        });

        return false;
      }

      pluginLimits.set(operationKey, currentCount + 1);

      // Clean up old entries
      for (const [key] of pluginLimits.entries()) {
        const [, windowStart] = key.split(':');
        if (parseInt(windowStart) < Math.floor((now - windowMs * 2) / windowMs)) {
          pluginLimits.delete(key);
        }
      }

      return true;
    } catch (error) {
      this.logger.error(`Rate limit enforcement failed for ${pluginId}:`, error);
      return false;
    }
  }

  getSecurityContext(pluginId: string): SecurityContext | null {
    return this.securityContexts.get(pluginId) ?? null;
  }

  getPluginActivityLog(pluginId: string, limit = 100, offset = 0): PluginActivity[] {
    const pluginActivities = this.activityLog
      .filter((activity) => activity.pluginId === pluginId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);

    return pluginActivities;
  }

  getAllActivityLog(limit = 100, offset = 0): PluginActivity[] {
    return this.activityLog.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(offset, offset + limit);
  }

  validateResourceAccess(pluginId: string, resource: string, _path: string): boolean {
    try {
      const context = this.securityContexts.get(pluginId);
      if (!context) {
        return false;
      }

      // Validate filesystem access
      if (resource === 'filesystem') {
        return this.validateFilesystemAccess(context, _path);
      }

      // Validate network access
      if (resource === 'network') {
        return this.validateNetworkAccess(context, _path);
      }

      // Default deny
      return false;
    } catch (error) {
      this.logger.error(`Resource access validation failed for ${pluginId}:`, error);
      return false;
    }
  }

  private validateFilesystemAccess(context: SecurityContext, filePath: string): boolean {
    const permissions = context.permissions.filesystem;
    if (!permissions || !Array.isArray(permissions)) {
      return false;
    }

    const absolutePath = path.resolve(filePath);

    // For now, treat filesystem permissions as a simple array of allowed paths
    for (const allowedPath of permissions) {
      if (absolutePath.startsWith(path.resolve(allowedPath))) {
        return true;
      }
    }

    return false;
  }

  private validateNetworkAccess(context: SecurityContext, url: string): boolean {
    const permissions = context.permissions.network;
    if (!permissions || !Array.isArray(permissions)) {
      return false;
    }

    try {
      // For now, treat network permissions as a simple array of allowed URLs/patterns
      for (const allowedPattern of permissions) {
        if (url.includes(allowedPattern)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Network access validation failed:', error);
      return false;
    }
  }

  generateSecurityReport(pluginId?: string): SecurityReport {
    try {
      const report: SecurityReport = {
        timestamp: new Date(),
        totalPlugins: this.securityContexts.size,
        totalActivities: this.activityLog.length,
        recentActivities: [],
        securityViolations: [],
        rateLimitViolations: [],
        plugins: [],
      };

      // Get recent activities
      const activities = pluginId ? this.getPluginActivityLog(pluginId, 50) : this.getAllActivityLog(50);

      report.recentActivities = activities.map(
        (activity): ActivitySummary => ({
          pluginId: activity.pluginId,
          action: activity.action,
          timestamp: activity.timestamp,
          metadata: activity.metadata,
        }),
      );

      // Get security violations (failed permission checks)
      report.securityViolations = activities.filter((activity) => activity.action.includes('permission:') && activity.metadata?.granted === false);

      // Get plugin-specific info if requested
      if (pluginId) {
        const context = this.securityContexts.get(pluginId);
        if (context) {
          report.plugins = [
            {
              pluginId,
              permissions: context.permissions,
              isolation: context.isolation,
              resourceLimits: context.resourceLimits,
            },
          ];
        }
      } else {
        // Get all plugins
        report.plugins = Array.from(this.securityContexts.entries()).map(
          ([id, context]): PluginSecurityInfo => ({
            pluginId: id,
            permissions: context.permissions,
            isolation: context.isolation,
            resourceLimits: context.resourceLimits,
          }),
        );
      }

      return report;
    } catch (error) {
      this.logger.error('Failed to generate security report:', error);
      throw error;
    }
  }
}
