import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class PasswordResetRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Was a link created for this user after `since`? (anti-spam cooldown) */
  async existsSince(userId: string, since: Date): Promise<boolean> {
    const count = await this.prisma.passwordResetToken.count({
      where: { userId, createdAt: { gt: since } },
    });
    return count > 0;
  }

  /**
   * Saves a new link and deletes the user's older unused ones, in one
   * transaction: only the newest link in the user's inbox works.
   */
  async replace(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({
        where: { userId, usedAt: null },
      }),
      this.prisma.passwordResetToken.create({
        data: { userId, tokenHash, expiresAt },
      }),
    ]);
  }

  /**
   * Uses the link and sets the new password, all or nothing. Returns the
   * user's id, or null when the link is unknown, already used or expired.
   */
  async consume(
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      if (!token) {
        return null;
      }

      // A conditional UPDATE, not "read used_at, then write": with two
      // requests for the same link at once, the second one waits for the
      // first's row lock, re-checks "used_at IS NULL" after it commits, and
      // updates 0 rows. So a link can never be used twice.
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (count === 0) {
        return null;
      }

      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      });
      // Any other open link for this account stops working too
      await tx.passwordResetToken.deleteMany({
        where: { userId: token.userId, usedAt: null },
      });

      return token.userId;
    });
  }
}
