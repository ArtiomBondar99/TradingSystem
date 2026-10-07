import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  // Trimmed first, so "   " becomes "" and is rejected by IsNotEmpty
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
