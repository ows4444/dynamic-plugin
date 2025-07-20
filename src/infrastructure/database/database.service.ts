import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConnectionManagerService } from './connection-manager.service';

/**
 * Main database service providing unified access to multiple database providers
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private initialized = false;

  constructor(private readonly connectionManager: ConnectionManagerService) {}

  /**
   * Initialize database connections
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.log('Initializing database connections...');

      await this.connectionManager.initializeConnections();

      this.initialized = true;
      this.logger.log('Database initialization completed successfully');
    } catch (error) {
      this.logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Execute SQL query on primary database
   */
  async query<T = any>(sql: string, params?: unknown[]): Promise<T[]> {
    const connection = await this.connectionManager.getPrimaryConnection();
    return connection.query<T>(sql, params);
  }

  /**
   * Execute query within a transaction
   */
  async transaction<T>(fn: (trx: DatabaseTransaction) => Promise<T>): Promise<T> {
    const connection = await this.connectionManager.getPrimaryConnection();
    return connection.transaction(fn);
  }

  /**
   * Get connection for specific database
   */
  getConnection(name: string): Promise<DatabaseConnection> {
    return this.connectionManager.getConnection(name);
  }

  /**
   * Check database health
   */
  async checkHealth(): Promise<DatabaseHealthStatus> {
    try {
      const connections = await this.connectionManager.getAllConnections();
      const healthChecks = await Promise.allSettled(
        connections.map(async (conn) => ({
          name: conn.name,
          status: await conn.checkHealth(),
        })),
      );

      const results = healthChecks.map((check, index) => ({
        name: connections[index].name,
        healthy: check.status === 'fulfilled' && typeof check.value === 'object' && check.value !== null && 'status' in check.value && (check.value.status as unknown as boolean) === true,
        error: check.status === 'rejected' ? check.reason?.message : undefined,
      }));

      return {
        overall: results.every((r) => r.healthy),
        connections: results,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        overall: false,
        connections: [],
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<DatabaseStatistics> {
    try {
      const connections = await this.connectionManager.getAllConnections();
      const stats = await Promise.all(
        connections.map(async (conn) => {
          const stats = await conn.getStatistics();
          return {
            connectionName: conn.name,
            ...stats,
          };
        }),
      );

      return {
        totalConnections: connections.length,
        activeConnections: stats.filter((s) => s.connected).length,
        connectionStats: stats,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get database statistics:', error);
      throw error;
    }
  }

  /**
   * Close all database connections
   */
  async onModuleDestroy(): Promise<void> {
    try {
      this.logger.log('Closing database connections...');
      await this.connectionManager.closeAllConnections();
      this.initialized = false;
      this.logger.log('Database connections closed successfully');
    } catch (error) {
      this.logger.error('Error closing database connections:', error);
    }
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

export interface DatabaseConnection {
  name: string;
  type: string;
  query<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (trx: DatabaseTransaction) => Promise<T>): Promise<T> | T;
  checkHealth(): Promise<{ status: boolean; latency?: number }> | { status: boolean };
  getStatistics(): Promise<ConnectionStatistics> | ConnectionStatistics;
  close(): Promise<void> | void;
}

export interface DatabaseTransaction {
  query<T = any>(sql: string, params?: unknown[]): Promise<T[]> | T[];
  commit(): Promise<void> | void;
  rollback(): Promise<void> | void;
}

export interface DatabaseHealthStatus {
  overall: boolean;
  connections: Array<{
    name: string;
    healthy: boolean;
    error?: string;
  }>;
  timestamp: Date;
  error?: string;
}

export interface DatabaseStatistics {
  totalConnections: number;
  activeConnections: number;
  connectionStats: ConnectionStatistics[];
  timestamp: Date;
}

export interface ConnectionStatistics {
  name: string;
  connected: boolean;
  activeQueries: number;
  totalQueries: number;
  averageQueryTime: number;
  lastActivity: Date;
  poolSize?: number;
  poolUsage?: number;
}
