import { Global, Module } from '@nestjs/common';
import { OutboxRelayService } from './outbox-relay.service.js';
import { RabbitMqService } from './rabbitmq.service.js';

@Global()
@Module({
  providers: [RabbitMqService, OutboxRelayService],
  exports: [RabbitMqService],
})
export class MessagingModule {}
