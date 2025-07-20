import { Global, Module } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { StructuredLoggerService } from './structured-logger.service';
import { CorrelationService } from './correlation.service';
import { LogAggregatorService } from './log-aggregator.service';

/**
 * Global logging module providing structured logging and correlation
 * Includes request correlation, log aggregation, and structured formatting
 */
@Global()
@Module({
  providers: [LoggingService, StructuredLoggerService, CorrelationService, LogAggregatorService],
  exports: [LoggingService, StructuredLoggerService, CorrelationService, LogAggregatorService],
})
export class LoggingModule {}
