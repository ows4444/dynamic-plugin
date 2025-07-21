import { Controller, Get } from '@nestjs/common';
import { ToolspluginBuilderService } from './plugin-builder.service';

@Controller()
export class ToolspluginBuilderController {
  constructor(
    private readonly toolspluginBuilderService: ToolspluginBuilderService,
  ) {}

  @Get()
  getHello(): string {
    return this.toolspluginBuilderService.getHello();
  }
}
