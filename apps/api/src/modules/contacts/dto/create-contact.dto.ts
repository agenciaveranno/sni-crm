import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

export class CreateContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[]
}
