import { Injectable, Logger } from '@nestjs/common';

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  inherits?: string[];
}

/**
 * Authorization service providing role-based access control
 */
@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);
  private readonly permissions = new Map<string, Permission>();
  private readonly roles = new Map<string, Role>();
  private readonly userRoles = new Map<string, string[]>();
  private isInitialized = false;

  async initialize(): Promise<void> {
    await this.setupDefaultRolesAndPermissions();
    this.isInitialized = true;
    this.logger.log('Authorization service initialized');
  }

  async authorize(context: { userId: string; resource: string; action: string; pluginId?: string }): Promise<{ authorized: boolean; reason?: string }> {
    try {
      const userPermissions = await this.getUserPermissions(context.userId);
      const required = `${context.resource}:${context.action}`;

      const hasPermission = userPermissions.some((permission) => permission === required || permission === `${context.resource}:*` || permission === '*:*');

      return {
        authorized: hasPermission,
        reason: hasPermission ? undefined : `Missing permission: ${required}`,
      };
    } catch (error) {
      this.logger.error('Authorization error:', error);
      return { authorized: false, reason: 'Authorization failed' };
    }
  }

  getUserRoles(userId: string): Promise<string[]> {
    return Promise.resolve(this.userRoles.get(userId) ?? []);
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const userRoles = await this.getUserRoles(userId);
    const permissions = new Set<string>();

    for (const roleName of userRoles) {
      const role = Array.from(this.roles.values()).find((r) => r.name === roleName);
      if (role) {
        role.permissions.forEach((p) => permissions.add(p));
      }
    }

    return Array.from(permissions);
  }

  assignRoleToUser(userId: string, roleName: string): Promise<boolean> {
    try {
      const currentRoles = this.userRoles.get(userId) ?? [];
      if (!currentRoles.includes(roleName)) {
        currentRoles.push(roleName);
        this.userRoles.set(userId, currentRoles);
      }
      return Promise.resolve(true);
    } catch (error) {
      this.logger.error('Role assignment error:', error);
      return Promise.resolve(false);
    }
  }

  getStatistics(): Promise<any> {
    return Promise.resolve({
      totalRoles: this.roles.size,
      totalPermissions: this.permissions.size,
      totalUserAssignments: this.userRoles.size,
    });
  }

  private setupDefaultRolesAndPermissions(): Promise<void> {
    // Setup default permissions
    const defaultPermissions = [
      { id: '1', name: 'Read Plugins', resource: 'plugin', action: 'read' },
      { id: '2', name: 'Write Plugins', resource: 'plugin', action: 'write' },
      { id: '3', name: 'Admin All', resource: '*', action: '*' },
    ];

    defaultPermissions.forEach((p) => this.permissions.set(p.id, p));

    // Setup default roles
    const defaultRoles = [
      { id: '1', name: 'user', permissions: ['plugin:read'] },
      { id: '2', name: 'admin', permissions: ['*:*'] },
    ];

    defaultRoles.forEach((r) => this.roles.set(r.id, r));

    // Assign admin role to admin user
    this.userRoles.set('admin', ['admin']);
    this.userRoles.set('testuser', ['user']);
    return Promise.resolve();
  }

  isHealthy(): Promise<boolean> {
    return Promise.resolve(this.isInitialized);
  }

  shutdown(): Promise<void> {
    this.isInitialized = false;
    this.logger.log('Authorization service shut down');
    return Promise.resolve();
  }
}
