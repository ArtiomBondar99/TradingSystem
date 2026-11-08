import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /** The token from the emailed link (43 characters) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  token: string;

  /** @example NewStrongPass1 */
  // The same rules as at registration
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
