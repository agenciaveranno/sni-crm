import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  MessageDirection,
  MessageStatus,
  MessageType,
  OptInMethod,
  OptInStatus,
} from '@prisma/client'
import * as crypto from 'crypto'
import { isOptOutMessage, normalizePhone } from '@kotodama/shared'
import { PrismaService } from '../../prisma/prisma.service'
import { AutomationsService } from '../automations/automations.service'

type MetaWebhookEntry = {
  changes?: Array<{
    field?: string
    value?: {
      metadata?: { phone_number_id?: string }
      contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>
      messages?: Array<MetaIncomingMessage>
      statuses?: Array<MetaStatusUpdate>
    }
  }>
}

type MetaIncomingMessage = {
  id?: string
  from?: string
  type?: string
  timestamp?: string
  text?: { body?: string }
}

type MetaStatusUpdate = {
  id?: string
  status?: string
  timestamp?: string
  recipient_id?: string
  errors?: Array<{
    code?: number
    title?: string
    message?: string
    error_data?: { details?: string }
  }>
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name)
  private readonly verifyToken: string
  private readonly appSecret: string

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly automations: AutomationsService,
  ) {
    this.verifyToken = this.config.get<string>('META_VERIFY_TOKEN', '')
    this.appSecret = this.config.get<string>('META_APP_SECRET', '')
    if (!this.appSecret) {
      this.logger.warn(
        'META_APP_SECRET ausente. Assinatura do webhook não será validada — não usar assim em produção real.',
      )
    }
  }

  isVerifyTokenValid(token: string): boolean {
    return !!this.verifyToken && token === this.verifyToken
  }

  isSignatureValid(rawBody: Buffer, header: string): boolean {
    if (!this.appSecret) return true // modo dev — vide warn no construtor
    if (!header) {
      this.logger.warn('POST recebido sem X-Hub-Signature-256')
      return false
    }
    if (!header.startsWith('sha256=')) {
      this.logger.warn(`X-Hub-Signature-256 com prefixo inesperado: ${header.slice(0, 16)}`)
      return false
    }
    const expected = crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex')
    const received = header.slice('sha256='.length)
    if (expected.length !== received.length) {
      this.logger.warn('Assinatura com tamanho inesperado')
      return false
    }
    const ok = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(received, 'hex'),
    )
    if (!ok) {
      this.logger.warn(
        'Assinatura inválida — META_APP_SECRET no Railway provavelmente não bate com App Secret do Meta',
      )
    }
    return ok
  }

  async handleEvent(payload: unknown): Promise<void> {
    const entries = (payload as { entry?: MetaWebhookEntry[] })?.entry ?? []
    this.logger.log(
      `Webhook recebido: ${entries.length} entry(ies), object=${(payload as { object?: string })?.object ?? '?'}`,
    )
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue
        const value = change.value
        if (!value) continue
        const phoneNumberId = value.metadata?.phone_number_id
        if (!phoneNumberId) continue

        const number = await this.prisma.whatsAppNumber.findUnique({
          where: { phoneNumberId },
          select: { id: true },
        })
        if (!number) {
          this.logger.warn(
            `Webhook recebido para phoneNumberId=${phoneNumberId} não cadastrado`,
          )
          continue
        }

        const contactsByWaId = new Map<string, string | undefined>()
        for (const c of value.contacts ?? []) {
          if (c.wa_id) contactsByWaId.set(c.wa_id, c.profile?.name)
        }

        for (const m of value.messages ?? []) {
          await this.persistIncoming(number.id, m, contactsByWaId.get(m.from ?? ''))
        }

        for (const s of value.statuses ?? []) {
          await this.persistStatus(s)
        }
      }
    }
  }

  private async persistStatus(s: MetaStatusUpdate): Promise<void> {
    if (!s.id || !s.status) return
    const mapped = this.mapStatus(s.status)
    if (!mapped) {
      this.logger.warn(`Status desconhecido recebido: ${s.status}`)
      return
    }
    const result = await this.prisma.inboxMessage.updateMany({
      where: { waMessageId: s.id },
      data: { status: mapped },
    })
    this.logger.log(
      `Status update: waMessageId=${s.id} status=${s.status} (matched=${result.count})`,
    )

    await this.applyCampaignRecipientStatus(s)
  }

  private async applyCampaignRecipientStatus(
    s: MetaStatusUpdate,
  ): Promise<void> {
    const recipient = await this.prisma.campaignRecipient.findFirst({
      where: { waMessageId: s.id },
      select: { id: true, campaignId: true, status: true },
    })
    if (!recipient) return

    if (s.status === 'delivered' && recipient.status !== 'DELIVERED') {
      await this.prisma.$transaction([
        this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'DELIVERED', deliveredAt: new Date() },
        }),
        this.prisma.campaign.update({
          where: { id: recipient.campaignId },
          data: { deliveredCount: { increment: 1 } },
        }),
      ])
    } else if (s.status === 'read' && recipient.status !== 'READ') {
      await this.prisma.$transaction([
        this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'READ', readAt: new Date() },
        }),
        this.prisma.campaign.update({
          where: { id: recipient.campaignId },
          data: { readCount: { increment: 1 } },
        }),
      ])
    } else if (s.status === 'failed' && recipient.status !== 'FAILED') {
      const errMessage =
        s.errors?.[0]?.title ?? s.errors?.[0]?.message ?? 'falha desconhecida'
      await this.prisma.$transaction([
        this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorCode: s.errors?.[0]?.code?.toString() ?? null,
            errorMessage: errMessage.slice(0, 1000),
          },
        }),
        this.prisma.campaign.update({
          where: { id: recipient.campaignId },
          data: { failedCount: { increment: 1 } },
        }),
      ])
    }
  }

  private mapStatus(s: string): MessageStatus | null {
    switch (s) {
      case 'sent':
        return MessageStatus.SENT
      case 'delivered':
        return MessageStatus.DELIVERED
      case 'read':
        return MessageStatus.READ
      case 'failed':
        return MessageStatus.FAILED
      default:
        return null
    }
  }

  private async persistIncoming(
    whatsAppNumberId: string,
    m: MetaIncomingMessage,
    profileName: string | undefined,
  ): Promise<void> {
    if (!m.id || !m.from) return
    const phone = normalizePhone(m.from)
    if (!phone) {
      this.logger.warn(`Mensagem ${m.id} com telefone inválido: ${m.from}`)
      return
    }

    const contact = await this.prisma.contact.upsert({
      where: { phone },
      update: {},
      create: { phone, name: profileName?.trim() || phone },
      select: { id: true, name: true, phone: true, email: true, optInStatus: true },
    })

    const content =
      m.type === 'text'
        ? { text: m.text?.body ?? '' }
        : { raw: m }

    await this.prisma.inboxMessage.upsert({
      where: { waMessageId: m.id },
      update: {},
      create: {
        direction: MessageDirection.INBOUND,
        contactId: contact.id,
        whatsAppNumberId,
        waMessageId: m.id,
        messageType: this.mapMessageType(m.type),
        content,
        status: MessageStatus.RECEIVED,
        receivedAt: m.timestamp
          ? new Date(Number(m.timestamp) * 1000)
          : new Date(),
      },
    })
    this.logger.log(
      `Mensagem inbound persistida: waMessageId=${m.id} type=${m.type} contactId=${contact.id}`,
    )

    // Detecta opt-out por palavra-chave no texto.
    const text = m.type === 'text' ? m.text?.body ?? '' : ''
    if (text && isOptOutMessage(text)) {
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: {
          optInStatus: OptInStatus.OPTED_OUT,
          optInMethod: OptInMethod.MANUAL,
        },
      })
      this.logger.log(
        `Opt-out detectado de contactId=${contact.id} (texto="${text.slice(0, 40)}")`,
      )
      await this.automations.fire('OPT_OUT_RECEIVED', {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
      })
    } else {
      await this.automations.fire('INBOUND_MESSAGE', {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
      })
    }
  }

  private mapMessageType(t: string | undefined): MessageType {
    switch (t) {
      case 'text':
        return MessageType.TEXT
      case 'image':
        return MessageType.IMAGE
      case 'document':
        return MessageType.DOCUMENT
      case 'audio':
        return MessageType.AUDIO
      case 'video':
        return MessageType.VIDEO
      case 'sticker':
        return MessageType.STICKER
      case 'location':
        return MessageType.LOCATION
      case 'interactive':
        return MessageType.INTERACTIVE
      case 'template':
        return MessageType.TEMPLATE
      default:
        return MessageType.UNKNOWN
    }
  }
}
