import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '@lib/shared/common';

export interface PluginPermission {
  pluginName: string;
  permission: string;
  granted: boolean;
  grantedAt: Date;
  grantedBy?: string;
  expiresAt?: Date;
}

export interface SecurityPolicy {
  pluginName: string;
  allowedRoutes: string[];
  allowedMethods: string[];
  rateLimitPerMinute: number;
  allowNetworkAccess: boolean;
  allowFileSystem: boolean;
  allowDatabaseAccess: boolean;
  trustedPlugin: boolean;
}

export interface RateLimitInfo {
  pluginId: string;
  requests: number;
  windowStart: Date;
  windowEnd: Date;
}

@Injectable()
export class PluginSecurityService {
  private readonly logger = new Logger(PluginSecurityService.name);
  private readonly permissions = new Map<string, PluginPermission[]>();
  private readonly policies = new Map<string, SecurityPolicy>();
  private readonly rateLimits = new Map<string, RateLimitInfo>();
  private readonly windowSize = 60 * 1000; // 1 minute in milliseconds

  constructor() {
    this.setupDefaultPolicies();
  }

  async checkPermission(
    pluginName: string,
    resource: string,
    method: string,
  ): Promise<boolean> {
    try {
      const policy = this.policies.get(pluginName);
      if (!policy) {
        this.logger.warn(`No security policy found for plugin: ${pluginName}`);
        return false;
      }

      const hasRouteAccess = this.checkRouteAccess(policy, resource);
      if (!hasRouteAccess) {
        this.logger.warn(`Route access denied for ${pluginName}: ${resource}`);
        return false;
      }

      const hasMethodAccess = this.checkMethodAccess(policy, method);
      if (!hasMethodAccess) {
        this.logger.warn(`Method access denied for ${pluginName}: ${method}`);
        return false;
      }

      return Promise.resolve(true);
    } catch (error) {
      this.logger.error(`Permission check failed: ${getErrorMessage(error)}`);
      return Promise.resolve(false);
    }
  }

  grantPermission(
    pluginName: string,
    permission: string,
    grantedBy?: string,
    expiresAt?: Date,
  ): void {
    const pluginPermissions = this.permissions.get(pluginName) ?? [];

    const existingIndex = pluginPermissions.findIndex(
      (p) => p.permission === permission,
    );

    const newPermission: PluginPermission = {
      pluginName,
      permission,
      granted: true,
      grantedAt: new Date(),
      grantedBy,
      expiresAt,
    };

    if (existingIndex >= 0) {
      pluginPermissions[existingIndex] = newPermission;
    } else {
      pluginPermissions.push(newPermission);
    }

    this.permissions.set(pluginName, pluginPermissions);
    this.logger.log(
      `Granted permission '${permission}' to plugin '${pluginName}'`,
    );
  }

  revokePermission(pluginName: string, permission: string): void {
    const pluginPermissions = this.permissions.get(pluginName);
    if (!pluginPermissions) return;

    const filtered = pluginPermissions.filter(
      (p) => p.permission !== permission,
    );
    this.permissions.set(pluginName, filtered);

    this.logger.log(
      `Revoked permission '${permission}' from plugin '${pluginName}'`,
    );
  }

  setSecurityPolicy(pluginName: string, policy: Partial<SecurityPolicy>): void {
    const defaultPolicy = this.getDefaultPolicy(pluginName);
    const mergedPolicy = { ...defaultPolicy, ...policy };

    this.policies.set(pluginName, mergedPolicy);
    this.logger.log(`Updated security policy for plugin: ${pluginName}`);
  }

  getSecurityPolicy(pluginName: string): SecurityPolicy | undefined {
    return this.policies.get(pluginName);
  }

  isRateLimited(pluginId: string): boolean {
    const policy = this.findPolicyByPluginId(pluginId);
    if (!policy) return false;

    const rateLimitInfo = this.rateLimits.get(pluginId);
    const now = new Date();

    if (!rateLimitInfo) {
      this.rateLimits.set(pluginId, {
        pluginId,
        requests: 1,
        windowStart: now,
        windowEnd: new Date(now.getTime() + this.windowSize),
      });
      return false;
    }

    if (now > rateLimitInfo.windowEnd) {
      this.rateLimits.set(pluginId, {
        pluginId,
        requests: 1,
        windowStart: now,
        windowEnd: new Date(now.getTime() + this.windowSize),
      });
      return false;
    }

    rateLimitInfo.requests++;

    return rateLimitInfo.requests > policy.rateLimitPerMinute;
  }

  validatePluginCode(pluginCode: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (pluginCode.includes('require(')) {
      issues.push('Dynamic require() calls are not allowed');
    }

    if (pluginCode.includes('eval(')) {
      issues.push('eval() function is not allowed');
    }

    if (pluginCode.includes('Function(')) {
      issues.push('Function constructor is not allowed');
    }

    if (pluginCode.includes('child_process')) {
      issues.push('Child process execution is not allowed');
    }

    if (pluginCode.includes('fs.write') || pluginCode.includes('fs.unlink')) {
      issues.push('File system write operations require explicit permission');
    }

    const suspiciousPatterns = [
      /process\.env/g,
      /global\./g,
      /__dirname/g,
      /__filename/g,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(pluginCode)) {
        issues.push(`Potentially unsafe pattern detected: ${pattern.source}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  cleanupExpiredPermissions(): void {
    const now = new Date();
    let cleanupCount = 0;

    for (const [pluginName, permissions] of this.permissions.entries()) {
      const validPermissions = permissions.filter((p) => {
        if (p.expiresAt && p.expiresAt < now) {
          cleanupCount++;
          return false;
        }
        return true;
      });

      this.permissions.set(pluginName, validPermissions);
    }

    if (cleanupCount > 0) {
      this.logger.log(`Cleaned up ${cleanupCount} expired permissions`);
    }
  }

  private checkRouteAccess(policy: SecurityPolicy, resource: string): boolean {
    if (policy.trustedPlugin) return true;

    return policy.allowedRoutes.some((route) => {
      if (route === '*') return true;
      if (route.endsWith('/*')) {
        const prefix = route.slice(0, -2);
        return resource.startsWith(prefix);
      }
      return resource === route;
    });
  }

  private checkMethodAccess(policy: SecurityPolicy, method: string): boolean {
    if (policy.trustedPlugin) return true;

    return (
      policy.allowedMethods.includes('*') ||
      policy.allowedMethods.includes(method.toUpperCase())
    );
  }

  private findPolicyByPluginId(pluginId: string): SecurityPolicy | undefined {
    const pluginName = pluginId.split('-')[0];
    return this.policies.get(pluginName);
  }

  private getDefaultPolicy(pluginName: string): SecurityPolicy {
    return {
      pluginName,
      allowedRoutes: [`/plugins/${pluginName}/*`],
      allowedMethods: ['GET', 'POST'],
      rateLimitPerMinute: 60,
      allowNetworkAccess: false,
      allowFileSystem: false,
      allowDatabaseAccess: false,
      trustedPlugin: false,
    };
  }

  private setupDefaultPolicies(): void {
    this.setSecurityPolicy('default', {
      pluginName: 'default',
      allowedRoutes: ['/health', '/status'],
      allowedMethods: ['GET'],
      rateLimitPerMinute: 30,
      allowNetworkAccess: false,
      allowFileSystem: false,
      allowDatabaseAccess: false,
      trustedPlugin: false,
    });
  }
}
