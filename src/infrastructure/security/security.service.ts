import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { AuthorizationService } from './authorization.service';
import { EncryptionService } from './encryption.service';
import { AuditService } from './audit.service';
import { ConfigService } from '../config/config.service';

export interface SecurityConfiguration {
  enableAuthentication: boolean;
  enableAuthorization: boolean;
  enableEncryption: boolean;
  enableAuditing: boolean;
  sessionTimeout: number;
  maxFailedAttempts: number;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  encryptionAlgorithm: string;
  hashAlgorithm: string;
}

export interface SecurityContext {
  userId?: string;
  sessionId?: string;
  roles: string[];
  permissions: string[];
  ipAddress?: string;
  userAgent?: string;
  lastActivity: Date;
  isAuthenticated: boolean;
  isAuthorized: boolean;
}

/**
 * Central security service coordinating all security components
 * Provides unified interface for authentication, authorization, encryption, and auditing
 */
@Injectable()
export class SecurityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SecurityService.name);
  private readonly config: SecurityConfiguration;
  private isInitialized = false;

  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly authorizationService: AuthorizationService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {
    this.config = {
      enableAuthentication: this.configService.get('SECURITY_ENABLE_AUTH', true),
      enableAuthorization: this.configService.get('SECURITY_ENABLE_AUTHZ', true),
      enableEncryption: this.configService.get('SECURITY_ENABLE_ENCRYPTION', true),
      enableAuditing: this.configService.get('SECURITY_ENABLE_AUDITING', true),
      sessionTimeout: this.configService.get('SECURITY_SESSION_TIMEOUT', 24 * 60 * 60 * 1000), // 24 hours
      maxFailedAttempts: this.configService.get('SECURITY_MAX_FAILED_ATTEMPTS', 5),
      passwordPolicy: {
        minLength: this.configService.get('SECURITY_PASSWORD_MIN_LENGTH', 8),
        requireUppercase: this.configService.get('SECURITY_PASSWORD_REQUIRE_UPPERCASE', true),
        requireLowercase: this.configService.get('SECURITY_PASSWORD_REQUIRE_LOWERCASE', true),
        requireNumbers: this.configService.get('SECURITY_PASSWORD_REQUIRE_NUMBERS', true),
        requireSpecialChars: this.configService.get('SECURITY_PASSWORD_REQUIRE_SPECIAL', true),
      },
      encryptionAlgorithm: this.configService.get('SECURITY_ENCRYPTION_ALGORITHM', 'aes-256-gcm'),
      hashAlgorithm: this.configService.get('SECURITY_HASH_ALGORITHM', 'sha256'),
    };
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.initializeSecurity();
      this.logger.log('Security service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize security service:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.shutdownSecurity();
      this.logger.log('Security service shut down successfully');
    } catch (error) {
      this.logger.error('Error during security service shutdown:', error);
    }
  }

  /**
   * Initialize security components
   */
  private async initializeSecurity(): Promise<void> {
    const initPromises: Array<Promise<void>> = [];

    if (this.config.enableAuthentication) {
      initPromises.push(this.authenticationService.initialize());
    }

    if (this.config.enableAuthorization) {
      initPromises.push(this.authorizationService.initialize());
    }

    if (this.config.enableEncryption) {
      this.encryptionService.initialize();
    }

    if (this.config.enableAuditing) {
      initPromises.push(this.auditService.initialize());
    }

    await Promise.allSettled(initPromises);
    this.isInitialized = true;
  }

  /**
   * Authenticate user with credentials
   */
  async authenticate(credentials: { username: string; password: string; ipAddress?: string; userAgent?: string }): Promise<AuthenticationResult> {
    if (!this.config.enableAuthentication) {
      return { success: false, error: 'Authentication disabled' };
    }

    try {
      const result = await this.authenticationService.authenticate(credentials);

      // Audit authentication attempt
      if (this.config.enableAuditing) {
        await this.auditService.logSecurityEvent({
          event: 'authentication_attempt',
          userId: credentials.username,
          success: result.success,
          ipAddress: credentials.ipAddress,
          userAgent: credentials.userAgent,
          details: { error: result.error },
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Authorize user action
   */
  async authorize(context: { userId: string; resource: string; action: string; pluginId?: string }): Promise<AuthorizationResult> {
    if (!this.config.enableAuthorization) {
      return { authorized: true };
    }

    try {
      const result = await this.authorizationService.authorize(context);

      // Audit authorization attempt
      if (this.config.enableAuditing) {
        await this.auditService.logSecurityEvent({
          event: 'authorization_check',
          userId: context.userId,
          success: result.authorized,
          details: {
            resource: context.resource,
            action: context.action,
            pluginId: context.pluginId,
            reason: result.reason,
          },
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Authorization error:', error);
      return { authorized: false, reason: 'Authorization failed' };
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(data: string, context?: string): Promise<string> {
    if (!this.config.enableEncryption) {
      this.logger.warn('Encryption disabled, returning plain text');
      return data;
    }

    try {
      return await this.encryptionService.encrypt(data, context);
    } catch (error) {
      this.logger.error('Encryption error:', error);
      throw error;
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encryptedData: string, context?: string): Promise<string> {
    if (!this.config.enableEncryption) {
      this.logger.warn('Encryption disabled, returning data as-is');
      return encryptedData;
    }

    try {
      return await this.encryptionService.decrypt(encryptedData, context);
    } catch (error) {
      this.logger.error('Decryption error:', error);
      throw error;
    }
  }

  /**
   * Hash password or sensitive data
   */
  hash(data: string, salt?: string): string {
    try {
      return this.encryptionService.hash(data, salt);
    } catch (error) {
      this.logger.error('Hashing error:', error);
      throw error;
    }
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hash: string): boolean {
    try {
      return this.encryptionService.verifyHash(data, hash);
    } catch (error) {
      this.logger.error('Hash verification error:', error);
      return false;
    }
  }

  /**
   * Validate password against policy
   */
  validatePassword(password: string): PasswordValidationResult {
    const policy = this.config.passwordPolicy;
    const errors: string[] = [];

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
      strength: this.calculatePasswordStrength(password),
    };
  }

  /**
   * Create security context for a user
   */
  async createSecurityContext(params: { userId: string; sessionId: string; ipAddress?: string; userAgent?: string }): Promise<SecurityContext> {
    try {
      const userRoles = this.config.enableAuthorization ? await this.authorizationService.getUserRoles(params.userId) : [];

      const userPermissions = this.config.enableAuthorization ? await this.authorizationService.getUserPermissions(params.userId) : [];

      const context: SecurityContext = {
        userId: params.userId,
        sessionId: params.sessionId,
        roles: userRoles,
        permissions: userPermissions,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        lastActivity: new Date(),
        isAuthenticated: true,
        isAuthorized: true,
      };

      // Audit context creation
      if (this.config.enableAuditing) {
        await this.auditService.logSecurityEvent({
          event: 'security_context_created',
          userId: params.userId,
          success: true,
          details: {
            sessionId: params.sessionId,
            roles: userRoles,
            permissionCount: userPermissions.length,
          },
        });
      }

      return context;
    } catch (error) {
      this.logger.error('Failed to create security context:', error);
      throw error;
    }
  }

  /**
   * Validate security context
   */
  validateSecurityContext(context: SecurityContext): boolean {
    try {
      // Check session timeout
      const now = new Date();
      const timeSinceLastActivity = now.getTime() - context.lastActivity.getTime();

      if (timeSinceLastActivity > this.config.sessionTimeout) {
        this.logger.warn(`Session timeout for user ${context.userId}`);
        return false;
      }

      // Validate authentication if enabled
      if (this.config.enableAuthentication && !context.isAuthenticated) {
        return false;
      }

      // Validate authorization if enabled
      if (this.config.enableAuthorization && !context.isAuthorized) {
        return false;
      }

      // Update last activity
      context.lastActivity = now;

      return true;
    } catch (error) {
      this.logger.error('Security context validation error:', error);
      return false;
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event: { event: string; userId?: string; success: boolean; ipAddress?: string; userAgent?: string; details?: Record<string, any> }): Promise<void> {
    if (!this.config.enableAuditing) {
      return;
    }

    try {
      await this.auditService.logSecurityEvent(event);
    } catch (error) {
      this.logger.error('Failed to log security event:', error);
    }
  }

  /**
   * Get security statistics
   */
  async getSecurityStatistics(): Promise<SecurityStatistics> {
    try {
      const stats: SecurityStatistics = {
        authentication: this.config.enableAuthentication ? await this.authenticationService.getStatistics() : null,
        authorization: this.config.enableAuthorization ? await this.authorizationService.getStatistics() : null,
        audit: this.config.enableAuditing ? await this.auditService.getStatistics() : null,
        configuration: this.config,
      };

      return stats;
    } catch (error) {
      this.logger.error('Failed to get security statistics:', error);
      throw error;
    }
  }

  /**
   * Calculate password strength score
   */
  private calculatePasswordStrength(password: string): number {
    let score = 0;

    // Length score
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;

    // Character variety score
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/\d/.test(password)) score += 10;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 15;

    // Pattern penalties
    if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated characters
    if (/123|abc|qwe/i.test(password)) score -= 10; // Common patterns

    // Complexity bonus
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) score += 15;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if security service is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const healthChecks: Array<Promise<boolean>> = [];

      if (this.config.enableAuthentication) {
        healthChecks.push(this.authenticationService.isHealthy());
      }

      if (this.config.enableAuthorization) {
        healthChecks.push(this.authorizationService.isHealthy());
      }

      if (this.config.enableEncryption) {
        this.encryptionService.isHealthy();
      }

      if (this.config.enableAuditing) {
        healthChecks.push(this.auditService.isHealthy());
      }

      const results = await Promise.allSettled(healthChecks);
      return results.every((result) => result.status === 'fulfilled' && result.value === true);
    } catch (error) {
      this.logger.error('Security health check failed:', error);
      return false;
    }
  }

  /**
   * Shutdown security gracefully
   */
  private async shutdownSecurity(): Promise<void> {
    const shutdownPromises: Array<Promise<void>> = [];

    if (this.config.enableAuthentication) {
      shutdownPromises.push(this.authenticationService.shutdown());
    }

    if (this.config.enableAuthorization) {
      shutdownPromises.push(this.authorizationService.shutdown());
    }

    if (this.config.enableEncryption) {
      this.encryptionService.shutdown();
    }

    if (this.config.enableAuditing) {
      shutdownPromises.push(this.auditService.shutdown());
    }

    await Promise.allSettled(shutdownPromises);
    this.isInitialized = false;
  }
}

export interface AuthenticationResult {
  success: boolean;
  userId?: string;
  sessionId?: string;
  token?: string;
  expiresAt?: Date;
  error?: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  requiredPermissions?: string[];
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: number;
}

export interface SecurityStatistics {
  authentication: any;
  authorization: any;
  audit: any;
  configuration: SecurityConfiguration;
}
