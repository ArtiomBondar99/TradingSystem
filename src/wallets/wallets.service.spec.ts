import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { WalletsRepository } from './wallets.repository.js';
import { WalletsService } from './wallets.service.js';

describe('WalletsService', () => {
  let service: WalletsService;
  const walletsRepository = {
    findByUserId: jest.fn<WalletsRepository['findByUserId']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: WalletsRepository, useValue: walletsRepository },
      ],
    }).compile();

    service = module.get(WalletsService);
  });

  it('returns the balance as an exact 2-decimal string', async () => {
    walletsRepository.findByUserId.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: new Prisma.Decimal('100000'),
      currency: 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const wallet = await service.getMyWallet('user-1');

    expect(wallet.balance).toBe('100000.00');
    expect(wallet.currency).toBe('USD');
    expect(wallet).not.toHaveProperty('userId');
  });

  it('keeps cents exact where a float would drift', async () => {
    // 0.1 + 0.2 === 0.30000000000000004 with JS numbers
    walletsRepository.findByUserId.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: new Prisma.Decimal('0.1').plus('0.2'),
      currency: 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const wallet = await service.getMyWallet('user-1');

    expect(wallet.balance).toBe('0.30');
  });

  it('throws 404 when the user has no wallet', async () => {
    walletsRepository.findByUserId.mockResolvedValue(null);

    await expect(service.getMyWallet('user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
