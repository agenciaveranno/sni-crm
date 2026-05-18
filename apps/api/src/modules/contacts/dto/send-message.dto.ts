import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class SendMessageDto {
  /** Corpo do texto (free-form, dentro da janela de 24h da Meta). */
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  body!: string

  /** Opcional: enviar de um número específico. Default = número marcado como isDefault. */
  @IsOptional()
  @IsString()
  whatsAppNumberId?: string
}
