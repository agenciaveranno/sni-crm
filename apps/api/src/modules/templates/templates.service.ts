import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, TemplateCategory, TemplateStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { MetaService, type MetaTemplate } from '../meta/meta.service'
import { WhatsAppNumbersService } from '../whatsapp-numbers/whatsapp-numbers.service'
import { CreateTemplateDto } from './dto/create-template.dto'
import { UpdateTemplateDto } from './dto/update-template.dto'

/**
 * Extrai variáveis {{N}} do body do template.
 * Retorna lista ordenada e única (ex.: ["1", "2", "3"]).
 */
export function extractTemplateVariables(
  components: Array<Record<string, unknown>>,
): string[] {
  const body = components.find(
    (c) => (c.type as string)?.toUpperCase() === 'BODY',
  )
  if (!body || typeof body.text !== 'string') return []
  const found = new Set<string>()
  const re = /\{\{\s*(\d+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body.text)) !== null) {
    found.add(m[1])
  }
  return Array.from(found).sort((a, b) => Number(a) - Number(b))
}

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaService,
    private readonly numbers: WhatsAppNumbersService,
  ) {}

  async list(numberId?: string) {
    return this.prisma.template.findMany({
      where: numberId ? { whatsAppNumberId: numberId } : undefined,
      include: {
        whatsAppNumber: {
          select: { id: true, displayName: true, phoneNumber: true },
        },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    })
  }

  async findOne(id: string) {
    const t = await this.prisma.template.findUnique({
      where: { id },
      include: {
        whatsAppNumber: {
          select: { id: true, displayName: true, phoneNumber: true },
        },
      },
    })
    if (!t) throw new NotFoundException('Template não encontrado')
    return t
  }

  async create(dto: CreateTemplateDto) {
    const exists = await this.prisma.whatsAppNumber.count({
      where: { id: dto.whatsAppNumberId },
    })
    if (!exists) throw new BadRequestException('Número WhatsApp inválido')

    const variables = extractTemplateVariables(dto.components)
    const language = dto.language ?? 'pt_BR'

    // Tenta submeter na Meta primeiro. Se a Meta rejeitar (validação), nem
    // criamos localmente — o usuário recebe o erro e pode corrigir.
    let externalId: string | null = null
    let metaStatus: TemplateStatus = TemplateStatus.PENDING
    try {
      const number = await this.numbers.getInternal(dto.whatsAppNumberId)
      const result = await this.meta.createTemplate({
        wabaId: number.wabaId,
        accessToken: number.accessToken,
        name: dto.name.trim(),
        language,
        category: dto.category,
        components: dto.components,
      })
      externalId = result.id
      metaStatus = this.mapStatus(result.status)
    } catch (err) {
      // Re-lança pro controller: cliente vê 400 com a mensagem da Meta
      this.logger.warn(
        `Submit à Meta falhou para template "${dto.name}": ${(err as Error).message}`,
      )
      throw err
    }

    try {
      return await this.prisma.template.create({
        data: {
          whatsAppNumberId: dto.whatsAppNumberId,
          name: dto.name.trim(),
          category: dto.category,
          language,
          components: dto.components as Prisma.InputJsonValue,
          variables: variables as Prisma.InputJsonValue,
          status: metaStatus,
          externalId,
        },
      })
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe um template com este nome para este número',
        )
      }
      throw e
    }
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const t = await this.prisma.template.findUnique({ where: { id } })
    if (!t) throw new NotFoundException('Template não encontrado')

    if (
      t.status !== TemplateStatus.PENDING &&
      t.status !== TemplateStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Só é possível editar templates PENDING ou REJECTED',
      )
    }

    const data: Prisma.TemplateUpdateInput = {}
    if (dto.category !== undefined) data.category = dto.category
    if (dto.components !== undefined) {
      data.components = dto.components as Prisma.InputJsonValue
      data.variables = extractTemplateVariables(
        dto.components,
      ) as Prisma.InputJsonValue
      data.status = TemplateStatus.PENDING
    }

    return this.prisma.template.update({ where: { id }, data })
  }

  async remove(id: string) {
    await this.ensureExists(id)
    const inUse = await this.prisma.campaign.count({ where: { templateId: id } })
    if (inUse > 0) {
      throw new ConflictException(
        'Template em uso por campanhas — não pode ser excluído',
      )
    }
    await this.prisma.template.delete({ where: { id } })
    return { ok: true }
  }

  /**
   * Re-sincroniza um template específico puxando os dados da Meta.
   * Encontra o template no DB, busca todos os templates da WABA dele, e
   * faz upsert do match por nome (Meta não tem ID estável que a gente
   * consiga usar como chave estrangeira — name é o identificador no
   * escopo da WABA).
   */
  async sync(id: string) {
    const t = await this.findOne(id)
    const number = await this.numbers.getInternal(t.whatsAppNumberId)
    const remote = await this.meta.listTemplates({
      wabaId: number.wabaId,
      accessToken: number.accessToken,
    })
    const match = remote.find((r) => r.name === t.name && r.language === t.language)
    if (!match) {
      throw new NotFoundException(
        'Template não encontrado na Meta (foi removido lá?)',
      )
    }
    await this.upsertFromMeta(t.whatsAppNumberId, match)
    return this.findOne(id)
  }

  /**
   * Puxa TODOS os templates da WABA de um número e upserts no DB.
   * Útil pra trazer pra cá templates criados direto no WhatsApp Manager.
   * Templates locais que não estão na Meta ficam intocados (assumimos que
   * foram criados aqui e ainda não foram enviados pra aprovação).
   */
  async syncAllFromMeta(whatsAppNumberId: string) {
    const number = await this.numbers.getInternal(whatsAppNumberId)
    const remote = await this.meta.listTemplates({
      wabaId: number.wabaId,
      accessToken: number.accessToken,
    })
    let created = 0
    let updated = 0
    for (const r of remote) {
      const result = await this.upsertFromMeta(whatsAppNumberId, r)
      if (result === 'created') created++
      else if (result === 'updated') updated++
    }
    await this.prisma.whatsAppNumber.update({
      where: { id: whatsAppNumberId },
      data: { lastSyncAt: new Date() },
    })
    this.logger.log(
      `Sync de templates: ${created} criados, ${updated} atualizados, ${remote.length} no total da Meta`,
    )
    return { total: remote.length, created, updated }
  }

  private async upsertFromMeta(
    whatsAppNumberId: string,
    r: MetaTemplate,
  ): Promise<'created' | 'updated' | 'unchanged'> {
    const status = this.mapStatus(r.status)
    const category = this.mapCategory(r.category)
    const variables = extractTemplateVariables(r.components)

    const existing = await this.prisma.template.findUnique({
      where: {
        whatsAppNumberId_name: { whatsAppNumberId, name: r.name },
      },
    })

    const payload = {
      whatsAppNumberId,
      name: r.name,
      externalId: r.id ?? null,
      category,
      language: r.language,
      status,
      components: r.components as unknown as Prisma.InputJsonValue,
      variables: variables as unknown as Prisma.InputJsonValue,
      rejectionReason: r.rejected_reason ?? null,
    }

    if (!existing) {
      await this.prisma.template.create({ data: payload })
      return 'created'
    }
    await this.prisma.template.update({
      where: { id: existing.id },
      data: payload,
    })
    return 'updated'
  }

  private mapStatus(s: string): TemplateStatus {
    switch (s?.toUpperCase()) {
      case 'APPROVED':
        return TemplateStatus.APPROVED
      case 'REJECTED':
        return TemplateStatus.REJECTED
      case 'PAUSED':
        return TemplateStatus.PAUSED
      case 'DISABLED':
      case 'PENDING_DELETION':
        return TemplateStatus.DISABLED
      case 'PENDING':
      case 'IN_APPEAL':
      default:
        return TemplateStatus.PENDING
    }
  }

  private mapCategory(c: string): TemplateCategory {
    switch (c?.toUpperCase()) {
      case 'MARKETING':
        return TemplateCategory.MARKETING
      case 'AUTHENTICATION':
        return TemplateCategory.AUTHENTICATION
      case 'UTILITY':
      default:
        return TemplateCategory.UTILITY
    }
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.template.count({ where: { id } })
    if (!exists) throw new NotFoundException('Template não encontrado')
  }
}
