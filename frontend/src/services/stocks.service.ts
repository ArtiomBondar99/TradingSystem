import { api } from './api';
import type { Stock } from './types';

export async function getStocks(): Promise<Stock[]> {
  const { data } = await api.get<Stock[]>('/stocks');
  return data;
}
