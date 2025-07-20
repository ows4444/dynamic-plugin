import { Module } from '@nestjs/common';
import { PluginTemplateController } from './plugin-template.controller';
import { PluginTemplateService } from './plugin-template.service';

@Module({
  imports: [],
  controllers: [PluginTemplateController],
  providers: [PluginTemplateService],
})
export class PluginTemplateModule {}
