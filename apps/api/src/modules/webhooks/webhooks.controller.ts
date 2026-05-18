import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { Public } from '../../common/decorators/public.decorator'
import { WebhooksService } from './webhooks.service'

@Controller('webhooks/meta')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name)

  constructor(private readonly service: WebhooksService) {}

  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    if (mode !== 'subscribe' || !this.service.isVerifyTokenValid(token)) {
      throw new ForbiddenException()
    }
    return challenge
  }

  @Public()
  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: unknown,
  ): Promise<{ received: true }> {
    const signature = req.header('x-hub-signature-256') ?? ''
    const raw = req.rawBody
    if (!raw) {
      throw new BadRequestException('Raw body indisponível')
    }
    if (!this.service.isSignatureValid(raw, signature)) {
      throw new ForbiddenException('Assinatura inválida')
    }

    // Meta exige resposta rápida. Processa best-effort; falha de persistência
    // não devolve erro pra Meta (evitar loop de retry em registros já vistos).
    try {
      await this.service.handleEvent(body)
    } catch (err) {
      this.logger.error('Falha processando webhook Meta', err as Error)
    }
    return { received: true }
  }
}
