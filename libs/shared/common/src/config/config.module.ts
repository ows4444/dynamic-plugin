import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { appConfig } from './app.config';
import { configValidationSchema } from './validation.schema';
import { createDatabaseConfig } from './database.config';
import { createCacheConfig } from './cache.config';

@Global()
@Module({
  imports: [
    // Global configuration with validation
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: false,
        abortEarly: false,
      },
      // Expand environment variables
      expandVariables: true,
      // Cache configuration for better performance
      cache: true,
    }),
    
    // Database configuration
    TypeOrmModule.forRootAsync({
      useFactory: createDatabaseConfig,
      inject: [ConfigModule],
    }),
    
    // Cache configuration
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: createCacheConfig,
      inject: [ConfigModule],
    }),
  ],
  exports: [ConfigModule, TypeOrmModule, CacheModule],
})
export class AppConfigModule {}