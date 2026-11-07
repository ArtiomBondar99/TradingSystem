import { api } from './api';
import type { TransactionFilters, TransactionPage } from './types';

export async function getTransactions(
  params: TransactionFilters & { cursor?: string; limit?: number },
): Promise<TransactionPage> {
  const { data } = await api.get<TransactionPage>('/transactions', {
    params,
  });
  return data;
}
