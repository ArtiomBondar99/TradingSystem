import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  const healthService = { check: jest.fn<HealthService['check']>() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns whatever the service reports', async () => {
    const status = {
      status: 'ok' as const,
      database: 'up' as const,
      environment: 'test',
      timestamp: '2026-10-06T12:00:00.000Z',
    };
    healthService.check.mockResolvedValue(status);

    await expect(controller.check()).resolves.toEqual(status);
  });
});
