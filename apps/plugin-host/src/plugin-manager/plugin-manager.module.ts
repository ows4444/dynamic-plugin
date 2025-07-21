import { Module } from '@nestjs/common';
import { PluginManagerService } from './plugin-manager.service';
import { PluginManagerController } from './plugin-manager.controller';
import { PluginInstallerService } from './plugin-installer.service';
import { PluginValidatorService } from './plugin-validator.service';

@Module({
  controllers: [PluginManagerController],
  providers: [
    PluginManagerService,
    PluginInstallerService,
    PluginValidatorService,
  ],
  exports: [PluginManagerService],
})
export class PluginManagerModule {}
