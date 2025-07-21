import { Module } from '@nestjs/common';
import { ToolspluginBuilderController } from './plugin-builder.controller';
import { ToolspluginBuilderService } from './plugin-builder.service';

@Module({
  imports: [],
  controllers: [ToolspluginBuilderController],
  providers: [ToolspluginBuilderService],
})
export class ToolspluginBuilderModule {}
