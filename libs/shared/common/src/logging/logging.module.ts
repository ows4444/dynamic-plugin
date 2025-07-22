import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from './structured-logger.service';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

@Global()
@Module({
  providers: [
    {
      provide: StructuredLoggerService,
      useFactory: (configService: ConfigService) => {
        return new StructuredLoggerService(configService, 'app');
      },
      inject: [ConfigService],
    },
    CorrelationIdMiddleware,
  ],
  exports: [StructuredLoggerService, CorrelationIdMiddleware],
})
export class LoggingModule {}