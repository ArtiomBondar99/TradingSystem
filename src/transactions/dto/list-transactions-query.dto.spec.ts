import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  DEFAULT_PAGE_SIZE,
  ListTransactionsQueryDto,
  MAX_PAGE_SIZE,
} from './list-transactions-query.dto.js';

describe('ListTransactionsQueryDto', () => {
  // Same options as the global pipe in AppModule
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const validate = (query: unknown) =>
    pipe.transform(query, {
      type: 'query',
      metatype: ListTransactionsQueryDto,
    }) as Promise<ListTransactionsQueryDto>;

  it('defaults limit when it is missing', async () => {
    const query = await validate({});

    expect(query.limit).toBe(DEFAULT_PAGE_SIZE);
    expect(query.cursor).toBeUndefined();
  });

  it('turns the query string "5" into the number 5', async () => {
    const query = await validate({ limit: '5' });

    expect(query.limit).toBe(5);
  });

  it.each([['0'], ['abc'], ['1.5'], [String(MAX_PAGE_SIZE + 1)]])(
    'rejects limit=%s',
    async (limit) => {
      await expect(validate({ limit })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('rejects a cursor that is not an id', async () => {
    await expect(validate({ cursor: 'nope' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
