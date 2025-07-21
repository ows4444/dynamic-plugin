import { Module } from '@nestjs/common';
import { DownloadController } from './download.controller';
import { DownloadService } from './download.service';
import { StorageModule } from '../storage/storage.module';
import { MetadataModule } from '../metadata/metadata.module';

@Module({
  imports: [StorageModule, MetadataModule],
  controllers: [DownloadController],
  providers: [DownloadService],
  exports: [DownloadService],
})
export class DownloadModule {}
