import { Controller, Get } from '@nestjs/common';
import { Tools/pluginBuilderService } from './tools/plugin-builder.service';

@Controller()
export class Tools/pluginBuilderController {
  constructor(private readonly tools/pluginBuilderService: Tools/pluginBuilderService) {}

  @Get()
  getHello(): string {
    return this.tools/pluginBuilderService.getHello();
  }
}
