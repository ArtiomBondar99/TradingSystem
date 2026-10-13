import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { IdempotencyKey } from '../common/decorators/idempotency-key.decorator.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';
import { OrderPreviewDto } from './dto/order-preview.dto.js';
import { OrderPageDto, OrderResponseDto } from './dto/order-response.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Always 201: even a REJECTED order was created and saved.
  // Send a fresh UUID as Idempotency-Key per order, and the SAME one when
  // retrying it: the retry returns the original order instead of trading twice.
  @Post()
  @ApiCreatedResponse({
    type: OrderResponseDto,
    description:
      'The order was saved. Check status: FILLED; PENDING (a LIMIT order waiting for its price); or REJECTED with a rejectReason (INSUFFICIENT_FUNDS / INSUFFICIENT_SHARES).',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'A UUID. Retrying with the same key returns the original order instead of trading twice. Reusing it for a different order returns 422.',
  })
  placeOrder(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateOrderDto,
    @IdempotencyKey(new ParseUUIDPipe({ optional: true }))
    idempotencyKey?: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.placeOrder(userId, dto, idempotencyKey);
  }

  // Same body as POST /orders, but nothing is saved or traded: the order form
  // shows these estimates while the user types
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: OrderPreviewDto })
  previewOrder(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderPreviewDto> {
    return this.ordersService.previewOrder(userId, dto);
  }

  // Order history, newest first. ?status=REJECTED shows only rejected orders
  @Get()
  getMyOrders(
    @CurrentUser('userId') userId: string,
    @Query() query: ListOrdersQueryDto,
  ): Promise<OrderPageDto> {
    return this.ordersService.getMyOrders(userId, query);
  }

  // A state change, not a deletion: the order stays in the history as
  // CANCELLED, so this is POST .../cancel rather than DELETE
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'No such order for this user' })
  @ApiConflictResponse({
    description:
      'The order is not open (already FILLED, REJECTED or CANCELLED)',
  })
  cancelOrder(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.cancelOrder(userId, orderId);
  }
}
