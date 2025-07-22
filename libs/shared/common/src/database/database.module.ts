import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_DATABASE', 'plugin_system'),
        
        // Connection pool settings
        poolSize: configService.get<number>('DB_POOL_SIZE', 10),
        acquireTimeout: configService.get<number>('DB_ACQUIRE_TIMEOUT', 60000),
        timeout: configService.get<number>('DB_TIMEOUT', 30000),
        
        // Performance settings
        extra: {
          max: configService.get<number>('DB_POOL_MAX', 20),
          min: configService.get<number>('DB_POOL_MIN', 5),
          idle: configService.get<number>('DB_POOL_IDLE', 10000),
          acquire: configService.get<number>('DB_POOL_ACQUIRE', 30000),
          evict: configService.get<number>('DB_POOL_EVICT', 1000),
          handleDisconnects: true,
          charset: 'utf8mb4',
        },
        
        // Development settings
        synchronize: configService.get<boolean>('DB_SYNCHRONIZE', false),
        logging: configService.get<boolean>('DB_LOGGING', false),
        dropSchema: configService.get<boolean>('DB_DROP_SCHEMA', false),
        
        // Migration settings
        migrationsRun: configService.get<boolean>('DB_MIGRATIONS_RUN', true),
        migrations: ['dist/migrations/*.js'],
        migrationsTableName: 'migrations',
        
        // Entity settings
        entities: ['dist/**/*.entity.js'],
        autoLoadEntities: true,
        
        // Cache settings
        cache: {
          type: 'redis',
          options: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            password: configService.get<string>('REDIS_PASSWORD'),
            db: configService.get<number>('REDIS_DB', 1),
          },
          duration: configService.get<number>('DB_CACHE_DURATION', 30000), // 30 seconds
        },
        
        // SSL settings for production
        ssl: configService.get<string>('NODE_ENV') === 'production' ? {
          rejectUnauthorized: false,
        } : false,
        
        // Additional options
        retryAttempts: configService.get<number>('DB_RETRY_ATTEMPTS', 3),
        retryDelay: configService.get<number>('DB_RETRY_DELAY', 3000),
        maxQueryExecutionTime: configService.get<number>('DB_MAX_QUERY_TIME', 10000),
      }),
      inject: [ConfigService],
      dataSourceFactory: async (options) => {
        const dataSource = new DataSource(options);
        await dataSource.initialize();
        return dataSource;
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {
  constructor(private dataSource: DataSource) {
    // Log connection status
    if (this.dataSource.isInitialized) {
      console.log('✅ Database connection established successfully');
    }
  }
}