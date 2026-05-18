import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator'
import { NumberStatus } from '@prisma/client'

export class UpdateWhatsAppNumberDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string

  @IsOptional()
  @IsString()
  @MinLength(20)
  accessToken?: string

  @IsOptional()
  @IsString()
  @MinLength(8)
  webhookVerifyToken?: string

  @IsOptional()
  @IsEnum(NumberStatus)
  status?: NumberStatus

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}
