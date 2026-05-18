import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

class ButtonParam {
  @IsString()
  index!: string

  @IsString()
  value!: string
}

export class SendMessageDto {
  /** Texto livre. Mutuamente exclusivo com templateId. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  body?: string

  /** Opcional: enviar de um número específico. Default = isDefault ACTIVE. */
  @IsOptional()
  @IsString()
  whatsAppNumberId?: string

  /** Quando informado, envia template em vez de free-form text. */
  @IsOptional()
  @IsString()
  templateId?: string

  /** Valores das variáveis do header, na ordem. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  headerParams?: string[]

  /** Valores das variáveis do body, na ordem. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bodyParams?: string[]

  /** Valores das variáveis de URL buttons. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ButtonParam)
  buttonParams?: ButtonParam[]
}
