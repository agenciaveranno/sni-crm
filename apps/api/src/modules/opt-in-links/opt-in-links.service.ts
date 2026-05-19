import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { OptInMethod, OptInStatus, type Prisma } from '@prisma/client'
import { normalizePhone } from '@kotodama/shared'
import { PrismaService } from '../../prisma/prisma.service'

export interface CreateOptInLinkDto {
  code: string
  description: string
  redirectUrl?: string | null
  tagsToApply?: string[]
  active?: boolean
}

@Injectable()
export class OptInLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.optInLink.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async findByCode(code: string) {
    const link = await this.prisma.optInLink.findUnique({ where: { code } })
    if (!link || !link.active) throw new NotFoundException('Link inválido')
    return link
  }

  async create(dto: CreateOptInLinkDto) {
    const exists = await this.prisma.optInLink.count({
      where: { code: dto.code },
    })
    if (exists) throw new ConflictException('Código já em uso')
    return this.prisma.optInLink.create({
      data: {
        code: dto.code,
        description: dto.description,
        redirectUrl: dto.redirectUrl ?? null,
        tagsToApply: dto.tagsToApply ?? [],
        active: dto.active ?? true,
      },
    })
  }

  async update(id: string, dto: Partial<CreateOptInLinkDto>) {
    const existing = await this.prisma.optInLink.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Link não encontrado')
    return this.prisma.optInLink.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.redirectUrl !== undefined && { redirectUrl: dto.redirectUrl }),
        ...(dto.tagsToApply !== undefined && { tagsToApply: dto.tagsToApply }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    })
  }

  async remove(id: string) {
    await this.prisma.optInLink.delete({ where: { id } })
    return { ok: true }
  }

  /**
   * Endpoint público: aceita opt-in vindo de um formulário linkado pelo
   * código. Faz upsert no Contact e aplica as tags configuradas.
   */
  async submit(input: {
    code: string
    name: string
    phone: string
    email?: string
    ip?: string | null
  }) {
    const link = await this.findByCode(input.code)

    const phone = normalizePhone(input.phone)
    if (!phone) throw new BadRequestException('Telefone inválido')
    if (!input.name?.trim()) throw new BadRequestException('Nome obrigatório')

    const existing = await this.prisma.contact.findUnique({
      where: { phone },
      select: { id: true },
    })

    const data: Prisma.ContactUncheckedCreateInput = {
      name: input.name.trim(),
      phone,
      email: input.email?.trim() || null,
      optInStatus: OptInStatus.OPTED_IN,
      optInMethod: OptInMethod.FORM,
      optInAt: new Date(),
      optInSource: `optin:${link.code}`,
      optInIp: input.ip ?? null,
    }

    const contact = existing
      ? await this.prisma.contact.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            email: data.email,
            optInStatus: data.optInStatus,
            optInMethod: data.optInMethod,
            optInAt: data.optInAt,
            optInSource: data.optInSource,
            optInIp: data.optInIp,
          },
        })
      : await this.prisma.contact.create({ data })

    if (link.tagsToApply.length > 0) {
      await this.prisma.contactTag.createMany({
        data: link.tagsToApply.map((tagId) => ({
          contactId: contact.id,
          tagId,
        })),
        skipDuplicates: true,
      })
    }

    await this.prisma.optInLink.update({
      where: { id: link.id },
      data: { usageCount: { increment: 1 } },
    })

    return { ok: true, redirectUrl: link.redirectUrl }
  }
}
