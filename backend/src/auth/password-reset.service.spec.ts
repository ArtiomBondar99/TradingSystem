import { jest } from '@jest/globals';
import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { User } from '../generated/prisma/client.js';
import { MailService, type MailMessage } from '../mail/mail.service.js';
import { UsersService } from '../users/users.service.js';
import { PasswordHasher } from './password-hasher.service.js';
import { PasswordResetRepository } from './password-reset.repository.js';
import {
  hashResetToken,
  PASSWORD_RESET_COOLDOWN_MS,
  PasswordResetService,
} from './password-reset.service.js';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  const usersService = {
    findByEmail: jest.fn<UsersService['findByEmail']>(),
    getProfile: jest.fn<UsersService['getProfile']>(),
  };
  const repository = {
    existsSince: jest.fn<PasswordResetRepository['existsSince']>(),
    replace: jest.fn<PasswordResetRepository['replace']>(),
    consume: jest.fn<PasswordResetRepository['consume']>(),
  };
  const passwordHasher = { hash: jest.fn<PasswordHasher['hash']>() };
  const mail = { send: jest.fn<MailService['send']>() };
  const config = { getOrThrow: jest.fn(() => 'http://localhost:5173') };

  const user: User = {
    id: 'user-1',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    passwordHash: 'old-hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const now = new Date('2026-11-08T12:00:00.000Z');

  const sentMail = (call = 0) => mail.send.mock.calls[call][0] as MailMessage;
  const tokenFromLink = (text: string) =>
    /reset-password\?token=([\w-]+)/.exec(text)?.[1];

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    usersService.findByEmail.mockResolvedValue(user);
    repository.existsSince.mockResolvedValue(false);
    repository.replace.mockResolvedValue();
    passwordHasher.hash.mockResolvedValue('new-hash');
    mail.send.mockResolvedValue();

    const module = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: UsersService, useValue: usersService },
        { provide: PasswordResetRepository, useValue: repository },
        { provide: PasswordHasher, useValue: passwordHasher },
        { provide: MailService, useValue: mail },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(PasswordResetService);
  });

  describe('sendResetLink', () => {
    it('mails a link and stores only the hash of its token, valid 30 min', async () => {
      await service.sendResetLink('ada@example.com', now);

      const message = sentMail();
      expect(message.to).toBe('ada@example.com');
      const token = tokenFromLink(message.text);
      expect(token).toHaveLength(43); // 32 bytes in base64url
      expect(message.html).toContain(token);

      const [userId, storedHash, expiresAt] = repository.replace.mock.calls[0];
      expect(userId).toBe('user-1');
      expect(storedHash).toBe(hashResetToken(token!));
      expect(storedHash).not.toContain(token);
      expect(expiresAt).toEqual(new Date('2026-11-08T12:30:00.000Z'));
    });

    it('gives every request a different token', async () => {
      await service.sendResetLink('ada@example.com', now);
      await service.sendResetLink('ada@example.com', now);

      expect(tokenFromLink(sentMail(0).text)).not.toBe(
        tokenFromLink(sentMail(1).text),
      );
    });

    it('does nothing for an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await service.sendResetLink('nobody@example.com', now);

      expect(repository.replace).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('sends no second mail within the cooldown', async () => {
      repository.existsSince.mockResolvedValue(true);

      await service.sendResetLink('ada@example.com', now);

      expect(repository.existsSince).toHaveBeenCalledWith(
        'user-1',
        new Date(now.getTime() - PASSWORD_RESET_COOLDOWN_MS),
      );
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('escapes HTML in the name the user chose', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...user,
        firstName: '<a href="https://evil.example">Ada</a>',
      });

      await service.sendResetLink('ada@example.com', now);

      expect(sentMail().html).not.toContain('<a href="https://evil');
      expect(sentMail().html).toContain('&lt;a href=&quot;https://evil');
    });
  });

  describe('requestReset', () => {
    it('logs a failure instead of throwing (the answer was already sent)', async () => {
      const errorLog = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      mail.send.mockRejectedValue(new Error('connect ECONNREFUSED'));

      expect(() => service.requestReset('ada@example.com')).not.toThrow();

      await new Promise((resolve) => setImmediate(resolve));
      expect(errorLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'password_reset.request_failed' }),
      );
    });
  });

  describe('resetPassword', () => {
    it('hashes the new password and uses the link by the hash of its token', async () => {
      repository.consume.mockResolvedValue('user-1');
      usersService.getProfile.mockResolvedValue({
        id: 'user-1',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        createdAt: new Date(),
      });

      await service.resetPassword('the-token', 'NewStrongPass1');

      expect(passwordHasher.hash).toHaveBeenCalledWith('NewStrongPass1');
      expect(repository.consume).toHaveBeenCalledWith(
        hashResetToken('the-token'),
        'new-hash',
        expect.any(Date),
      );
      await new Promise((resolve) => setImmediate(resolve));
      expect(sentMail().subject).toBe('Your PaperTrade password was changed');
    });

    it('rejects an unknown, used or expired link with 400', async () => {
      repository.consume.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'NewStrongPass1'),
      ).rejects.toThrow(BadRequestException);
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('still succeeds when the "password changed" notice fails', async () => {
      repository.consume.mockResolvedValue('user-1');
      usersService.getProfile.mockRejectedValue(new Error('db down'));

      await expect(
        service.resetPassword('the-token', 'NewStrongPass1'),
      ).resolves.toBeUndefined();
    });
  });
});
