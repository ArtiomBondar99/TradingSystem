import { Module } from '@nestjs/common';
import { OrderFilledConsumer } from './order-filled.consumer.js';

@Module({
  providers: [OrderFilledConsumer],
})
export class NotificationsModule {}
