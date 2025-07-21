import { Module } from '@nestjs/common';
import { RegistryClientService } from './registry-client.service';
import { DownloadService } from './download.service';
import { MetadataService } from './metadata.service';

@Module({
  providers: [
    RegistryClientService,
    DownloadService,
    MetadataService,
  ],
  exports: [RegistryClientService],
})
export class PluginRegistryModule {}