import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { StorageModule } from '../storage/storage.module';
import { ValidationModule } from '../validation/validation.module';
import { MetadataModule } from '../metadata/metadata.module';

@Module({
  imports: [StorageModule, ValidationModule, MetadataModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
