import { Controller, Get } from '@nestjs/common';
import { PluginRegistryService } from './plugin-registry.service';

@Controller()
export class PluginRegistryController {
  constructor(private readonly pluginRegistryService: PluginRegistryService) {}

  @Get()
  getHello(): string {
    return this.pluginRegistryService.getHello();
  }
}
