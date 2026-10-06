import { Injectable } from '@nestjs/common';
import type { User } from '../generated/prisma/client.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  create(email: string, passwordHash: string): Promise<User> {
    return this.usersRepository.create({ email, passwordHash });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }
}
