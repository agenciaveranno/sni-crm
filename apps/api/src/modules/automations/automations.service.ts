import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import {
  ActionType,
  type AutomationRule,
  type Prisma,
  TriggerType,
} from '@prisma/client'
import axios from 'axios'
import { PrismaService } from '../../prisma/prisma.service'
import { MetaService } from '../meta/meta.service'

export interface CreateAutomationDto {
  name: string
  description?: string
  triggerType: TriggerType
  triggerConditions?: object
  actionType: ActionType
  actionConfig?: object
  active?: boolean
}

interface ContactPayload {
  id: string
  name: string
  phone: string
  email?: string | null
}

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaService,
  ) {}

  list() {
    return this.prisma.automationRule.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async findOne(id: string) {
    const r = await this.prisma.automationRule.findUnique({ where: { id } })
    if (!r) throw new NotFoundException('Regra não encontrada')
    return r
  }

  create(dto: CreateAutomationDto) {
    return this.prisma.automationRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        triggerType: dto.triggerType,
        triggerConditions: dto.triggerConditions as Prisma.InputJsonValue,
        actionType: dto.actionType,
        actionConfig: dto.actionConfig as Prisma.InputJsonValue,
        active: dto.active ?? true,
      },
    })
  }

  async update(id: string, dto: Partial<CreateAutomationDto>) {
    await this.findOne(id)
    return this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.triggerType !== undefined && { triggerType: dto.triggerType }),
        ...(dto.triggerConditions !== undefined && {
          triggerConditions: dto.triggerConditions as Prisma.InputJsonValue,
        }),
        ...(dto.actionType !== undefined && { actionType: dto.actionType }),
        ...(dto.actionConfig !== undefined && {
          actionConfig: dto.actionConfig as Prisma.InputJsonValue,
        }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    })
  }

  async remove(id: string) {
    await this.prisma.automationRule.delete({ where: { id } })
    return { ok: true }
  }

  /**
   * Disparada por webhooks/workers quando um trigger ocorre. Executa
   * todas as regras ativas pra esse triggerType.
   */
  async fire(trigger: TriggerType, contact: ContactPayload): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: { triggerType: trigger, active: true },
    })
    for (const rule of rules) {
      try {
        await this.execute(rule, contact)
      } catch (err) {
        this.logger.error(
          `Falha ao executar regra ${rule.id} (${rule.name}): ${
            err instanceof Error ? err.message : err
          }`,
        )
      }
    }
  }

  private async execute(
    rule: AutomationRule,
    contact: ContactPayload,
  ): Promise<void> {
    const config = (rule.actionConfig as Record<string, unknown>) ?? {}
    switch (rule.actionType) {
      case ActionType.SEND_TEMPLATE_MESSAGE:
        await this.sendTemplate(contact, config)
        break
      case ActionType.ADD_TAG:
        await this.applyTag(contact.id, config, 'add')
        break
      case ActionType.REMOVE_TAG:
        await this.applyTag(contact.id, config, 'remove')
        break
      case ActionType.CALL_WEBHOOK:
        await this.callWebhook(contact, config)
        break
    }
    await this.prisma.automationRule.update({
      where: { id: rule.id },
      data: {
        executionCount: { increment: 1 },
        lastExecutedAt: new Date(),
      },
    })
  }

  private async sendTemplate(
    contact: ContactPayload,
    config: Record<string, unknown>,
  ) {
    const templateName = config.templateName as string
    const numberId = config.whatsAppNumberId as string
    if (!templateName || !numberId) {
      throw new BadRequestException(
        'actionConfig precisa de whatsAppNumberId e templateName',
      )
    }
    const number = await this.prisma.whatsAppNumber.findUnique({
      where: { id: numberId },
    })
    if (!number) throw new BadRequestException('Número WA não encontrado')
    const template = await this.prisma.template.findFirst({
      where: { name: templateName, whatsAppNumberId: numberId, status: 'APPROVED' },
    })
    if (!template) {
      throw new BadRequestException(
        `Template ${templateName} não está APPROVED nesse número`,
      )
    }
    const vars = (config.variables as Record<string, string[]>) ?? {}
    await this.meta.sendTemplate({
      phoneNumberId: number.phoneNumberId,
      accessToken: number.accessToken,
      to: contact.phone.replace(/^\+/, ''),
      templateName: template.name,
      language: template.language,
      bodyParams: vars.body ?? [],
      headerParams: vars.header ?? [],
    })
  }

  private async applyTag(
    contactId: string,
    config: Record<string, unknown>,
    mode: 'add' | 'remove',
  ) {
    const tagId = config.tagId as string
    if (!tagId) throw new BadRequestException('actionConfig.tagId requerido')
    if (mode === 'add') {
      await this.prisma.contactTag.upsert({
        where: { contactId_tagId: { contactId, tagId } },
        update: {},
        create: { contactId, tagId, assignedBy: 'automation' },
      })
    } else {
      await this.prisma.contactTag.deleteMany({
        where: { contactId, tagId },
      })
    }
  }

  private async callWebhook(
    contact: ContactPayload,
    config: Record<string, unknown>,
  ) {
    const url = config.url as string
    if (!url) throw new BadRequestException('actionConfig.url requerido')
    await axios.post(
      url,
      { contact, automation: true },
      { timeout: 8000 },
    )
  }
}
