import { Controller, Get } from '@nestjs/common';
import { PluginHostService } from './plugin-host.service';

@Controller()
export class PluginHostController {
  constructor(private readonly pluginHostService: PluginHostService) {}

  @Get()
  getHello(): string {
    return this.pluginHostService.getHello();
  }
}
