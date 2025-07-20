import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import { PluginActivity, PluginPackage, PluginPermissions, PluginRateLimits, RateLimitOperation, ResourceLimits, SecurityAction, SecurityContext, SecurityReport, SecurityResourceType } from '@types';
import { PluginAuthService } from './services/plugin-auth.service';
import { PluginAuditService } from './services/plugin-audit.service';

/**
 * Enhanced Plugin Security Service
 *
 * Provides comprehensive security management for plugins including authentication,
 * authorization, auditing, signature validation, and resource monitoring.
 */
@Injectable()
export class PluginSecurityService {
  private readonly logger = new Logger(PluginSecurityService.name);
  private readonly securityContexts = new Map<string, SecurityContext>();
  private readonly rateLimits: PluginRateLimits = new Map<string, RateLimitOperation>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly authService: PluginAuthService,
    private readonly auditService: PluginAuditService,
  ) {}

  /**
   * Validate plugin signature and integrity
   */
  async validatePluginSignature(plugin: PluginPackage): Promise<boolean> {
    try {
      this.logger.debug('Validating plugin signature...');

      if (!plugin.signature) {
        this.logger.warn('Plugin has no signature');
        this.auditService.auditActivity({
          pluginId: plugin.name ?? plugin.manifest?.name ?? 'unknown',
          action: 'signature:validation:failed',
          timestamp: new Date(),
          metadata: { reason: 'No signature provided' },
        });
        return false;
      }

      // Calculate checksum of plugin files
      const calculatedChecksum = this.calculatePluginChecksum(plugin);

      if (calculatedChecksum !== plugin.checksum) {
        this.logger.error('Plugin checksum mismatch');
        this.auditService.auditActivity({
          pluginId: plugin.name ?? plugin.manifest?.name ?? 'unknown',
          action: 'signature:validation:failed',
          timestamp: new Date(),
          metadata: { reason: 'Checksum mismatch', expected: plugin.checksum, actual: calculatedChecksum },
        });
        return false;
      }

      // Verify digital signature
      const isValidSignature = await this.verifyDigitalSignature(plugin.checksum, plugin.signature);

      if (!isValidSignature) {
        this.logger.error('Invalid plugin signature');
        this.auditService.auditActivity({
          pluginId: plugin.name ?? plugin.manifest?.name ?? 'unknown',
          action: 'signature:validation:failed',
          timestamp: new Date(),
          metadata: { reason: 'Invalid digital signature' },
        });
        return false;
      }

      this.logger.debug('Plugin signature validation successful');
      this.auditService.auditActivity({
        pluginId: plugin.name ?? plugin.manifest?.name ?? 'unknown',
        action: 'signature:validation:success',
        timestamp: new Date(),
        metadata: { checksum: calculatedChecksum },
      });

      return true;
    } catch (error) {
      this.logger.error('Plugin signature validation failed:', error);
      this.auditService.auditActivity({
        pluginId: plugin.name ?? plugin.manifest?.name ?? 'unknown',
        action: 'signature:validation:error',
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
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

  /**
   * Check plugin permissions for a specific resource and action
   */
  checkPermissions(pluginId: string, resource: SecurityResourceType | string, action: SecurityAction | string): boolean {
    try {
      // First check authentication
      const session = this.authService.getSession(pluginId);
      if (!session) {
        this.logger.warn(`No active session found for plugin: ${pluginId}`);
        this.auditService.auditActivity({
          pluginId,
          action: `permission:${resource}:${action}:denied`,
          timestamp: new Date(),
          metadata: { reason: 'No active session', resource, action },
        });
        return false;
      }

      // Check authorization
      const hasPermission = this.authService.hasPermission(pluginId, resource, action);

      // Audit the permission check
      this.auditService.auditActivity({
        pluginId,
        action: `permission:${resource}:${action}`,
        timestamp: new Date(),
        metadata: {
          resource,
          action,
          granted: hasPermission,
          sessionId: session.id,
        },
      });

      if (!hasPermission) {
        this.logger.warn(`Permission denied for ${pluginId}: ${resource}:${action}`);
        this.eventEmitter.emit('plugin.permission.denied', {
          pluginId,
          resource,
          action,
          sessionId: session.id,
          timestamp: new Date(),
        });
      }

      return hasPermission;
    } catch (error) {
      this.logger.error(`Permission check failed for ${pluginId}:`, error);
      this.auditService.auditActivity({
        pluginId,
        action: `permission:${resource}:${action}:error`,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
      return false;
    }
  }

  /**
   * Create security context for a plugin
   */
  createSecurityContext(pluginId: string, permissions: PluginPermissions, resourceLimits?: ResourceLimits): SecurityContext {
    // Input validation
    if (!pluginId?.trim()) {
      throw new Error('Plugin ID is required for security context creation');
    }

    if (!permissions || typeof permissions !== 'object') {
      throw new Error('Valid permissions object is required for security context creation');
    }

    if (this.securityContexts.has(pluginId)) {
      this.logger.warn(`Security context already exists for plugin: ${pluginId}, replacing...`);
    }

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

      this.auditService.auditActivity({
        pluginId,
        action: 'security:context:created',
        timestamp: new Date(),
        metadata: {
          permissions: Object.keys(permissions),
          isolation: context.isolation,
          resourceLimits: context.resourceLimits,
        },
      });

      this.logger.debug(`Security context created for plugin: ${pluginId}`);

      this.eventEmitter.emit('plugin.security.context.created', {
        pluginId,
        permissions: Object.keys(permissions),
        isolation: context.isolation,
        timestamp: new Date(),
      });

      return context;
    } catch (error) {
      this.logger.error(`Failed to create security context for ${pluginId}:`, error);
      this.auditService.auditActivity({
        pluginId,
        action: 'security:context:creation:failed',
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  }

  /**
   * Destroy security context for a plugin
   */
  destroySecurityContext(pluginId: string): void {
    try {
      const context = this.securityContexts.get(pluginId);
      if (!context) {
        this.logger.warn(`Security context not found for plugin: ${pluginId}`);
        return;
      }

      this.securityContexts.delete(pluginId);
      this.rateLimits.delete(pluginId);

      // Logout from auth service
      this.authService.logout(pluginId);

      this.auditService.auditActivity({
        pluginId,
        action: 'security:context:destroyed',
        timestamp: new Date(),
        metadata: { isolation: context.isolation },
      });

      this.logger.debug(`Security context destroyed for plugin: ${pluginId}`);

      this.eventEmitter.emit('plugin.security.context.destroyed', {
        pluginId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to destroy security context for ${pluginId}:`, error);
    }
  }

  /**
   * Audit plugin activity (delegated to audit service)
   */
  auditPluginActivity(activity: PluginActivity): void {
    this.auditService.auditActivity(activity);
  }

  /**
   * Enforce rate limiting for plugin operations
   */
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

        this.auditService.auditActivity({
          pluginId,
          action: 'rate_limit:exceeded',
          timestamp: new Date(),
          metadata: {
            operation,
            currentCount,
            limit,
            rateLimitExceeded: true,
          },
        });

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

  /**
   * Get plugin activity log (delegated to audit service)
   */
  getPluginActivityLog(pluginId: string, limit = 100, offset = 0): PluginActivity[] {
    return this.auditService.getPluginActivityLog(pluginId, { limit, offset });
  }

  /**
   * Get all activity logs (delegated to audit service)
   */
  getAllActivityLog(limit = 100, offset = 0): PluginActivity[] {
    return this.auditService.getAllActivityLogs({ limit, offset });
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

  /**
   * Generate security report (delegated to audit service with additional context)
   */
  generateSecurityReport(pluginId?: string): SecurityReport {
    try {
      const report = this.auditService.generateSecurityReport({ pluginId });

      // Add security context information
      report.totalPlugins = this.securityContexts.size;

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
        // Get all plugins with security contexts
        report.plugins = Array.from(this.securityContexts.entries()).map(([id, context]) => ({
          pluginId: id,
          permissions: context.permissions,
          isolation: context.isolation,
          resourceLimits: context.resourceLimits,
        }));
      }

      return report;
    } catch (error) {
      this.logger.error('Failed to generate security report:', error);
      throw error;
    }
  }
}
