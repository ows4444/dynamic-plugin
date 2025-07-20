import { Global, Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import { MessageBrokerService } from './message-broker.service';
import { MessageQueueService } from './message-queue.service';
import { MemoryEventBusProvider } from './providers/memory-event-bus.provider';
import { RedisEventBusProvider } from './providers/redis-event-bus.provider';
import { ConfigService } from '../config/config.service';

/**
 * Global messaging module providing event bus and message queue capabilities
 * Supports in-memory and Redis-based messaging for scalability
 */
@Global()
@Module({
  providers: [
    EventBusService,
    MessageBrokerService,
    MessageQueueService,
    MemoryEventBusProvider,
    RedisEventBusProvider,
    {
      provide: 'MESSAGING_CONFIG',
      useFactory: (configService: ConfigService) => ({
        provider: process.env.MESSAGE_PROVIDER ?? 'memory',
        redis: configService.getRedisConfig(),
        enableDistributedEvents: process.env.ENABLE_DISTRIBUTED_EVENTS === 'true',
        maxRetries: parseInt(process.env.MESSAGE_MAX_RETRIES ?? '3'),
        retryDelay: parseInt(process.env.MESSAGE_RETRY_DELAY ?? '1000'),
      }),
      inject: [ConfigService],
    },
  ],
  exports: [EventBusService, MessageBrokerService, MessageQueueService],
})
export class MessagingModule {}
