import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

export class CreateWhatsAppNumberDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phoneNumber!: string

  @IsString()
  @MinLength(5)
  phoneNumberId!: string

  @IsString()
  @MinLength(5)
  wabaId!: string

  @IsString()
  @MinLength(20)
  accessToken!: string

  @IsString()
  @MinLength(8)
  webhookVerifyToken!: string

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}
