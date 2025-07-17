import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '../config/config.module';
import { PluginModule } from '../plugins/plugin.module';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginRegistryController } from './plugin-registry.controller';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    PluginModule,
  ],
  providers: [PluginRegistryService],
  controllers: [PluginRegistryController],
  exports: [PluginRegistryService],
})
export class RegistryModule {}