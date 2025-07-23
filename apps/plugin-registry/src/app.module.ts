import { AppConfigModule, DatabaseModule } from '@lib/shared/common';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DownloadModule } from './download/download.module';
import { MetadataModule } from './metadata/metadata.module';
import { StorageModule } from './storage/storage.module';
import { UploadModule } from './upload/upload.module';
import { ValidationModule } from './validation/validation.module';

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
  ],
})
export class AppModule {}