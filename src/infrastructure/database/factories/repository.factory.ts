import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database.service';

/**
 * Factory for creating repository instances with database connections
 */
@Injectable()
export class RepositoryFactory {
  private readonly logger = new Logger(RepositoryFactory.name);
  private readonly repositories = new Map<string, BaseRepository>();

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create or get cached repository instance
   */
  async getRepository<T extends BaseRepository>(repositoryClass: new (db: DatabaseService) => T, connectionName?: string): Promise<T> {
    const className = repositoryClass.name;
    const cacheKey = connectionName ? `${className}_${connectionName}` : className;

    // Return cached instance if exists
    const cached = this.repositories.get(cacheKey) as T;
    if (cached) {
      return cached;
    }

    // Create new repository instance
    const repository = new repositoryClass(this.databaseService);

    // Set specific connection if provided
    if (connectionName) {
      await repository.setConnection(connectionName);
    }

    // Cache the instance
    this.repositories.set(cacheKey, repository);

    this.logger.debug(`Created repository: ${className}`);
    return repository;
  }

  /**
   * Create repository with specific configuration
   */
  async createRepository<T extends BaseRepository>(repositoryClass: new (db: DatabaseService) => T, config: RepositoryConfig): Promise<T> {
    const repository = new repositoryClass(this.databaseService);

    // Apply configuration
    if (config.connectionName) {
      await repository.setConnection(config.connectionName);
    }

    if (config.tableName) {
      repository.setTableName(config.tableName);
    }

    if (config.schema) {
      repository.setSchema(config.schema);
    }

    this.logger.debug(`Created configured repository: ${repositoryClass.name}`);
    return repository;
  }

  /**
   * Clear repository cache
   */
  clearCache(): void {
    this.repositories.clear();
    this.logger.debug('Repository cache cleared');
  }

  /**
   * Remove specific repository from cache
   */
  removeFromCache(repositoryClass: new (...args: any[]) => BaseRepository, connectionName?: string): void {
    const className = repositoryClass.name;
    const cacheKey = connectionName ? `${className}_${connectionName}` : className;

    if (this.repositories.delete(cacheKey)) {
      this.logger.debug(`Removed repository from cache: ${cacheKey}`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): RepositoryCacheStats {
    return {
      totalRepositories: this.repositories.size,
      repositories: Array.from(this.repositories.keys()),
    };
  }
}

/**
 * Base repository class with common database operations
 */
export abstract class BaseRepository {
  protected tableName = '';
  protected schema = '';
  protected connectionName = 'primary';

  constructor(protected readonly db: DatabaseService) {}

  /**
   * Set specific database connection
   */
  setConnection(connectionName: string): Promise<void> {
    this.connectionName = connectionName;
  }

  /**
   * Set table name
   */
  setTableName(tableName: string): void {
    this.tableName = tableName;
  }

  /**
   * Set schema name
   */
  setSchema(schema: string): void {
    this.schema = schema;
  }

  /**
   * Get full table name with schema if applicable
   */
  protected getFullTableName(): string {
    const table = this.tableName;
    return this.schema ? `${this.schema}.${table}` : table;
  }

  /**
   * Execute query with current connection
   */
  protected async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    if (this.connectionName === 'primary') {
      return this.db.query<T>(sql, params);
    }

    const connection = await this.db.getConnection(this.connectionName);
    return connection.query<T>(sql, params);
  }

  /**
   * Execute transaction with current connection
   */
  protected async transaction<T>(fn: (trx: any) => Promise<T>): Promise<T> {
    if (this.connectionName === 'primary') {
      return this.db.transaction(fn);
    }

    const connection = await this.db.getConnection(this.connectionName);
    return connection.transaction(fn);
  }

  /**
   * Generic find by ID
   */
  async findById<T>(id: string | number): Promise<T | null> {
    const sql = `SELECT * FROM ${this.getFullTableName()} WHERE id = ?`;
    const results = await this.query<T>(sql, [id]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Generic find all with optional conditions
   */
  findAll<T>(conditions?: Record<string, unknown>): Promise<T[]> {
    let sql = `SELECT * FROM ${this.getFullTableName()}`;
    const params: unknown[] = [];

    if (conditions && Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key) => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions));
    }

    return this.query<T>(sql, params);
  }

  /**
   * Generic insert
   */
  async insert<T>(data: Record<string, unknown>): Promise<T> {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data)
      .map(() => '?')
      .join(', ');
    const sql = `INSERT INTO ${this.getFullTableName()} (${columns}) VALUES (${placeholders})`;

    await this.query(sql, Object.values(data));
    // In a real implementation, return the inserted record
    return data as T;
  }

  /**
   * Generic update
   */
  async update<T>(id: string | number, data: Record<string, unknown>): Promise<T | null> {
    const setClause = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(', ');
    const sql = `UPDATE ${this.getFullTableName()} SET ${setClause} WHERE id = ?`;

    await this.query(sql, [...Object.values(data), id]);
    return this.findById<T>(id);
  }

  /**
   * Generic delete
   */
  async delete(id: string | number): Promise<boolean> {
    const sql = `DELETE FROM ${this.getFullTableName()} WHERE id = ?`;
    await this.query(sql, [id]);
    return true; // In a real implementation, check affected rows
  }
}

export interface RepositoryConfig {
  connectionName?: string;
  tableName?: string;
  schema?: string;
  cacheEnabled?: boolean;
  cacheTtl?: number;
}

export interface RepositoryCacheStats {
  totalRepositories: number;
  repositories: string[];
}
