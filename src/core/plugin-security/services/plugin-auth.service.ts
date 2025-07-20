import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import type { PluginPermissions, SecurityAction, SecurityResourceType } from '@types';

/**
 * Service responsible for plugin authentication and authorization
 */
@Injectable()
export class PluginAuthService {
  private readonly logger = new Logger(PluginAuthService.name);
  private readonly authTokens = new Map<string, AuthToken>();
  private readonly sessionMap = new Map<string, PluginSession>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Authenticate a plugin and create a session
   */
  authenticatePlugin(pluginId: string, credentials: PluginCredentials): AuthenticationResult {
    try {
      this.logger.debug(`Authenticating plugin: ${pluginId}`);

      // Validate credentials
      const isValid = this.validateCredentials(pluginId, credentials);
      if (!isValid) {
        this.logger.warn(`Authentication failed for plugin: ${pluginId}`);

        this.eventEmitter.emit('plugin.auth.failed', {
          pluginId,
          reason: 'Invalid credentials',
          timestamp: new Date(),
        });

        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Create auth token
      const token = this.generateAuthToken(pluginId);

      // Create session
      const session = this.createSession(pluginId, token);

      this.authTokens.set(token, {
        pluginId,
        token,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        permissions: credentials.permissions ?? {},
      });

      this.sessionMap.set(pluginId, session);

      this.eventEmitter.emit('plugin.auth.success', {
        pluginId,
        sessionId: session.id,
        timestamp: new Date(),
      });

      this.logger.log(`Plugin authenticated successfully: ${pluginId}`);

      return {
        success: true,
        token,
        sessionId: session.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    } catch (error) {
      this.logger.error(`Authentication error for plugin ${pluginId}:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Validate authentication token
   */
  validateToken(token: string): TokenValidationResult {
    try {
      const authToken = this.authTokens.get(token);

      if (!authToken) {
        return {
          valid: false,
          reason: 'Token not found',
        };
      }

      if (authToken.expiresAt < new Date()) {
        this.authTokens.delete(token);
        this.sessionMap.delete(authToken.pluginId);

        return {
          valid: false,
          reason: 'Token expired',
        };
      }

      return {
        valid: true,
        pluginId: authToken.pluginId,
        permissions: authToken.permissions,
      };
    } catch (error) {
      this.logger.error('Token validation error:', error);
      return {
        valid: false,
        reason: 'Validation error',
      };
    }
  }

  /**
   * Check if plugin has specific permission
   */
  hasPermission(pluginId: string, resource: SecurityResourceType | string, action: SecurityAction | string): boolean {
    try {
      const session = this.sessionMap.get(pluginId);
      if (!session) {
        this.logger.warn(`No session found for plugin: ${pluginId}`);
        return false;
      }

      const token = this.authTokens.get(session.token);
      if (!token) {
        this.logger.warn(`No token found for plugin: ${pluginId}`);
        return false;
      }

      return this.evaluatePermission(token.permissions, resource, action);
    } catch (error) {
      this.logger.error(`Permission check error for ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Revoke authentication token
   */
  revokeToken(token: string): boolean {
    try {
      const authToken = this.authTokens.get(token);
      if (!authToken) {
        return false;
      }

      this.authTokens.delete(token);
      this.sessionMap.delete(authToken.pluginId);

      this.eventEmitter.emit('plugin.auth.revoked', {
        pluginId: authToken.pluginId,
        token,
        timestamp: new Date(),
      });

      this.logger.log(`Token revoked for plugin: ${authToken.pluginId}`);
      return true;
    } catch (error) {
      this.logger.error('Token revocation error:', error);
      return false;
    }
  }

  /**
   * Logout plugin and clean up session
   */
  logout(pluginId: string): boolean {
    try {
      const session = this.sessionMap.get(pluginId);
      if (!session) {
        return false;
      }

      this.authTokens.delete(session.token);
      this.sessionMap.delete(pluginId);

      this.eventEmitter.emit('plugin.auth.logout', {
        pluginId,
        sessionId: session.id,
        timestamp: new Date(),
      });

      this.logger.log(`Plugin logged out: ${pluginId}`);
      return true;
    } catch (error) {
      this.logger.error(`Logout error for plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Get active session for plugin
   */
  getSession(pluginId: string): PluginSession | null {
    return this.sessionMap.get(pluginId) ?? null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): PluginSession[] {
    return Array.from(this.sessionMap.values());
  }

  /**
   * Clean up expired tokens and sessions
   */
  cleanupExpiredTokens(): void {
    try {
      const now = new Date();
      const expiredTokens: string[] = [];

      for (const [token, authToken] of this.authTokens.entries()) {
        if (authToken.expiresAt < now) {
          expiredTokens.push(token);
        }
      }

      for (const token of expiredTokens) {
        const authToken = this.authTokens.get(token);
        if (authToken) {
          this.authTokens.delete(token);
          this.sessionMap.delete(authToken.pluginId);

          this.logger.debug(`Cleaned up expired token for plugin: ${authToken.pluginId}`);
        }
      }

      if (expiredTokens.length > 0) {
        this.logger.log(`Cleaned up ${expiredTokens.length} expired tokens`);
      }
    } catch (error) {
      this.logger.error('Token cleanup error:', error);
    }
  }

  /**
   * Validate plugin credentials
   */
  private validateCredentials(pluginId: string, credentials: PluginCredentials): boolean {
    // In a real implementation, this would validate against a store
    // For now, we'll do basic validation

    switch (credentials.type) {
      case 'api-key':
        return this.validateApiKey(pluginId, credentials.apiKey);
      case 'certificate':
        return this.validateCertificate(pluginId, credentials.certificate);
      case 'token':
        return this.validateExternalToken(pluginId, credentials.token);
      default:
        return false;
    }
  }

  /**
   * Validate API key
   */
  private validateApiKey(pluginId: string, apiKey?: string): boolean {
    if (!apiKey) {
      return false;
    }

    // In a real implementation, this would check against a secure store
    // For now, we'll do basic format validation
    return apiKey.length >= 32 && /^[a-zA-Z0-9]+$/.test(apiKey);
  }

  /**
   * Validate certificate
   */
  private validateCertificate(pluginId: string, certificate?: string): boolean {
    if (!certificate) {
      return false;
    }

    // In a real implementation, this would validate the certificate chain
    // For now, we'll do basic format validation
    return certificate.includes('-----BEGIN CERTIFICATE-----');
  }

  /**
   * Validate external token
   */
  private validateExternalToken(pluginId: string, token?: string): boolean {
    if (!token) {
      return false;
    }

    // In a real implementation, this would validate with external service
    // For now, we'll do basic format validation
    return token.length >= 16;
  }

  /**
   * Generate authentication token
   */
  private generateAuthToken(pluginId: string): string {
    const payload = {
      pluginId,
      timestamp: Date.now(),
      random: Math.random().toString(36),
    };

    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(payload));

    return `plugin_${hash.digest('hex')}`;
  }

  /**
   * Create plugin session
   */
  private createSession(pluginId: string, token: string): PluginSession {
    return {
      id: `session_${crypto.randomBytes(16).toString('hex')}`,
      pluginId,
      token,
      createdAt: new Date(),
      lastActivity: new Date(),
      active: true,
    };
  }

  /**
   * Evaluate permission for resource and action
   */
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
    if (resourcePermissions.includes('*')) {
      return true;
    }

    // Check for read/write hierarchies
    if (action === 'read' && resourcePermissions.includes('write')) {
      return true; // write permission implies read permission
    }

    return false;
  }
}

interface PluginCredentials {
  type: 'api-key' | 'certificate' | 'token';
  apiKey?: string;
  certificate?: string;
  token?: string;
  permissions?: PluginPermissions;
}

interface AuthenticationResult {
  success: boolean;
  token?: string;
  sessionId?: string;
  expiresAt?: Date;
  error?: string;
}

interface TokenValidationResult {
  valid: boolean;
  pluginId?: string;
  permissions?: PluginPermissions;
  reason?: string;
}

interface AuthToken {
  pluginId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  permissions: PluginPermissions;
}

interface PluginSession {
  id: string;
  pluginId: string;
  token: string;
  createdAt: Date;
  lastActivity: Date;
  active: boolean;
}
