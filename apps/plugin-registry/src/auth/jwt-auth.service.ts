import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '@lib/shared/common';

export interface JwtPayload {
  sub: string; // subject (user ID)
  username?: string;
  permissions: string[];
  iat?: number; // issued at
  exp?: number; // expires at
  jti?: string; // JWT ID for tracking
}

export interface TokenInfo {
  id: string;
  userId: string;
  username?: string;
  permissions: string[];
  expiresAt: Date;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

export interface CreateTokenDto {
  userId: string;
  username?: string;
  permissions: string[];
  expiresIn?: string; // JWT format like '1h', '30m', '7d'
  description?: string;
}

@Injectable()
export class JwtAuthService {
  private readonly logger = new Logger(JwtAuthService.name);
  private readonly revokedTokens = new Set<string>();
  private readonly tokenUsage = new Map<string, Date>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfiguration>,
  ) {
    this.scheduleCleanup();
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const payload = await this.verifyToken(token);
      
      if (!payload) {
        return false;
      }

      // Check if token has been revoked
      if (this.revokedTokens.has(payload.jti || token)) {
        return false;
      }

      // Update last used timestamp
      this.tokenUsage.set(payload.jti || token, new Date());

      return true;
    } catch (error) {
      this.logger.warn(`Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async getTokenInfo(token: string): Promise<TokenInfo | null> {
    try {
      const payload = await this.verifyToken(token);
      
      if (!payload) {
        return null;
      }

      return {
        id: payload.jti || 'unknown',
        userId: payload.sub,
        username: payload.username,
        permissions: payload.permissions,
        expiresAt: new Date(payload.exp! * 1000),
        createdAt: new Date(payload.iat! * 1000),
        lastUsed: this.tokenUsage.get(payload.jti || token),
        isActive: !this.revokedTokens.has(payload.jti || token),
      };
    } catch (error) {
      this.logger.error(`Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async createToken(createDto: CreateTokenDto): Promise<{ token: string; tokenInfo: TokenInfo }> {
    const jti = this.generateTokenId();
    const expiresIn = createDto.expiresIn ?? this.configService.get('security.jwtExpiresIn', { infer: true }) ?? '1h';

    const payload: JwtPayload = {
      sub: createDto.userId,
      username: createDto.username,
      permissions: [...createDto.permissions],
      jti,
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn,
    });

    // Decode to get expiration time for TokenInfo
    const decoded = this.jwtService.decode(token) as JwtPayload;

    const tokenInfo: TokenInfo = {
      id: jti,
      userId: createDto.userId,
      username: createDto.username,
      permissions: [...createDto.permissions],
      expiresAt: new Date(decoded.exp! * 1000),
      createdAt: new Date(decoded.iat! * 1000),
      isActive: true,
    };

    this.logger.log(`Created JWT token: ${jti} for user: ${createDto.userId}`);

    return { token, tokenInfo };
  }

  async revokeToken(token: string): Promise<boolean> {
    try {
      const payload = await this.verifyToken(token);
      
      if (!payload) {
        return false;
      }

      const tokenId = payload.jti || token;
      this.revokedTokens.add(tokenId);
      this.tokenUsage.delete(tokenId);

      this.logger.log(`Revoked JWT token: ${payload.jti}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to revoke token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async revokeAllUserTokens(userId: string): Promise<number> {
    // Note: With JWTs, we can't easily revoke all tokens for a user
    // without maintaining a blacklist or changing the user's secret
    // This is a limitation of stateless JWTs
    this.logger.warn(`Cannot revoke all tokens for user ${userId} - JWT limitation`);
    return 0;
  }

  async hasPermission(token: string, permission: string): Promise<boolean> {
    try {
      const payload = await this.verifyToken(token);
      
      if (!payload) {
        return false;
      }

      // Check if token has been revoked
      if (this.revokedTokens.has(payload.jti || token)) {
        return false;
      }

      // Admin permission grants everything
      if (payload.permissions.includes('*')) {
        return true;
      }

      return payload.permissions.includes(permission);
    } catch (error) {
      this.logger.error(`Permission check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async refreshToken(token: string): Promise<{ token: string; tokenInfo: TokenInfo } | null> {
    try {
      const payload = await this.verifyToken(token);
      
      if (!payload) {
        return null;
      }

      // Check if token has been revoked
      if (this.revokedTokens.has(payload.jti || token)) {
        return null;
      }

      // Create a new token with the same payload but new expiration
      const createDto: CreateTokenDto = {
        userId: payload.sub,
        username: payload.username,
        permissions: payload.permissions,
      };

      // Revoke the old token
      if (payload.jti) {
        this.revokedTokens.add(payload.jti);
      }

      return this.createToken(createDto);
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async getTokenStats(): Promise<{
    total: number;
    active: number;
    revoked: number;
    recentlyUsed: number;
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    let recentlyUsed = 0;
    for (const lastUsed of this.tokenUsage.values()) {
      if (lastUsed > oneHourAgo) {
        recentlyUsed++;
      }
    }

    return {
      total: this.tokenUsage.size + this.revokedTokens.size,
      active: this.tokenUsage.size,
      revoked: this.revokedTokens.size,
      recentlyUsed,
    };
  }

  private async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      return payload;
    } catch (error) {
      if (error instanceof Error) {
        // Don't log expired tokens as errors, they're expected
        if (error.name === 'TokenExpiredError') {
          this.logger.debug('Token expired during verification');
        } else {
          this.logger.warn(`Token verification failed: ${error.message}`);
        }
      }
      return null;
    }
  }

  private generateTokenId(): string {
    return `jwt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private scheduleCleanup(): void {
    // Clean up expired token tracking data every hour
    setInterval(() => {
      this.cleanupExpiredData();
    }, 60 * 60 * 1000); // 1 hour
  }

  private cleanupExpiredData(): void {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Clean up old usage tracking data
    let cleanedUsage = 0;
    for (const [tokenId, lastUsed] of this.tokenUsage.entries()) {
      if (lastUsed.getTime() < oneWeekAgo) {
        this.tokenUsage.delete(tokenId);
        cleanedUsage++;
      }
    }

    // Clean up old revoked tokens (they're expired anyway)
    const initialRevokedSize = this.revokedTokens.size;
    // Note: We can't easily determine when revoked JWTs expire without decoding them
    // In a production system, you'd want to store revoked tokens with expiration timestamps

    if (cleanedUsage > 0) {
      this.logger.log(`Cleaned up ${cleanedUsage} old token usage records`);
    }
  }

  // Method to create default tokens for development
  async createDefaultTokens(): Promise<void> {
    try {
      // Create admin token for development
      if (this.configService.get('environment') === 'development') {
        const adminToken = await this.createToken({
          userId: 'admin',
          username: 'admin',
          permissions: ['*'],
          expiresIn: '24h',
          description: 'Development admin token',
        });

        this.logger.log('Created default admin JWT token for development');
        this.logger.log(`Admin token: ${adminToken.token}`);
      }

      // Create read-only token
      const readToken = await this.createToken({
        userId: 'readonly',
        username: 'readonly',
        permissions: ['plugins.read', 'stats.read', 'download'],
        expiresIn: '30d',
        description: 'Default read-only token',
      });

      this.logger.log('Created default read-only JWT token');
      this.logger.log(`Read token: ${readToken.token}`);
    } catch (error) {
      this.logger.error(`Failed to create default tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}