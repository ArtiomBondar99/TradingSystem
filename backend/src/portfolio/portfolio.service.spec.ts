import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, type Wallet } from '../generated/prisma/client.js';
import {
  PortfolioRepository,
  type PositionWithStock,
} from './portfolio.repository.js';
import { PortfolioService } from './portfolio.service.js';

describe('PortfolioService', () => {
  let service: PortfolioService;
  const portfolioRepository = {
    findByUserId: jest.fn<PortfolioRepository['findByUserId']>(),
  };

  const wallet: Wallet = {
    id: 'wallet-1',
    userId: 'user-1',
    cashBalance: new Prisma.Decimal('1000'),
    currency: 'USD',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const position = (
    symbol: string,
    quantity: number,
    averagePrice: string,
    currentPrice: string,
  ): PositionWithStock => ({
    id: `position-${symbol}`,
    userId: 'user-1',
    stockId: `stock-${symbol}`,
    quantity,
    averagePrice: new Prisma.Decimal(averagePrice),
    createdAt: new Date(),
    updatedAt: new Date(),
    stock: {
      id: `stock-${symbol}`,
      symbol,
      name: `${symbol} Inc.`,
      currentPrice: new Prisma.Decimal(currentPrice),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: PortfolioRepository, useValue: portfolioRepository },
      ],
    }).compile();

    service = module.get(PortfolioService);
  });

  it('values each position and the whole portfolio', async () => {
    portfolioRepository.findByUserId.mockResolvedValue({
      wallet,
      positions: [
        // bought 10 @ 100, now 110: +100 (+10%)
        position('AAPL', 10, '100', '110'),
        // bought 4 @ 50, now 45: -20 (-10%)
        position('TSLA', 4, '50', '45'),
      ],
      realizedPnL: new Prisma.Decimal('-12.5'),
    });

    const portfolio = await service.getMyPortfolio('user-1');

    expect(portfolio).toEqual({
      cashBalance: '1000.00',
      // 1000 / 2280
      cashPercent: '43.86',
      positionsValue: '1280.00',
      totalValue: '2280.00',
      unrealizedPnL: '80.00',
      // Past sales: reported as is, separate from the open positions
      realizedPnL: '-12.50',
      positions: [
        {
          symbol: 'AAPL',
          name: 'AAPL Inc.',
          quantity: 10,
          averagePrice: '100.00',
          currentPrice: '110.00',
          marketValue: '1100.00',
          unrealizedPnL: '100.00',
          unrealizedPnLPercent: '10.00',
          // 1100 / 2280
          allocationPercent: '48.25',
        },
        {
          symbol: 'TSLA',
          name: 'TSLA Inc.',
          quantity: 4,
          averagePrice: '50.00',
          currentPrice: '45.00',
          marketValue: '180.00',
          unrealizedPnL: '-20.00',
          unrealizedPnLPercent: '-10.00',
          // 180 / 2280
          allocationPercent: '7.89',
        },
      ],
    });
  });

  it('returns only cash when the user holds no stocks', async () => {
    portfolioRepository.findByUserId.mockResolvedValue({
      wallet,
      positions: [],
      realizedPnL: new Prisma.Decimal(0),
    });

    const portfolio = await service.getMyPortfolio('user-1');

    expect(portfolio).toEqual({
      cashBalance: '1000.00',
      cashPercent: '100.00',
      positionsValue: '0.00',
      totalValue: '1000.00',
      unrealizedPnL: '0.00',
      realizedPnL: '0.00',
      positions: [],
    });
  });

  it('reports 0% everywhere when there is nothing at all (no division by zero)', async () => {
    portfolioRepository.findByUserId.mockResolvedValue({
      wallet: { ...wallet, cashBalance: new Prisma.Decimal(0) },
      positions: [],
      realizedPnL: new Prisma.Decimal(0),
    });

    const portfolio = await service.getMyPortfolio('user-1');

    expect(portfolio.cashPercent).toBe('0.00');
  });

  it('throws 404 when the user has no wallet', async () => {
    portfolioRepository.findByUserId.mockResolvedValue({
      wallet: null,
      positions: [],
      realizedPnL: new Prisma.Decimal(0),
    });

    await expect(service.getMyPortfolio('user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
