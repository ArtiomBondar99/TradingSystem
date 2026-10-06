import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailAlreadyExistsError } from '../users/errors/email-already-exists.error.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = { create: vi.fn() };
  const passwordHasher = { hash: vi.fn() };

  const dto = { email: 'trader@example.com', password: 'StrongPass1' };

  beforeEach(async () => {
    vi.clearAllMocks();
    passwordHasher.hash.mockResolvedValue('hashed-password');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PasswordHasher, useValue: passwordHasher },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('stores the hashed password, never the plain one', async () => {
      usersService.create.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.register(dto);

      expect(passwordHasher.hash).toHaveBeenCalledWith('StrongPass1');
      expect(usersService.create).toHaveBeenCalledWith(
        'trader@example.com',
        'hashed-password',
      );
    });

    it('does not return the password hash', async () => {
      usersService.create.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.register(dto);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('trader@example.com');
    });

    it('throws 409 Conflict when the email is taken', async () => {
      usersService.create.mockRejectedValue(
        new EmailAlreadyExistsError(dto.email),
      );

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
