import { Injectable } from '@nestjs/common';
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination-query.dto.js';
import { toCursorPage } from '../common/pagination.js';
import {
  TransactionPageDto,
  TransactionResponseDto,
} from './dto/transaction-response.dto.js';
import { TransactionsRepository } from './transactions.repository.js';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository,
  ) {}

  async getMyTransactions(
    userId: string,
    query: CursorPaginationQueryDto,
  ): Promise<TransactionPageDto> {
    // Ask for one extra row: if it exists, there is a next page
    const rows = await this.transactionsRepository.findPageByUserId(
      userId,
      query.limit + 1,
      query.cursor,
    );

    const page = toCursorPage(rows, query.limit);

    return {
      items: page.items.map((row) => TransactionResponseDto.fromEntity(row)),
      nextCursor: page.nextCursor,
    };
  }
}
