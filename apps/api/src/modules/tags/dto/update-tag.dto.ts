import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string

  @IsOptional()
  @IsHexColor()
  color?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}
