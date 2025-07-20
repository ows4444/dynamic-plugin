import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Base migration interface
 */
export interface Migration {
  name: string;
  description: string;
  up(trx: { query: (cmd: string) => void }): Promise<void> | void;
  down?(trx: { query: (cmd: string) => void }): Promise<void> | void;
}

/**
 * Migration result interface
 */
export interface MigrationResult {
  name: string;
  success: boolean;
  executionTime: number;
  appliedAt: Date;
  error?: string;
  rolledBack?: boolean;
}

/**
 * Migration status interface
 */
export interface MigrationStatus {
  name: string;
  description: string;
  applied: boolean;
  appliedAt?: Date;
}

/**
 * Initial schema migration
 */
class InitialSchemaMigration implements Migration {
  name = '001-initial-schema';
  description = 'Create initial database schema';

  up(trx: { query: (cmd: string) => void }): void {
    // Create basic system tables
    trx.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  down(trx: { query: (cmd: string) => void }): void {
    trx.query('DROP TABLE IF EXISTS system_config');
  }
}

/**
 * Plugin tables migration
 */
class PluginTablesMigration implements Migration {
  name = '002-plugin-tables';
  description = 'Create plugin-related tables';

  up(trx: { query: (cmd: string) => void }): void {
    // Plugin metadata table
    trx.query(`
      CREATE TABLE IF NOT EXISTS plugins (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        description TEXT,
        author VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'installed',
        config JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Plugin dependencies table
    trx.query(`
      CREATE TABLE IF NOT EXISTS plugin_dependencies (
        id SERIAL PRIMARY KEY,
        plugin_id VARCHAR(255) NOT NULL,
        dependency_name VARCHAR(255) NOT NULL,
        dependency_version VARCHAR(50) NOT NULL,
        required BOOLEAN DEFAULT true,
        FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
      )
    `);
  }

  down(trx: { query: (cmd: string) => void }): void {
    trx.query('DROP TABLE IF EXISTS plugin_dependencies');
    trx.query('DROP TABLE IF EXISTS plugins');
  }
}

/**
 * Audit tables migration
 */
class AuditTablesMigration implements Migration {
  name = '003-audit-tables';
  description = 'Create audit and logging tables';

  up(trx: { query: (cmd: string) => void }): void {
    // Audit log table
    trx.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        plugin_id VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(255),
        user_id VARCHAR(255),
        metadata JSON,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_plugin_timestamp (plugin_id, timestamp),
        INDEX idx_action (action),
        INDEX idx_timestamp (timestamp)
      )
    `);
  }

