import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, TemplateStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
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

  constructor(private readonly prisma: PrismaService) {}

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

    try {
      return await this.prisma.template.create({
        data: {
          whatsAppNumberId: dto.whatsAppNumberId,
          name: dto.name.trim(),
          category: dto.category,
          language: dto.language ?? 'pt_BR',
          components: dto.components as Prisma.InputJsonValue,
          variables: variables as Prisma.InputJsonValue,
          status: TemplateStatus.PENDING,
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
   * Sincroniza status do template com a Meta. Implementação completa fica
   * para a Fase 6 — por ora apenas log + atualização noop.
   */
  async sync(id: string) {
    const t = await this.findOne(id)
    this.logger.log(`Sync da Meta solicitado para template ${id} (stub)`)
    return t
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.template.count({ where: { id } })
    if (!exists) throw new NotFoundException('Template não encontrado')
  }
}
