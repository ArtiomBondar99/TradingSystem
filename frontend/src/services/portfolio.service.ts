import { api } from './api';
import type { Portfolio } from './types';

// Cash, positions and unrealized P&L, all computed by the backend
export async function getPortfolio(): Promise<Portfolio> {
  const { data } = await api.get<Portfolio>('/portfolio');
  return data;
}
