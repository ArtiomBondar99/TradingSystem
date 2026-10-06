import { ConflictException, Injectable } from '@nestjs/common';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { EmailAlreadyExistsError } from '../users/errors/email-already-exists.error.js';
import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { PasswordHasher } from './password-hasher.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const passwordHash = await this.passwordHasher.hash(dto.password);

    try {
      const user = await this.usersService.create(dto.email, passwordHash);
      return UserResponseDto.fromEntity(user);
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }
}
