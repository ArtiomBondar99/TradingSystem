import { Injectable } from '@nestjs/common';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto.js';
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
    query: ListTransactionsQueryDto,
  ): Promise<TransactionPageDto> {
    // Ask for one extra row: if it exists, there is a next page
    const rows = await this.transactionsRepository.findPageByUserId(
      userId,
      query.limit + 1,
      query.cursor,
    );

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map((row) => TransactionResponseDto.fromEntity(row)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}
