import { Module } from '@nestjs/common';
import { Shared/pluginTypesService } from './shared/plugin-types.service';

@Module({
  providers: [Shared/pluginTypesService],
  exports: [Shared/pluginTypesService],
})
export class Shared/pluginTypesModule {}
