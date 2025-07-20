import { Controller, Get } from '@nestjs/common';
import { PluginTemplateService } from './plugin-template.service';

@Controller()
export class PluginTemplateController {
  constructor(private readonly pluginTemplateService: PluginTemplateService) {}

  @Get()
  getHello(): string {
    return this.pluginTemplateService.getHello();
  }
}
