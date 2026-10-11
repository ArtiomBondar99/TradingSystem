import {
  Body,
  Controller,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { IdempotencyKey } from '../common/decorators/idempotency-key.decorator.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderResponseDto } from './dto/order-response.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Always 201: even a REJECTED order was created and saved.
  // Send a fresh UUID as Idempotency-Key per order, and the SAME one when
  // retrying it: the retry returns the original order instead of trading twice.
  @Post()
  placeOrder(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateOrderDto,
    @IdempotencyKey(new ParseUUIDPipe({ optional: true }))
    idempotencyKey?: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.placeOrder(userId, dto, idempotencyKey);
  }
}
