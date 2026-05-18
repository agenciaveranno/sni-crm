import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator'
import { UserRole } from '@prisma/client'

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string

  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  password!: string

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole
}
