import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  const usersRepository = { findById: jest.fn<UsersRepository['findById']>() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: usersRepository },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('getProfile', () => {
    it('returns the public profile without the password hash', async () => {
      usersRepository.findById.mockResolvedValue({
        id: 'user-1',
        email: 'trader@example.com',
        passwordHash: 'secret-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const profile = await service.getProfile('user-1');

      expect(profile.email).toBe('trader@example.com');
      expect(profile).not.toHaveProperty('passwordHash');
    });

    it('throws 404 when the user no longer exists', async () => {
      usersRepository.findById.mockResolvedValue(null);

      await expect(service.getProfile('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
