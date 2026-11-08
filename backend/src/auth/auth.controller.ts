import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { RateLimit } from '../common/decorators/rate-limit.decorator.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { AuthService } from './auth.service.js';
import {
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
} from './dto/forgot-password.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import {
  INVALID_RESET_LINK,
  PasswordResetService,
} from './password-reset.service.js';

// 5 attempts per minute per IP: plenty for a human, useless for a script
// guessing passwords (brute force) or mass-creating accounts
export const AUTH_RATE_LIMIT = { limit: 5, windowMs: 60_000 };

// The same answer whether the email is registered or not
export const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for this email, we sent a link to reset its password.';

@ApiTags('auth')
@Controller('auth')
@RateLimit(AUTH_RATE_LIMIT)
@ApiTooManyRequestsResponse({
  description: `More than ${AUTH_RATE_LIMIT.limit} requests per minute from this IP. See the Retry-After header.`,
})
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  // 202 Accepted: the request is taken, the mail goes out in the background
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    type: ForgotPasswordResponseDto,
    description:
      'Always this answer, registered email or not, so it never reveals who has an account',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto): ForgotPasswordResponseDto {
    this.passwordResetService.requestReset(dto.email);
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Password changed. Log in with it.' })
  @ApiBadRequestResponse({ description: INVALID_RESET_LINK })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.passwordResetService.resetPassword(dto.token, dto.password);
  }
}
