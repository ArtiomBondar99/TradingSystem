import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  /** @example ada@example.com */
  // Same normalization as register and login, or "Ada@x.com " wouldn't match
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class ForgotPasswordResponseDto {
  /** @example If an account exists for this email, we sent a link to reset its password. */
  message: string;
}
