import { Module } from '@nestjs/common';
import { FileSystemService } from './file-system.service';
import { PluginCacheService } from './plugin-cache.service';

@Module({
  providers: [FileSystemService, PluginCacheService],
  exports: [FileSystemService, PluginCacheService],
})
export class StorageModule {}
