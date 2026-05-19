import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import {
  CampaignStatus,
  MessageDirection,
  MessageStatus,
  MessageType,
  type Prisma,
  RecipientStatus,
} from '@prisma/client'
import type { Job } from 'bullmq'
import { PrismaService } from '../../prisma/prisma.service'
import { CAMPAIGN_DISPATCH_QUEUE } from '../../queue/queue.module'
import { MetaService } from '../meta/meta.service'
import type {
  CampaignDispatchJobData,
  ResolvedRecipientVariables,
} from './types'

@Processor(CAMPAIGN_DISPATCH_QUEUE, {
  concurrency: 4,
  limiter: { max: 60, duration: 60_000 },
})
export class CampaignDispatcherProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignDispatcherProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaService,
  ) {
    super()
  }

  async process(job: Job<CampaignDispatchJobData>): Promise<void> {
    const { campaignId, recipientId } = job.data

    const recipient = await this.prisma.campaignRecipient.findUnique({
      where: { id: recipientId },
      include: {
        contact: true,
        campaign: {
          include: {
            template: true,
            whatsAppNumber: true,
          },
        },
      },
    })
    if (!recipient) {
      this.logger.warn(`Recipient ${recipientId} não encontrado, skip`)
      return
    }
    if (recipient.status !== RecipientStatus.PENDING) {
      return
    }
    if (recipient.contact.optInStatus === 'OPTED_OUT') {
      await this.prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: { status: RecipientStatus.OPTED_OUT },
      })
      await this.bumpCounter(campaignId, 'optOutCount')
      return
    }

    const { campaign } = recipient
    const number = campaign.whatsAppNumber
    const template = campaign.template
    const resolved =
      (recipient.resolvedVariables as unknown as ResolvedRecipientVariables) ??
      { headerParams: [], bodyParams: [], buttonParams: [] }

    const toDigits = recipient.phone.replace(/^\+/, '')

    try {
      const { waMessageId } = await this.meta.sendTemplate({
        phoneNumberId: number.phoneNumberId,
        accessToken: number.accessToken,
        to: toDigits,
        templateName: template.name,
        language: template.language,
        headerParams: resolved.headerParams,
        bodyParams: resolved.bodyParams,
        buttonParams: resolved.buttonParams,
      })

      await this.prisma.$transaction([
        this.prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: {
            status: RecipientStatus.SENT,
            waMessageId,
            sentAt: new Date(),
          },
        }),
        this.prisma.inboxMessage.create({
          data: {
            direction: MessageDirection.OUTBOUND,
            contactId: recipient.contactId,
            whatsAppNumberId: number.id,
            waMessageId,
            messageType: MessageType.TEMPLATE,
            content: {
              templateId: template.id,
              templateName: template.name,
              campaignId,
              headerParams: resolved.headerParams,
              bodyParams: resolved.bodyParams,
              buttonParams: resolved.buttonParams,
            } as Prisma.InputJsonValue,
            status: MessageStatus.SENT,
            receivedAt: new Date(),
          },
        }),
      ])

      await this.bumpCounter(campaignId, 'sentCount')
      await this.maybeMarkCompleted(campaignId)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.warn(
        `Falha ao enviar recipient ${recipientId}: ${message} (tentativa ${job.attemptsMade + 1}/${job.opts.attempts})`,
      )

      const willRetry = (job.attemptsMade + 1) < (job.opts.attempts ?? 1)
      if (!willRetry) {
        await this.prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: {
            status: RecipientStatus.FAILED,
            failedAt: new Date(),
            errorMessage: message.slice(0, 1000),
          },
        })
        await this.bumpCounter(campaignId, 'failedCount')
        await this.maybeMarkCompleted(campaignId)
      }
      throw err
    }
  }

  private async bumpCounter(
    campaignId: string,
    field:
      | 'sentCount'
      | 'failedCount'
      | 'optOutCount'
      | 'deliveredCount'
      | 'readCount',
  ): Promise<void> {
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { [field]: { increment: 1 } },
    })
  }

  private async maybeMarkCompleted(campaignId: string): Promise<void> {
    const c = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        status: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
        optOutCount: true,
      },
    })
    if (!c || c.status !== CampaignStatus.RUNNING) return
    const processed = c.sentCount + c.failedCount + c.optOutCount
    if (processed >= c.totalRecipients) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.COMPLETED,
          completedAt: new Date(),
        },
      })
      this.logger.log(`Campanha ${campaignId} marcada COMPLETED`)
    }
  }
}