  down(trx: { query: (cmd: string) => void }): void {
    trx.query('DROP TABLE IF EXISTS audit_log');
  }
}

/**
 * Database migration service for schema management
 */
@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);
  private readonly migrations: Migration[] = [];
  private readonly initialized = false;

  constructor(private readonly databaseService: DatabaseService) {
    this.registerMigrations();
  }

  /**
   * Register all available migrations
   */
  private registerMigrations(): void {
    // Register built-in migrations
    this.migrations.push(new InitialSchemaMigration(), new PluginTablesMigration(), new AuditTablesMigration());

    this.logger.log(`Registered ${this.migrations.length} migrations`);
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<MigrationResult[]> {
    try {
      this.logger.log('Starting database migrations...');

      // Ensure migration table exists
      await this.ensureMigrationTable();

      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations();

      // Find pending migrations
      const pendingMigrations = this.migrations.filter((migration) => !appliedMigrations.includes(migration.name));

      if (pendingMigrations.length === 0) {
        this.logger.log('No pending migrations');
        return [];
      }

      // Run pending migrations
      const results: Array<Promise<MigrationResult>> = [];
      for (const migration of pendingMigrations) {
        results.push(this.runMigration(migration));
      }

      this.logger.log(`Completed ${results.length} migrations`);
      return Promise.all(results);
    } catch (error) {
      this.logger.error('Migration execution failed:', error);
      throw error;
    }
  }

  /**
   * Run a specific migration
   */
  private async runMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Running migration: ${migration.name}`);

      await this.databaseService.transaction(async (trx) => {
        // Execute migration
        await migration.up(trx);

        // Record migration as applied
        this.recordMigration(trx, migration);
      });

      const executionTime = Date.now() - startTime;
      this.logger.log(`Migration completed: ${migration.name} (${executionTime}ms)`);

      return {
        name: migration.name,
        success: true,
        executionTime,
        appliedAt: new Date(),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Migration failed: ${migration.name}`, error);

      return {
        name: migration.name,
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : String(error),
        appliedAt: new Date(),
      };
    }
  }

  /**
   * Rollback migrations to a specific point
   */
  async rollbackMigrations(targetMigration?: string): Promise<MigrationResult[]> {
    try {
      this.logger.log('Starting migration rollback...');

      const appliedMigrations = await this.getAppliedMigrations();
      const targetIndex = targetMigration ? appliedMigrations.indexOf(targetMigration) : appliedMigrations.length - 1;

      if (targetIndex === -1) {
        throw new Error(`Migration not found: ${targetMigration}`);
      }

      // Get migrations to rollback (in reverse order)
      const migrationsToRollback = appliedMigrations
        .slice(targetIndex + 1)
        .reverse()
        .map((name) => this.migrations.find((m) => m.name === name))
        .filter((m): m is Migration => m !== undefined);

      const results: Array<Promise<MigrationResult>> = [];
      for (const migration of migrationsToRollback) {
        results.push(this.rollbackMigration(migration));
      }

      this.logger.log(`Rolled back ${results.length} migrations`);
      return Promise.all(results);
    } catch (error) {
      this.logger.error('Migration rollback failed:', error);
      throw error;
    }
  }

  /**
   * Rollback a specific migration
   */
  private async rollbackMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Rolling back migration: ${migration.name}`);

      await this.databaseService.transaction(async (trx) => {
        // Execute rollback
        if (migration.down) {
          await migration.down(trx);
        }

        // Remove migration record
        this.removeMigrationRecord(trx, migration);
      });

      const executionTime = Date.now() - startTime;
      this.logger.log(`Migration rolled back: ${migration.name} (${executionTime}ms)`);

      return {
        name: migration.name,
        success: true,
        executionTime,
        appliedAt: new Date(),
        rolledBack: true,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Migration rollback failed: ${migration.name}`, error);

      return {
        name: migration.name,
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : String(error),
        appliedAt: new Date(),
        rolledBack: true,
      };
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<MigrationStatus[]> {
    const appliedMigrations = await this.getAppliedMigrations();

    return this.migrations.map((migration) => ({
      name: migration.name,
      description: migration.description,
      applied: appliedMigrations.includes(migration.name),
      appliedAt: undefined, // Could be fetched from migration table
    }));
  }

  /**
   * Ensure migration tracking table exists
   */
  private async ensureMigrationTable(): Promise<void> {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.databaseService.query(createTableSql);
  }

  /**
   * Get list of applied migrations
   */
  private async getAppliedMigrations(): Promise<string[]> {
    try {
      const results = await this.databaseService.query<{ name: string }>('SELECT name FROM migrations ORDER BY applied_at ASC');
      return results.map((row) => row.name);
    } catch (error) {
      // If table doesn't exist, return empty array
      return [];
    }
  }

  /**
   * Record migration as applied
   */
  private recordMigration(trx: { query: (cmd: string, opt?: string[]) => void }, migration: Migration): void {
    trx.query('INSERT INTO migrations (name) VALUES (?)', [migration.name]);
  }

  /**
   * Remove migration record
   */
  private removeMigrationRecord(trx: { query: (cmd: string, opt?: string[]) => void }, migration: Migration): void {
    trx.query('DELETE FROM migrations WHERE name = ?', [migration.name]);
  }
}
