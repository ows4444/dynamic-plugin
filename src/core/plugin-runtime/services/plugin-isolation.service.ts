import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IsolationOptions, IsolationResult, PluginInstance, ResourceUsage, SecurityContext } from '@types';

/**
 * Service responsible for plugin isolation and sandboxing
 */
@Injectable()
export class PluginIsolationService {
  private readonly logger = new Logger(PluginIsolationService.name);
  private readonly isolatedPlugins = new Map<string, IsolationContext>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Create an isolated execution environment for a plugin
   */
  createIsolatedEnvironment(plugin: PluginInstance, securityContext: SecurityContext, options: IsolationOptions = {}): IsolationResult {
    try {
      this.logger.debug(`Creating isolated environment for plugin: ${plugin.id}`);

      const isolationContext: IsolationContext = {
        pluginId: plugin.id,
        securityContext,
        options,
        createdAt: new Date(),
        resourceUsage: {
          memory: 0,
          cpu: 0,
          network: 0,
          filesystem: 0,
          processes: 0,
        },
        limits: {
          memory: securityContext.resourceLimits.memory,
          cpu: securityContext.resourceLimits.cpu,
          network: securityContext.resourceLimits.network,
          filesystem: securityContext.resourceLimits.filesystem,
          processes: 10,
        },
      };

      this.isolatedPlugins.set(plugin.id, isolationContext);

      // Set up resource monitoring
      if (options.enableResourceMonitoring !== false) {
        this.startResourceMonitoring(plugin.id);
      }

      this.eventEmitter.emit('plugin.isolation.created', {
        pluginId: plugin.id,
        isolation: securityContext.isolation,
        limits: isolationContext.limits,
        timestamp: new Date(),
      });

      return {
        success: true,
        pluginId: plugin.id,
        sandboxId: this.generateIsolationId(plugin.id),
        isolated: true,
        resourceUsage: {
          memory: 0,
          cpu: 0,
          network: 0,
          disk: 0,
          processes: 0,
        },
        violations: [],
      };
    } catch (error) {
      this.logger.error(`Failed to create isolated environment for ${plugin.id}:`, error);

      return {
        success: false,
        pluginId: plugin.id,
        isolated: false,
        resourceUsage: {
          memory: 0,
          cpu: 0,
          network: 0,
          disk: 0,
          processes: 0,
        },
        violations: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Destroy an isolated environment for a plugin
   */
  destroyIsolatedEnvironment(pluginId: string): void {
    try {
      const isolationContext = this.isolatedPlugins.get(pluginId);
      if (!isolationContext) {
        this.logger.warn(`No isolation context found for plugin: ${pluginId}`);
        return;
      }

      this.stopResourceMonitoring(pluginId);
      this.isolatedPlugins.delete(pluginId);

      this.eventEmitter.emit('plugin.isolation.destroyed', {
        pluginId,
        timestamp: new Date(),
      });

      this.logger.debug(`Destroyed isolated environment for plugin: ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to destroy isolated environment for ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Get resource usage for a plugin
   */
  getResourceUsage(pluginId: string): ResourceUsage | null {
    const isolationContext = this.isolatedPlugins.get(pluginId);
    return isolationContext?.resourceUsage ?? null;
  }

  /**
   * Check if an operation is allowed for a plugin
   */
  isOperationAllowed(pluginId: string, operation: string, resource?: string): boolean {
    const isolationContext = this.isolatedPlugins.get(pluginId);
    if (!isolationContext) {
      return false;
    }

    try {
      const { securityContext, options } = isolationContext;

      // Check general security context permissions
      if (!securityContext.permissions[resource as keyof typeof securityContext.permissions]) {
        return false;
      }

      // Additional checks based on operation and resource
      if (resource === 'filesystem' && operation === 'write') {
        return (securityContext.permissions.filesystem?.write?.length ?? 0) > 0;
      }

      if (resource === 'network' && operation === 'request') {
        return (securityContext.permissions.network?.outbound?.length ?? 0) > 0;
      }

      // Check against denied modules if specified
      if (options.deniedModules?.includes(operation)) {
        return false;
      }

      // Check against allowed modules if specified
      if (options.allowedModules && options.allowedModules.length > 0) {
        return options.allowedModules.includes(operation);
      }

      return true;
    } catch (error) {
      this.logger.error(`Operation allowance check failed for ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Start resource monitoring for a plugin
   */
  private startResourceMonitoring(pluginId: string): void {
    const isolationContext = this.isolatedPlugins.get(pluginId);
    if (!isolationContext) {
      return;
    }

    // Set up monitoring interval
    isolationContext.monitoringInterval = setInterval(() => {
      this.updateResourceUsage(pluginId);
    }, 5000); // Update every 5 seconds

    this.logger.debug(`Started resource monitoring for plugin: ${pluginId}`);
  }

  /**
   * Stop resource monitoring for a plugin
   */
  private stopResourceMonitoring(pluginId: string): void {
    const isolationContext = this.isolatedPlugins.get(pluginId);
    if (isolationContext?.monitoringInterval) {
      clearInterval(isolationContext.monitoringInterval);
      delete isolationContext.monitoringInterval;
      this.logger.debug(`Stopped resource monitoring for plugin: ${pluginId}`);
    }
  }

  /**
   * Update resource usage metrics for a plugin
   */
  private updateResourceUsage(pluginId: string): void {
    const isolationContext = this.isolatedPlugins.get(pluginId);
    if (!isolationContext) {
      return;
    }

    try {
      // In a real implementation, this would collect actual metrics
      // For now, we'll simulate some basic metrics
      const currentUsage = {
        memory: Math.random() * isolationContext.limits.memory * 0.8,
        cpu: Math.random() * isolationContext.limits.cpu * 0.6,
        network: Math.random() * isolationContext.limits.network * 0.4,
        filesystem: Math.random() * isolationContext.limits.filesystem * 0.3,
        processes: Math.floor(Math.random() * isolationContext.limits.processes * 0.5),
      };

      isolationContext.resourceUsage = currentUsage;

      // Check for limit violations
      this.checkResourceLimits(pluginId, currentUsage, isolationContext.limits);
    } catch (error) {
      this.logger.error(`Failed to update resource usage for ${pluginId}:`, error);
    }
  }

  /**
   * Check if resource usage exceeds limits
   */
  private checkResourceLimits(pluginId: string, usage: ResourceUsage, limits: ResourceUsage): void {
    const violations: string[] = [];

    if ((usage.memory ?? 0) > (limits.memory ?? 0)) {
      violations.push(`Memory usage (${usage.memory}) exceeds limit (${limits.memory})`);
    }

    if ((usage.cpu ?? 0) > (limits.cpu ?? 0)) {
      violations.push(`CPU usage (${usage.cpu}) exceeds limit (${limits.cpu})`);
    }

    if ((usage.network ?? 0) > (limits.network ?? 0)) {
      violations.push(`Network usage (${usage.network}) exceeds limit (${limits.network})`);
    }

    if ((usage.disk ?? 0) > (limits.disk ?? 0)) {
      violations.push(`Disk usage (${usage.disk}) exceeds limit (${limits.disk})`);
    }

    if ((usage.processes ?? 0) > (limits.processes ?? 0)) {
      violations.push(`Process count (${usage.processes}) exceeds limit (${limits.processes})`);
    }

    if (violations.length > 0) {
      this.logger.warn(`Resource limit violations for ${pluginId}:`, violations);

      this.eventEmitter.emit('plugin.resource.violation', {
        pluginId,
        violations,
        usage,
        limits,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Generate a unique isolation ID
   */
  private generateIsolationId(pluginId: string): string {
    return `isolation_${pluginId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine security level based on context
   */
  private determineSecurityLevel(securityContext: SecurityContext): string {
    if (securityContext.isolation) {
      return 'high';
    }

    const hasRestrictivePermissions = Object.values(securityContext.permissions).some((perm) => Array.isArray(perm) && perm.length === 0);

    return hasRestrictivePermissions ? 'medium' : 'low';
  }
}

/**
 * Isolation context for tracking plugin isolation state
 */
interface IsolationContext {
  pluginId: string;
  securityContext: SecurityContext;
  options: IsolationOptions;
  createdAt: Date;
  resourceUsage: LocalResourceUsage;
  limits: LocalResourceUsage;
  monitoringInterval?: NodeJS.Timeout;
}

interface LocalResourceUsage {
  memory: number;
  cpu: number;
  network: number;
  filesystem: number;
  processes: number;
}
