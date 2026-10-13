import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  /** @example ada@example.com */
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** @example StrongPass1 */
  // No MinLength here: password rules are enforced at registration
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
