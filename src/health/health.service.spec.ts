import { jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  let service: HealthService;
  const prisma = { $queryRaw: jest.fn<() => Promise<unknown>>() };
  const config = { getOrThrow: jest.fn<(key: string) => string>() };

  beforeEach(async () => {
    jest.clearAllMocks();
    config.getOrThrow.mockReturnValue('test');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('reports the database as up when the query succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
  });

  it('includes the environment the app runs in', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.check();

    expect(config.getOrThrow).toHaveBeenCalledWith('app.environment');
    expect(result.environment).toBe('test');
  });

  it('throws 503 when the database is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
