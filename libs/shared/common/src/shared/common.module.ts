import { Module } from '@nestjs/common';
import { Shared/commonService } from './shared/common.service';

@Module({
  providers: [Shared/commonService],
  exports: [Shared/commonService],
})
export class Shared/commonModule {}
