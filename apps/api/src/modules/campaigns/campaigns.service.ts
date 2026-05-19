import { InjectQueue } from '@nestjs/bullmq'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import {
  CampaignStatus,
  type Prisma,
  RecipientStatus,
} from '@prisma/client'
import { Queue } from 'bullmq'
import { PrismaService } from '../../prisma/prisma.service'
import { CAMPAIGN_DISPATCH_QUEUE } from '../../queue/queue.module'
import type {
  CreateCampaignDto,
  ListCampaignsDto,
  UpdateCampaignDto,
} from './dto/campaign.dto'
import type {
  CampaignDispatchJobData,
  CampaignVariablesSpec,
  ParamSpec,
  ResolvedRecipientVariables,
} from './types'

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name)

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(CAMPAIGN_DISPATCH_QUEUE)
    private readonly queue: Queue<CampaignDispatchJobData>,
  ) {}

  async create(dto: CreateCampaignDto, userId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: dto.templateId },
      select: { id: true, whatsAppNumberId: true, status: true },
    })
    if (!template) throw new NotFoundException('Template não encontrado')
    if (template.status !== 'APPROVED') {
      throw new BadRequestException(
        'Só templates APPROVED podem ser usados em campanhas',
      )
    }
    if (template.whatsAppNumberId !== dto.whatsAppNumberId) {
      throw new BadRequestException(
        'Template não pertence a esse número WhatsApp',
      )
    }

    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        whatsAppNumberId: dto.whatsAppNumberId,
        templateId: dto.templateId,
        templateVariables: dto.templateVariables as Prisma.InputJsonValue,
        tagIds: dto.tagIds,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: dto.scheduledAt
          ? CampaignStatus.SCHEDULED
          : CampaignStatus.DRAFT,
        createdById: userId,
      },
    })
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const existing = await this.prisma.campaign.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Campanha não encontrada')
    if (
      existing.status !== CampaignStatus.DRAFT &&
      existing.status !== CampaignStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        'Só campanhas em DRAFT ou SCHEDULED podem ser editadas',
      )
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.whatsAppNumberId !== undefined && {
          whatsAppNumberId: dto.whatsAppNumberId,
        }),
        ...(dto.templateId !== undefined && { templateId: dto.templateId }),
        ...(dto.templateVariables !== undefined && {
          templateVariables: dto.templateVariables as Prisma.InputJsonValue,
        }),
        ...(dto.tagIds !== undefined && { tagIds: dto.tagIds }),
        ...(dto.scheduledAt !== undefined && {
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
          status: dto.scheduledAt
            ? CampaignStatus.SCHEDULED
            : CampaignStatus.DRAFT,
        }),
      },
    })
  }

  async list(dto: ListCampaignsDto) {
    const where: Prisma.CampaignWhereInput = {}
    if (dto.status) where.status = dto.status
    if (dto.search) where.name = { contains: dto.search, mode: 'insensitive' }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        include: {
          template: { select: { id: true, name: true } },
          whatsAppNumber: {
            select: { id: true, displayName: true, phoneNumber: true },
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.campaign.count({ where }),
    ])
    return { items, total, page: dto.page, pageSize: dto.pageSize }
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        template: true,
        whatsAppNumber: {
          select: { id: true, displayName: true, phoneNumber: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })
    if (!campaign) throw new NotFoundException('Campanha não encontrada')
    return campaign
  }

  async listRecipients(id: string, page = 1, pageSize = 50) {
    await this.findOne(id)
    const [items, total] = await this.prisma.$transaction([
      this.prisma.campaignRecipient.findMany({
        where: { campaignId: id },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          contact: { select: { id: true, name: true, phone: true } },
        },
      }),
      this.prisma.campaignRecipient.count({ where: { campaignId: id } }),
    ])
    return { items, total, page, pageSize }
  }

  async remove(id: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id } })
    if (!c) throw new NotFoundException('Campanha não encontrada')
    if (
      c.status === CampaignStatus.RUNNING ||
      c.status === CampaignStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        'Cancele a campanha antes de excluí-la',
      )
    }
    await this.prisma.campaign.delete({ where: { id } })
    return { ok: true }
  }

  /**
   * Materializa os recipients (snapshot da audiência) e enfileira os jobs.
   * Idempotente: se já houver recipients, só re-enfileira os PENDING.
   */
  async start(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { template: true },
    })
    if (!campaign) throw new NotFoundException('Campanha não encontrada')
    if (campaign.template.status !== 'APPROVED') {
      throw new BadRequestException('Template não está APPROVED')
    }
    if (
      campaign.status !== CampaignStatus.DRAFT &&
      campaign.status !== CampaignStatus.SCHEDULED &&
      campaign.status !== CampaignStatus.PAUSED
    ) {
      throw new BadRequestException(
        `Campanha em status ${campaign.status} não pode ser iniciada`,
      )
    }

    if (campaign.status === CampaignStatus.DRAFT) {
      await this.materializeRecipients(campaign.id)
    }

    const pending = await this.prisma.campaignRecipient.findMany({
      where: { campaignId: id, status: RecipientStatus.PENDING },
      select: { id: true },
    })

    if (pending.length === 0) {
      await this.prisma.campaign.update({
        where: { id },
        data: {
          status: CampaignStatus.COMPLETED,
          completedAt: new Date(),
        },
      })
      return { ok: true, enqueued: 0 }
    }

    await this.queue.addBulk(
      pending.map((r) => ({
        name: 'dispatch',
        data: { campaignId: id, recipientId: r.id },
        opts: {
          jobId: `campaign:${id}:recipient:${r.id}`,
          removeOnComplete: { age: 86_400, count: 5000 },
          removeOnFail: { age: 7 * 86_400 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
        },
      })),
    )

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.RUNNING,
        startedAt: campaign.startedAt ?? new Date(),
      },
    })
    this.logger.log(
      `Campanha ${id} iniciada: ${pending.length} jobs enfileirados`,
    )
    return { ok: true, enqueued: pending.length, campaign: updated }
  }

  async pause(id: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id } })
    if (!c) throw new NotFoundException('Campanha não encontrada')
    if (c.status !== CampaignStatus.RUNNING) {
      throw new BadRequestException('Só campanhas RUNNING podem ser pausadas')
    }
    await this.queue.pause()
    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.PAUSED },
    })
  }

  async resume(id: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id } })
    if (!c) throw new NotFoundException('Campanha não encontrada')
    if (c.status !== CampaignStatus.PAUSED) {
      throw new BadRequestException('Só campanhas PAUSED podem ser retomadas')
    }
    await this.queue.resume()
    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.RUNNING },
    })
  }

  async cancel(id: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id } })
    if (!c) throw new NotFoundException('Campanha não encontrada')
    if (
      c.status === CampaignStatus.COMPLETED ||
      c.status === CampaignStatus.CANCELLED
    ) {
      throw new BadRequestException(`Campanha já está em ${c.status}`)
    }

    // Remove jobs ainda PENDING para essa campanha
    const jobs = await this.queue.getJobs(['waiting', 'delayed', 'paused'])
    await Promise.all(
      jobs
        .filter((j) => j.data?.campaignId === id)
        .map((j) => j.remove().catch(() => undefined)),
    )

    await this.prisma.campaignRecipient.updateMany({
      where: { campaignId: id, status: RecipientStatus.PENDING },
      data: { status: RecipientStatus.SKIPPED },
    })

    return this.prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.CANCELLED,
        completedAt: new Date(),
      },
    })
  }

  private async materializeRecipients(campaignId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    })
    if (!campaign) throw new NotFoundException('Campanha não encontrada')

    const where: Prisma.ContactWhereInput = {
      optInStatus: 'OPTED_IN',
    }
    if (campaign.tagIds.length > 0) {
      where.tags = { some: { tagId: { in: campaign.tagIds } } }
    }

    const contacts = await this.prisma.contact.findMany({
      where,
      select: { id: true, name: true, phone: true, email: true },
    })

    const spec =
      (campaign.templateVariables as unknown as CampaignVariablesSpec) ?? {}

    const data = contacts.map((c) => {
      const resolved: ResolvedRecipientVariables = {
        headerParams: (spec.headerParams ?? []).map((p) => resolveParam(p, c)),
        bodyParams: (spec.bodyParams ?? []).map((p) => resolveParam(p, c)),
        buttonParams: (spec.buttonParams ?? []).map((b) => ({
          index: b.index,
          value: resolveParam(b.value, c),
        })),
      }
      return {
        campaignId,
        contactId: c.id,
        phone: c.phone,
        resolvedVariables: resolved as unknown as Prisma.InputJsonValue,
      }
    })

    if (data.length > 0) {
      await this.prisma.campaignRecipient.createMany({ data })
    }
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { totalRecipients: data.length },
    })
    this.logger.log(
      `Campanha ${campaignId}: ${data.length} recipients materializados`,
    )
  }
}

function resolveParam(
  p: ParamSpec,
  contact: { name: string; phone: string; email: string | null },
): string {
  if (p.kind === 'literal') return p.value
  const v = contact[p.field]
  return v ?? ''
}
