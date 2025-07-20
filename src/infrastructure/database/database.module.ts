import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ConnectionManagerService } from './connection-manager.service';
import { MigrationService } from './migration.service';
import { PostgreSQLProvider } from './providers/postgresql.provider';
import { MongoDBProvider } from './providers/mongodb.provider';
import { RedisProvider } from './providers/redis.provider';
import { ConnectionFactory } from './factories/connection.factory';
import { RepositoryFactory } from './factories/repository.factory';
import { ConfigService } from '../config/config.service';

/**
 * Global database module providing multi-provider database support
 * Supports PostgreSQL, MongoDB, Redis with connection pooling and migrations
 */
@Global()
@Module({
  providers: [
    DatabaseService,
    ConnectionManagerService,
    MigrationService,
    PostgreSQLProvider,
    MongoDBProvider,
    RedisProvider,
    ConnectionFactory,
    RepositoryFactory,
    {
      provide: 'DATABASE_CONFIG',
      useFactory: (configService: ConfigService) => configService.getDatabaseConfig(),
      inject: [ConfigService],
    },
  ],
  exports: [DatabaseService, ConnectionManagerService, MigrationService, ConnectionFactory, RepositoryFactory],
})
export class DatabaseModule {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly migrationService: MigrationService,
  ) {
    void this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await this.databaseService.initialize();
      await this.migrationService.runMigrations();
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }
}
