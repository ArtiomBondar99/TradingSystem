import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, type User } from '../generated/prisma/client.js';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error.js';
import type { CreateUserInput } from './types/create-user.input.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Creates the user and their wallet in one atomic write:
  // either both rows exist afterwards, or neither does.
  async createWithWallet(
    data: CreateUserInput & { initialBalance: string },
  ): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          passwordHash: data.passwordHash,
          wallet: { create: { balance: data.initialBalance } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new EmailAlreadyExistsError(data.email);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
