import { Module } from '@nestjs/common';
import { AppConfigModule, DatabaseModule } from '@lib/shared/common';
import { AuthModule } from './auth/auth.module';
import { MetadataModule } from './metadata/metadata.module';
import { UploadModule } from './upload/upload.module';
import { DownloadModule } from './download/download.module';
import { StorageModule } from './storage/storage.module';
import { ValidationModule } from './validation/validation.module';
import { PluginRegistryModule } from './plugin-registry.module';

@Module({
  imports: [
    AppConfigModule, // Centralized configuration with validation
    DatabaseModule, // Centralized database configuration with TypeORM
    AuthModule,
    MetadataModule,
    UploadModule,
    DownloadModule,
    StorageModule,
    ValidationModule,
    PluginRegistryModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}