import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseConnection } from './database.service';
import { PostgreSQLProvider } from './providers/postgresql.provider';
import { MongoDBProvider } from './providers/mongodb.provider';
import { RedisProvider } from './providers/redis.provider';
import type { DatabaseConfig } from '../config/config.service';

/**
 * Manages database connections across multiple providers
 */
@Injectable()
export class ConnectionManagerService {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private readonly connections = new Map<string, DatabaseConnection>();
  private readonly providers = new Map<string, DatabaseProvider>();

  constructor(
    @Inject('DATABASE_CONFIG') private readonly config: DatabaseConfig,
    private readonly postgresProvider: PostgreSQLProvider,
    private readonly mongoProvider: MongoDBProvider,
    private readonly redisProvider: RedisProvider,
  ) {
    this.registerProviders();
  }

  /**
   * Register available database providers
   */
  private registerProviders(): void {
    this.providers.set('postgres', this.postgresProvider);
    this.providers.set('postgresql', this.postgresProvider);
    this.providers.set('mongo', this.mongoProvider);
    this.providers.set('mongodb', this.mongoProvider);
    this.providers.set('redis', this.redisProvider);
  }

  /**
   * Initialize all configured database connections
   */
  async initializeConnections(): Promise<void> {
    try {
      this.logger.log('Initializing database connections...');

      // Initialize primary connection
      await this.initializePrimaryConnection();

      // Initialize additional connections if configured
      await this.initializeAdditionalConnections();

      this.logger.log(`Initialized ${this.connections.size} database connections`);
    } catch (error) {
      this.logger.error('Failed to initialize database connections:', error);
      throw error;
    }
  }

  /**
   * Initialize primary database connection
   */
  private async initializePrimaryConnection(): Promise<void> {
    const provider = this.providers.get(this.config.type);
    if (!provider) {
      throw new Error(`Unsupported database type: ${this.config.type}`);
    }

    const connection = await provider.createConnection('primary', {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      password: this.config.password,
      database: this.config.database,
      ssl: this.config.ssl,
      poolSize: this.config.poolSize,
    });

    this.connections.set('primary', connection);
    this.logger.log(`Primary ${this.config.type} connection established`);
  }

  /**
   * Initialize additional database connections
   */
  private async initializeAdditionalConnections(): Promise<void> {
    // Redis connection for caching (if not using in-memory only)
    if (this.config.type !== 'redis') {
      try {
        const redisConnection = await this.redisProvider.createConnection('cache', {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379'),
          password: process.env.REDIS_PASSWORD,
          database: process.env.REDIS_DB ?? '0',
        });
        this.connections.set('cache', redisConnection);
        this.logger.log('Redis cache connection established');
      } catch (error) {
        this.logger.warn('Redis connection failed, using memory cache only:', error);
      }
    }
  }

  /**
   * Get primary database connection
   */
  getPrimaryConnection(): Promise<DatabaseConnection> {
    const connection = this.connections.get('primary');
    if (!connection) {
      throw new Error('Primary database connection not initialized');
    }
    return Promise.resolve(connection);
  }

  /**
   * Get specific database connection by name
   */
  getConnection(name: string): Promise<DatabaseConnection> {
    const connection = this.connections.get(name);
    if (!connection) {
      throw new Error(`Database connection '${name}' not found`);
    }
    return Promise.resolve(connection);
  }

  /**
   * Get all active connections
   */
  getAllConnections(): Promise<DatabaseConnection[]> {
    return Promise.resolve(Array.from(this.connections.values()));
  }

  /**
   * Check if connection exists
   */
  hasConnection(name: string): boolean {
    return this.connections.has(name);
  }

  /**
   * Close specific connection
   */
  async closeConnection(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (connection) {
      await connection.close();
      this.connections.delete(name);
      this.logger.log(`Closed connection: ${name}`);
    }
  }

  /**
   * Close all connections
   */
  async closeAllConnections(): Promise<void> {
    const closePromises = Array.from(this.connections.entries()).map(async ([name, connection]) => {
      try {
        await connection.close();
        this.logger.log(`Closed connection: ${name}`);
      } catch (error) {
        this.logger.error(`Failed to close connection ${name}:`, error);
      }
    });

    await Promise.allSettled(closePromises);
    this.connections.clear();
  }

  /**
   * Get connection health status
   */
  async getConnectionHealth(): Promise<Map<string, boolean>> {
    const healthMap = new Map<string, boolean>();

    for (const [name, connection] of this.connections) {
      try {
        const health = await connection.checkHealth();
        healthMap.set(name, health.status);
      } catch (error) {
        healthMap.set(name, false);
      }
    }

    return healthMap;
  }
}

export interface DatabaseProvider {
  createConnection(name: string, config: ConnectionConfig): Promise<DatabaseConnection>;
  validateConfig(config: ConnectionConfig): boolean;
}

export interface ConnectionConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  poolSize?: number;
  timeout?: number;
  [key: string]: unknown;
}
