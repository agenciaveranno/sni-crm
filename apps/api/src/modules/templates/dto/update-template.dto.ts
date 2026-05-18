import { IsArray, IsEnum, IsOptional } from 'class-validator'
import { TemplateCategory } from '@prisma/client'

export class UpdateTemplateDto {
  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory

  @IsOptional()
  @IsArray()
  components?: Array<Record<string, unknown>>
}
