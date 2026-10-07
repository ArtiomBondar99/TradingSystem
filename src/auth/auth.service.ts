import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { EmailAlreadyExistsError } from '../users/errors/email-already-exists.error.js';
import { UsersService } from '../users/users.service.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { PasswordHasher } from './password-hasher.service.js';
import type { JwtPayload } from './types/authenticated-user.js';

// Verified against when the email doesn't exist, so the response time is the
// same as for a wrong password. Otherwise timing would reveal which emails exist.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$XQFMnl+RE5XMlAit5Lg+/Q$NLEQDgtEgGoVGkn/nXb9oxBVNZRAMJpzkrTE+8XMeBI';

@Injectable()
export class AuthService {
  // Routed to Pino (see main.ts); reqId and userId are attached automatically
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const passwordHash = await this.passwordHasher.hash(dto.password);

    try {
      const user = await this.usersService.create({
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
      });
      this.logger.log({
        action: 'user.registered',
        userId: user.id,
        msg: 'User registered',
      });
      return UserResponseDto.fromEntity(user);
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        // No email in the log: it's personal data, and the action is enough
        this.logger.warn({
          action: 'user.register_conflict',
          msg: 'Registration with an existing email',
        });
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);

    const passwordMatches = await this.passwordHasher.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      dto.password,
    );

    if (!user || !passwordMatches) {
      // The reason is logged for us, never returned to the client
      this.logger.warn({
        action: 'user.login_failed',
        reason: user ? 'wrong_password' : 'unknown_email',
        userId: user?.id,
        msg: 'Login failed',
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log({
      action: 'user.login',
      userId: user.id,
      msg: 'User logged in',
    });

    const payload: JwtPayload = { sub: user.id, email: user.email };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.getOrThrow<string>('jwt.expiresIn'),
    };
  }
}
