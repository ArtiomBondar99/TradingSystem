import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination-query.dto.js';
import { TransactionPageDto } from './dto/transaction-response.dto.js';
import { TransactionsService } from './transactions.service.js';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  getMyTransactions(
    @CurrentUser('userId') userId: string,
    @Query() query: CursorPaginationQueryDto,
  ): Promise<TransactionPageDto> {
    return this.transactionsService.getMyTransactions(userId, query);
  }
}
