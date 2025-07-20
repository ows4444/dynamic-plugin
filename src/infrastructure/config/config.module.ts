import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigLoaderService } from './config-loader.service';
import { ConfigValidatorService } from './config-validator.service';

/**
 * Global configuration module for the plugin system
 * Provides centralized configuration management
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
  ],
  providers: [ConfigService, ConfigLoaderService, ConfigValidatorService],
  exports: [ConfigService, ConfigLoaderService, ConfigValidatorService],
})
export class InfrastructureConfigModule {}
