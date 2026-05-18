import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator'
import { TemplateCategory } from '@prisma/client'

export class CreateTemplateDto {
  @IsString()
  @MinLength(5)
  whatsAppNumberId!: string

  @IsString()
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Use apenas letras minúsculas, dígitos e _',
  })
  @MinLength(2)
  name!: string

  @IsEnum(TemplateCategory)
  category!: TemplateCategory

  @IsOptional()
  @IsString()
  language?: string

  /**
   * Array de componentes no formato da Meta:
   * [{ type: 'BODY', text: 'Olá {{1}}, ...' }, { type: 'FOOTER', text: '...' }]
   */
  @IsArray()
  components!: Array<Record<string, unknown>>

  @IsOptional()
  @IsObject()
  variables?: unknown
}
