import { Module } from '@nestjs/common';
import { Tools/pluginBuilderController } from './tools/plugin-builder.controller';
import { Tools/pluginBuilderService } from './tools/plugin-builder.service';

@Module({
  imports: [],
  controllers: [Tools/pluginBuilderController],
  providers: [Tools/pluginBuilderService],
})
export class Tools/pluginBuilderModule {}
