import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { MailService } from '../mail/mail.service.js';
import { UsersService } from '../users/users.service.js';
import { PasswordHasher } from './password-hasher.service.js';
import {
  passwordChangedMail,
  resetLinkMail,
} from './password-reset.mails.js';
import { PasswordResetRepository } from './password-reset.repository.js';

// Short: a link sitting in an inbox is a key to the account
export const PASSWORD_RESET_TTL_MINUTES = 30;
// At most one mail a minute per account: nobody can flood someone's inbox
export const PASSWORD_RESET_COOLDOWN_MS = 60_000;

export const INVALID_RESET_LINK =
  'This reset link is invalid or has expired. Request a new one.';

// For the log. error.message alone can be empty: a refused connection to
// "localhost" is an AggregateError (IPv6 and IPv4 both refused) with
// message "" and the reason only in code (ECONNREFUSED)
function describeError(error: unknown): string {
  if (error instanceof Error) {
    const { code } = error as NodeJS.ErrnoException;
    return [code, error.message].filter(Boolean).join(' ') || error.name;
  }
  return String(error);
}

/**
 * SHA-256, not argon2 like passwords: the token is 32 random bytes, so there
 * is nothing to guess, and a fast hash can be looked up by its value.
 */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly repository: PasswordResetRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Returns at once and does the work in the background. Waiting would make
   * the answer slower for registered emails (database + SMTP) than for
   * unknown ones, and that difference alone would tell who has an account.
   */
  requestReset(email: string): void {
    this.sendResetLink(email).catch((error: unknown) =>
      this.logger.error({
        action: 'password_reset.request_failed',
        msg: `Could not send a reset link: ${describeError(error)}`,
      }),
    );
  }

  async sendResetLink(email: string, now = new Date()): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.warn({
        action: 'password_reset.unknown_email',
        msg: 'Password reset for an unknown email',
      });
      return;
    }

    const cooldownStart = new Date(
      now.getTime() - PASSWORD_RESET_COOLDOWN_MS,
    );
    if (await this.repository.existsSince(user.id, cooldownStart)) {
      this.logger.warn({
        action: 'password_reset.throttled',
        userId: user.id,
        msg: 'Password reset asked again within the cooldown',
      });
      return;
    }

    // 32 random bytes (256 bits) from the OS's secure generator, as
    // URL-safe text. Only its hash is stored.
    const token = randomBytes(32).toString('base64url');
    await this.repository.replace(
      user.id,
      hashResetToken(token),
      new Date(now.getTime() + PASSWORD_RESET_TTL_MINUTES * 60_000),
    );

    const frontendUrl = this.config.getOrThrow<string>('app.frontendUrl');
    await this.mail.send(
      resetLinkMail(
        user.email,
        user.firstName,
        `${frontendUrl}/reset-password?token=${token}`,
        PASSWORD_RESET_TTL_MINUTES,
      ),
    );
    this.logger.log({
      action: 'password_reset.requested',
      userId: user.id,
      msg: 'Password reset link sent',
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Hashed before the transaction: argon2 takes ~50 ms on purpose, and
    // the database transaction should stay short
    const passwordHash = await this.passwordHasher.hash(newPassword);
    const userId = await this.repository.consume(
      hashResetToken(token),
      passwordHash,
      new Date(),
    );

    if (!userId) {
      // One message for unknown, used and expired: no hints for guessing
      this.logger.warn({
        action: 'password_reset.invalid_link',
        msg: 'Password reset with an invalid or expired link',
      });
      throw new BadRequestException(INVALID_RESET_LINK);
    }

    this.logger.log({
      action: 'password_reset.completed',
      userId,
      msg: 'Password reset',
    });

    // The password is already changed: a failing notice mustn't undo that
    // or turn the answer into an error, so it's only logged
    this.usersService
      .getProfile(userId)
      .then((user) =>
        this.mail.send(passwordChangedMail(user.email, user.firstName)),
      )
      .catch((error: unknown) =>
        this.logger.error({
          action: 'password_reset.notice_failed',
          userId,
          msg: `Could not send the password changed notice: ${describeError(error)}`,
        }),
      );
  }
}
