import { jest } from '@jest/globals';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '../generated/prisma/client.js';
import { EmailAlreadyExistsError } from '../users/errors/email-already-exists.error.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    create: jest.fn<UsersService['create']>(),
    findByEmail: jest.fn<UsersService['findByEmail']>(),
  };
  const passwordHasher = {
    hash: jest.fn<PasswordHasher['hash']>(),
    verify: jest.fn<PasswordHasher['verify']>(),
  };
  const jwtService = {
    signAsync: jest.fn<(payload: object) => Promise<string>>(),
  };
  const config = { getOrThrow: jest.fn<(key: string) => string>() };

  const storedUser: User = {
    id: 'user-1',
    email: 'trader@example.com',
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    passwordHasher.hash.mockResolvedValue('hashed-password');
    jwtService.signAsync.mockResolvedValue('signed.jwt.token');
    config.getOrThrow.mockReturnValue('15m');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PasswordHasher, useValue: passwordHasher },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    const dto = { email: 'trader@example.com', password: 'StrongPass1' };

    it('stores the hashed password, never the plain one', async () => {
      usersService.create.mockResolvedValue(storedUser);

      await service.register(dto);

      expect(passwordHasher.hash).toHaveBeenCalledWith('StrongPass1');
      expect(usersService.create).toHaveBeenCalledWith(
        'trader@example.com',
        'hashed-password',
      );
    });

    it('does not return the password hash', async () => {
      usersService.create.mockResolvedValue(storedUser);

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

  describe('login', () => {
    const dto = { email: 'trader@example.com', password: 'StrongPass1' };

    it('returns a signed access token for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(storedUser);
      passwordHasher.verify.mockResolvedValue(true);

      const result = await service.login(dto);

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'trader@example.com',
      });
      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        tokenType: 'Bearer',
        expiresIn: '15m',
      });
    });

    it('throws 401 for a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(storedUser);
      passwordHasher.verify.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('throws the same 401 for an unknown email, after still verifying a hash', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      passwordHasher.verify.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(
        'Invalid email or password',
      );
      // Timing protection: a hash is verified even when the user doesn't exist
      expect(passwordHasher.verify).toHaveBeenCalledTimes(1);
    });
  });
});
