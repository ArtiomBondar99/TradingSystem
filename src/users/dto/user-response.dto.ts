import type { User } from '../../generated/prisma/client.js';

// The public shape of a user. Never includes passwordHash.
export class UserResponseDto {
  id: string;
  email: string;
  createdAt: Date;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}
