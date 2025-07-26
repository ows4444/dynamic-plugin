import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { getErrorMessage } from '../../../../libs/shared/common/src';

export interface TokenInfo {
  id: string;
  userId?: string;
  permissions: string[];
  expiresAt?: Date;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

export interface CreateTokenDto {
  userId?: string;
  permissions: string[];
  expiresIn?: number; // milliseconds
  description?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly tokens = new Map<string, TokenInfo>();
  private readonly tokenSecrets = new Map<string, string>();

  constructor() {
    this.createDefaultTokens();
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      // Use constant-time comparison to prevent timing attacks
      let tokenInfo: TokenInfo | undefined;
      let isValidToken = false;
      
      for (const [storedToken, info] of this.tokens.entries()) {
        if (this.constantTimeCompare(token, storedToken)) {
          tokenInfo = info;
          isValidToken = true;
          break;
        }
      }

      if (!isValidToken || !tokenInfo) {
        // Add artificial delay to prevent timing attacks
        await this.artificialDelay();
        return false;
      }

      if (!tokenInfo.isActive) {
        return false;
      }

      if (tokenInfo.expiresAt && new Date() > tokenInfo.expiresAt) {
        tokenInfo.isActive = false;
        this.logger.warn(`Token expired: ${tokenInfo.id}`);
        return false;
      }

      // Update last used timestamp
      tokenInfo.lastUsed = new Date();

      return Promise.resolve(true);

    } catch (error) {
      const errorMessage = getErrorMessage(error, 'Unknown token validation error');
      this.logger.error(`Token validation failed: ${errorMessage}`);
      return Promise.resolve(false);
    }
  }

  async getTokenInfo(token: string): Promise<TokenInfo | null> {
    return Promise.resolve(this.tokens.get(token) ?? null ) ;
  }

  async createToken(
    createDto: CreateTokenDto,
  ): Promise<{ token: string; tokenInfo: TokenInfo }> {
    const token = this.generateToken();
    const tokenId = this.generateTokenId();

    const expiresAt = (createDto.expiresIn != null)
      ? new Date(Date.now() + createDto.expiresIn)
      : undefined;

    const tokenInfo: TokenInfo = {
      id: tokenId,
      userId: createDto.userId ?? 'anonymous',
      permissions: [...createDto.permissions],
      expiresAt: expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default to 1 year
      createdAt: new Date(),
      isActive: true,
    };

    this.tokens.set(token, tokenInfo);

    this.logger.log(
      `Created token: ${tokenId} for user: ${createDto.userId ?? 'anonymous'}`,
    );

    return Promise.resolve({ token, tokenInfo });
  }

  async revokeToken(token: string): Promise<boolean> {
    const tokenInfo = this.tokens.get(token);

    if (!tokenInfo) {
      return Promise.resolve(false);
    }

    tokenInfo.isActive = false;
    this.logger.log(`Revoked token: ${tokenInfo.id}`);

    return Promise.resolve(true);
  }

  async revokeAllUserTokens(userId: string): Promise<number> {
    let revokedCount = 0;

    for (const [_token, tokenInfo] of this.tokens.entries()) {
      if (tokenInfo.userId === userId && tokenInfo.isActive) {
        tokenInfo.isActive = false;
        revokedCount++;
      }
    }

    this.logger.log(`Revoked ${revokedCount} tokens for user: ${userId}`);
    return Promise.resolve(revokedCount) ;
  }

  async hasPermission(token: string, permission: string): Promise<boolean> {
    const tokenInfo = this.tokens.get(token);

    if (tokenInfo?.isActive !== true) {
      return false;
    }

    if (tokenInfo.permissions.includes('*')) {
      return true;
    }

    return Promise.resolve( tokenInfo.permissions.includes(permission)) ;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [_token, tokenInfo] of this.tokens.entries()) {
      if (tokenInfo.expiresAt && now > tokenInfo.expiresAt) {
        tokenInfo.isActive = false;
        cleanedCount++;
      }
    }

    // Remove inactive tokens older than 30 days
    const cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const [token, tokenInfo] of this.tokens.entries()) {
      if (!tokenInfo.isActive && tokenInfo.createdAt < cutoffDate) {
        this.tokens.delete(token);
        this.tokenSecrets.delete(token);
        cleanedCount++;
      }
    }

    if (cleanedCount> 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired/inactive tokens`);
    }

    return Promise.resolve(cleanedCount) ;
  }

  async getTokenStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    byPermission: Record<string, number>;
    recentlyUsed: number;
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    let active = 0;
    let expired = 0;
    let recentlyUsed = 0;
    const byPermission: Record<string, number> = {};

    for (const tokenInfo of this.tokens.values()) {
      if (tokenInfo.isActive) {
        if (tokenInfo.expiresAt && now > tokenInfo.expiresAt) {
          expired++;
        } else {
          active++;
        }
      } else {
        expired++;
      }

      if (tokenInfo.lastUsed && tokenInfo.lastUsed > oneHourAgo) {
        recentlyUsed++;
      }

      for (const permission of tokenInfo.permissions) {
        byPermission[permission] = (byPermission[permission] ?? 0) + 1;
      }
    }

    return Promise.resolve({
      total: this.tokens.size,
      active,
      expired,
      byPermission,
      recentlyUsed,
    });
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateTokenId(): string {
    // Use cryptographically secure random ID
    return `token-${crypto.randomUUID()}`;
  }

  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  private async artificialDelay(): Promise<void> {
    // Random delay between 1-5ms to prevent timing attacks
    const delay = Math.floor(Math.random() * 4) + 1;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private createDefaultTokens(): void {
    // Only create default tokens in development with secure values required
    if (process.env['NODE_ENV'] === 'development') {
      const adminToken = process.env['ADMIN_TOKEN'];
      
      if (!adminToken || adminToken === 'dev-admin-token') {
        this.logger.error('ADMIN_TOKEN environment variable must be set to a secure value');
        throw new Error('Secure ADMIN_TOKEN required even in development');
      }

      const tokenInfo: TokenInfo = {
        id: 'admin-token',
        userId: 'admin',
        permissions: ['*'], // All permissions
        createdAt: new Date(),
        isActive: true,
      };

      this.tokens.set(adminToken, tokenInfo);
      this.logger.log('Created admin token from environment variable');
    }

    // Read-only token also requires secure value
    const readToken = process.env['READ_TOKEN'];
    
    if (readToken && readToken !== 'read-only-token') {
      const readTokenInfo: TokenInfo = {
        id: 'read-token',
        permissions: ['plugins.read', 'stats.read', 'download'],
        createdAt: new Date(),
        isActive: true,
      };

      this.tokens.set(readToken, readTokenInfo);
      this.logger.log('Created read-only token from environment variable');
    } else if (process.env['NODE_ENV'] !== 'test') {
      this.logger.warn('READ_TOKEN not provided or using default value - read-only access disabled');
    }
  }
}
