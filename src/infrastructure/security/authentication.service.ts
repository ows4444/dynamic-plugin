import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  roles: string[];
  isActive: boolean;
  lastLogin?: Date;
  failedAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface AuthenticationStatistics {
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  activeSessions: number;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  recentActivity: Array<{
    userId: string;
    username: string;
    lastLogin: Date;
  }>;
}

/**
 * Authentication service providing user authentication and session management
 * Handles login, logout, session validation, and user account security
 */
@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);
  private readonly users = new Map<string, User>();
  private readonly sessions = new Map<string, Session>();
  private readonly tokens = new Map<string, string>(); // token -> sessionId
  private isInitialized = false;
  private totalAttempts = 0;
  private successfulAttempts = 0;
  private failedAttempts = 0;

  /**
   * Initialize authentication service
   */
  initialize(): void {
    try {
      // Create default admin user for testing
      this.createDefaultUsers();

      this.isInitialized = true;
      this.logger.log('Authentication service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize authentication service:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with credentials
   */
  authenticate(credentials: { username: string; password: string; ipAddress?: string; userAgent?: string }): {
    success: boolean;
    userId?: string;
    sessionId?: string;
    token?: string;
    expiresAt?: Date;
    error?: string;
  } {
    if (!this.isInitialized) {
      throw new Error('Authentication service not initialized');
    }

    this.totalAttempts++;

    try {
      // Find user by username or email
      const user = this.findUserByUsernameOrEmail(credentials.username);

      if (!user) {
        this.failedAttempts++;
        this.logger.warn(`Authentication failed: User not found - ${credentials.username}`);
        return { success: false, error: 'Invalid credentials' };
      }

      // Check if user is active
      if (!user.isActive) {
        this.failedAttempts++;
        this.logger.warn(`Authentication failed: User inactive - ${user.username}`);
        return { success: false, error: 'Account deactivated' };
      }

      // Check if user is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        this.failedAttempts++;
        this.logger.warn(`Authentication failed: User locked - ${user.username}`);
        return { success: false, error: 'Account temporarily locked' };
      }

      // Verify password (mock implementation)
      const passwordValid = this.verifyPassword(credentials.password, user.passwordHash);

      if (!passwordValid) {
        this.failedAttempts++;
        user.failedAttempts++;

        // Lock account after too many failed attempts
        if (user.failedAttempts >= 5) {
          user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          this.logger.warn(`User account locked due to failed attempts - ${user.username}`);
        }

        this.logger.warn(`Authentication failed: Invalid password - ${user.username}`);
        return { success: false, error: 'Invalid credentials' };
      }

      // Successful authentication
      this.successfulAttempts++;
      user.failedAttempts = 0;
      user.lockedUntil = undefined;
      user.lastLogin = new Date();

      // Create session
      const session = this.createSession(user.id, credentials.ipAddress, credentials.userAgent);

      this.logger.log(`User authenticated successfully - ${user.username}`);

      return {
        success: true,
        userId: user.id,
        sessionId: session.id,
        token: session.token,
        expiresAt: session.expiresAt,
      };
    } catch (error) {
      this.failedAttempts++;
      this.logger.error('Authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Validate authentication token
   */
  validateToken(token: string): {
    valid: boolean;
    userId?: string;
    sessionId?: string;
    error?: string;
  } {
    try {
      const sessionId = this.tokens.get(token);
      if (!sessionId) {
        return { valid: false, error: 'Invalid token' };
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        this.tokens.delete(token);
        return { valid: false, error: 'Session not found' };
      }

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        this.invalidateSession(sessionId);
        return { valid: false, error: 'Session expired' };
      }

      // Update last activity
      session.lastActivity = new Date();

      return {
        valid: true,
        userId: session.userId,
        sessionId: session.id,
      };
    } catch (error) {
      this.logger.error('Token validation error:', error);
      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Logout user by invalidating session
   */
  logout(sessionId: string): boolean {
    try {
      return this.invalidateSession(sessionId);
    } catch (error) {
      this.logger.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Logout all sessions for a user
   */
  logoutAllSessions(userId: string): number {
    try {
      let invalidatedCount = 0;

      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.userId === userId) {
          this.invalidateSession(sessionId);
          invalidatedCount++;
        }
      }

      this.logger.log(`Invalidated ${invalidatedCount} sessions for user ${userId}`);
      return invalidatedCount;
    } catch (error) {
      this.logger.error('Logout all sessions error:', error);
      return 0;
    }
  }

  /**
   * Get user by ID
   */
  getUserById(userId: string): User | null {
    return this.users.get(userId) ?? null;
  }

  /**
   * Get user by username or email
   */
  getUserByUsernameOrEmail(usernameOrEmail: string): User | null {
    return this.findUserByUsernameOrEmail(usernameOrEmail);
  }

  /**
   * Create new user
   */
  createUser(userData: { username: string; email: string; password: string; roles?: string[] }): User {
    try {
      // Check if user already exists
      const existingUser = this.findUserByUsernameOrEmail(userData.username) ?? this.findUserByUsernameOrEmail(userData.email);

      if (existingUser) {
        throw new Error('User already exists');
      }

      const userId = this.generateUserId();
      const passwordHash = this.hashPassword(userData.password);

      const user: User = {
        id: userId,
        username: userData.username,
        email: userData.email,
        passwordHash,
        roles: userData.roles ?? ['user'],
        isActive: true,
        failedAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.users.set(userId, user);
      this.logger.log(`User created: ${user.username}`);

      return user;
    } catch (error) {
      this.logger.error('User creation error:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  updateUser(userId: string, updates: Partial<User>): User | null {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return null;
      }

      Object.assign(user, updates, { updatedAt: new Date() });
      this.logger.log(`User updated: ${user.username}`);

      return user;
    } catch (error) {
      this.logger.error('User update error:', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  deleteUser(userId: string): boolean {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return false;
      }

      // Invalidate all user sessions
      this.logoutAllSessions(userId);

      // Delete user
      this.users.delete(userId);
      this.logger.log(`User deleted: ${user.username}`);

      return true;
    } catch (error) {
      this.logger.error('User deletion error:', error);
      return false;
    }
  }

  /**
   * Get active sessions for a user
   */
  getUserSessions(userId: string): Session[] {
    const userSessions: Session[] = [];

    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.expiresAt > new Date()) {
        userSessions.push(session);
      }
    }

    return userSessions;
  }

  /**
   * Get authentication statistics
   */
  getStatistics(): AuthenticationStatistics {
    try {
      const totalUsers = this.users.size;
      const activeUsers = Array.from(this.users.values()).filter((user) => user.isActive).length;
      const lockedUsers = Array.from(this.users.values()).filter((user) => user.lockedUntil && user.lockedUntil > new Date()).length;

      const activeSessions = Array.from(this.sessions.values()).filter((session) => session.expiresAt > new Date()).length;

      const recentActivity = Array.from(this.users.values())
        .filter((user) => user.lastLogin)
        .sort((a, b) => (b.lastLogin?.getTime() ?? 0) - (a.lastLogin?.getTime() ?? 0))
        .slice(0, 10)
        .map((user) => ({
          userId: user.id,
          username: user.username,
          lastLogin: user.lastLogin!,
        }));

      return {
        totalUsers,
        activeUsers,
        lockedUsers,
        activeSessions,
        totalAttempts: this.totalAttempts,
        successfulAttempts: this.successfulAttempts,
        failedAttempts: this.failedAttempts,
        recentActivity,
      };
    } catch (error) {
      this.logger.error('Failed to get authentication statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    try {
      let cleanedCount = 0;
      const now = new Date();

      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.expiresAt < now) {
          this.invalidateSession(sessionId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} expired sessions`);
      }

      return cleanedCount;
    } catch (error) {
      this.logger.error('Session cleanup error:', error);
      return 0;
    }
  }

  /**
   * Create session for authenticated user
   */
  private createSession(userId: string, ipAddress?: string, userAgent?: string): Session {
    const sessionId = this.generateSessionId();
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const session: Session = {
      id: sessionId,
      userId,
      token,
      expiresAt,
      ipAddress,
      userAgent,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.tokens.set(token, sessionId);

    return session;
  }

  /**
   * Invalidate session
   */
  private invalidateSession(sessionId: string): boolean {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return false;
      }

      this.sessions.delete(sessionId);
      this.tokens.delete(session.token);

      return true;
    } catch (error) {
      this.logger.error('Session invalidation error:', error);
      return false;
    }
  }

  /**
   * Find user by username or email
   */
  private findUserByUsernameOrEmail(usernameOrEmail: string): User | null {
    for (const user of this.users.values()) {
      if (user.username === usernameOrEmail || user.email === usernameOrEmail) {
        return user;
      }
    }
    return null;
  }

  /**
   * Hash password (mock implementation)
   */
  private hashPassword(password: string): string {
    // In real implementation, use bcrypt or similar
    return `hashed_${password}_${Date.now()}`;
  }

  /**
   * Verify password (mock implementation)
   */
  private verifyPassword(password: string, hash: string): boolean {
    // In real implementation, use bcrypt.compare or similar
    return hash.includes(password);
  }

  /**
   * Generate unique user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Generate authentication token
   */
  private generateToken(): string {
    return `token_${Date.now()}_${randomBytes(32).toString('hex')}`;
  }

  /**
   * Create default users for testing
   */
  private createDefaultUsers(): void {
    try {
      // Create admin user
      this.createUser({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        roles: ['admin', 'user'],
      });

      // Create test user
      this.createUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'test123',
        roles: ['user'],
      });

      this.logger.log('Default users created');
    } catch (error) {
      this.logger.error('Failed to create default users:', error);
    }
  }

  /**
   * Check if authentication service is healthy
   */
  isHealthy(): boolean {
    return this.isInitialized;
  }

  /**
   * Shutdown authentication service
   */
  shutdown(): void {
    try {
      // Clear all sessions
      this.sessions.clear();
      this.tokens.clear();

      this.isInitialized = false;
      this.logger.log('Authentication service shut down');
    } catch (error) {
      this.logger.error('Error during authentication service shutdown:', error);
    }
  }
}
