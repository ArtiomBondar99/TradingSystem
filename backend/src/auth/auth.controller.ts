import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { RateLimit } from '../common/decorators/rate-limit.decorator.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { AuthService } from './auth.service.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

// 5 attempts per minute per IP: plenty for a human, useless for a script
// guessing passwords (brute force) or mass-creating accounts
export const AUTH_RATE_LIMIT = { limit: 5, windowMs: 60_000 };

@ApiTags('auth')
@Controller('auth')
@RateLimit(AUTH_RATE_LIMIT)
@ApiTooManyRequestsResponse({
  description: `More than ${AUTH_RATE_LIMIT.limit} requests per minute from this IP. See the Retry-After header.`,
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }
}
