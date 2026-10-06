import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '../generated/prisma/client.js';
import { INITIAL_WALLET_BALANCE } from '../wallets/wallets.constants.js';
import { UsersRepository } from './users.repository.js';
import { UserResponseDto } from './dto/user-response.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  create(email: string, passwordHash: string): Promise<User> {
    return this.usersRepository.createWithWallet({
      email,
      passwordHash,
      initialBalance: INITIAL_WALLET_BALANCE,
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return UserResponseDto.fromEntity(user);
  }
}
