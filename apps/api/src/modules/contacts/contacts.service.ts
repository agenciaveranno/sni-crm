import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { normalizePhone } from '@kotodama/shared'
import {
  MessageDirection,
  MessageStatus,
  MessageType,
  OptInMethod,
  OptInStatus,
  Prisma,
} from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { MetaService } from '../meta/meta.service'
import { WhatsAppNumbersService } from '../whatsapp-numbers/whatsapp-numbers.service'
import { AddContactTagsDto } from './dto/contact-tags.dto'
import { CreateContactDto } from './dto/create-contact.dto'
import { QueryContactsDto } from './dto/query-contacts.dto'
import { SendMessageDto } from './dto/send-message.dto'
import { UpdateContactDto } from './dto/update-contact.dto'

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaService,
    private readonly numbers: WhatsAppNumbersService,
  ) {}

  async list(query: QueryContactsDto) {
    const where: Prisma.ContactWhereInput = {}

    if (query.search) {
      const s = query.search.trim()
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
      ]
    }
    if (query.optInStatus) where.optInStatus = query.optInStatus
    if (query.tagIds?.length) {
      where.tags = { some: { tagId: { in: query.tagIds } } }
    }

    const skip = (query.page - 1) * query.limit
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
        include: {
          tags: { include: { tag: true } },
        },
      }),
      this.prisma.contact.count({ where }),
    ])

    return {
      data: items.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        notes: c.notes,
        optInStatus: c.optInStatus,
        optInMethod: c.optInMethod,
        optInAt: c.optInAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        tags: c.tags.map((t) => ({
          id: t.tag.id,
          name: t.tag.name,
          color: t.tag.color,
        })),
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }
  }

  async create(dto: CreateContactDto, userId: string) {
    const phone = normalizePhone(dto.phone)
    if (!phone) throw new BadRequestException('Telefone inválido')

    try {
      return await this.prisma.contact.create({
        data: {
          name: dto.name.trim(),
          phone,
          email: dto.email?.toLowerCase().trim(),
          notes: dto.notes,
          optInStatus: OptInStatus.PENDING,
          tags: dto.tagIds?.length
            ? {
                create: dto.tagIds.map((tagId) => ({
                  tagId,
                  assignedBy: userId,
                })),
              }
            : undefined,
        },
        include: { tags: { include: { tag: true } } },
      })
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um contato com este telefone')
      }
      throw e
    }
  }

  async findOne(id: string) {
    const c = await this.prisma.contact.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    })
    if (!c) throw new NotFoundException('Contato não encontrado')
    return {
      ...c,
      tags: c.tags.map((t) => ({
        id: t.tag.id,
        name: t.tag.name,
        color: t.tag.color,
        assignedAt: t.assignedAt,
      })),
    }
  }

  async update(id: string, dto: UpdateContactDto) {
    await this.ensureExists(id)
    const data: Prisma.ContactUpdateInput = {}
    if (dto.name !== undefined) data.name = dto.name.trim()
    if (dto.email !== undefined) data.email = dto.email?.toLowerCase().trim() || null
    if (dto.notes !== undefined) data.notes = dto.notes
    if (dto.phone !== undefined) {
      const phone = normalizePhone(dto.phone)
      if (!phone) throw new BadRequestException('Telefone inválido')
      data.phone = phone
    }

    try {
      return await this.prisma.contact.update({
        where: { id },
        data,
        include: { tags: { include: { tag: true } } },
      })
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um contato com este telefone')
      }
      throw e
    }
  }

  async remove(id: string) {
    await this.ensureExists(id)
    await this.prisma.contact.delete({ where: { id } })
    return { ok: true }
  }

  async addTags(id: string, dto: AddContactTagsDto, userId: string) {
    await this.ensureExists(id)
    await this.prisma.contactTag.createMany({
      data: dto.tagIds.map((tagId) => ({
        contactId: id,
        tagId,
        assignedBy: userId,
      })),
      skipDuplicates: true,
    })
    return this.findOne(id)
  }

  async removeTag(id: string, tagId: string) {
    await this.ensureExists(id)
    await this.prisma.contactTag.deleteMany({
      where: { contactId: id, tagId },
    })
    return this.findOne(id)
  }

  async optIn(
    id: string,
    source?: string,
    method: OptInMethod = OptInMethod.MANUAL,
    ip?: string,
  ) {
    await this.ensureExists(id)
    return this.prisma.contact.update({
      where: { id },
      data: {
        optInStatus: OptInStatus.OPTED_IN,
        optInMethod: method,
        optInAt: new Date(),
        optInSource: source,
        optInIp: ip,
      },
    })
  }

  async optOut(id: string, source?: string) {
    await this.ensureExists(id)
    return this.prisma.contact.update({
      where: { id },
      data: {
        optInStatus: OptInStatus.OPTED_OUT,
        optInSource: source,
      },
    })
  }

  async messages(id: string) {
    await this.ensureExists(id)
    return this.prisma.inboxMessage.findMany({
      where: { contactId: id },
      orderBy: { receivedAt: 'desc' },
      take: 100,
    })
  }

  async sendMessage(contactId: string, dto: SendMessageDto) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, phone: true },
    })
    if (!contact) throw new NotFoundException('Contato não encontrado')

    // Escolhe o número de envio: o do DTO ou o default ativo.
    let numberId = dto.whatsAppNumberId
    if (!numberId) {
      const def = await this.prisma.whatsAppNumber.findFirst({
        where: { status: 'ACTIVE', isDefault: true },
        select: { id: true },
      })
      if (!def) {
        const anyActive = await this.prisma.whatsAppNumber.findFirst({
          where: { status: 'ACTIVE' },
          select: { id: true },
        })
        if (!anyActive) {
          throw new BadRequestException(
            'Nenhum número WhatsApp ativo cadastrado',
          )
        }
        numberId = anyActive.id
      } else {
        numberId = def.id
      }
    }

    const number = await this.numbers.getInternal(numberId)
    if (number.status !== 'ACTIVE') {
      throw new BadRequestException('Número WhatsApp não está ativo')
    }

    // Meta espera E.164 sem o "+"
    const toDigits = contact.phone.replace(/^\+/, '')
    const { waMessageId } = await this.meta.sendText({
      phoneNumberId: number.phoneNumberId,
      accessToken: number.accessToken,
      to: toDigits,
      body: dto.body,
    })

    return this.prisma.inboxMessage.create({
      data: {
        direction: MessageDirection.OUTBOUND,
        contactId: contact.id,
        whatsAppNumberId: number.id,
        waMessageId,
        messageType: MessageType.TEXT,
        content: { text: dto.body },
        status: MessageStatus.SENT,
        receivedAt: new Date(),
      },
    })
  }

  /**
   * Mescla source em target: move mensagens e tags pro target, depois deleta
   * source. Útil pra duplicados (ex: mesmo número em formatos diferentes
   * antes do fix do BR9).
   */
  async mergeFrom(targetId: string, sourceId: string) {
    if (targetId === sourceId) {
      throw new BadRequestException('Source e target são o mesmo contato')
    }
    const [target, source] = await Promise.all([
      this.prisma.contact.findUnique({ where: { id: targetId } }),
      this.prisma.contact.findUnique({ where: { id: sourceId } }),
    ])
    if (!target) throw new NotFoundException('Contato target não encontrado')
    if (!source) throw new NotFoundException('Contato source não encontrado')

    return this.prisma.$transaction(async (tx) => {
      const movedMessages = await tx.inboxMessage.updateMany({
        where: { contactId: sourceId },
        data: { contactId: targetId },
      })

      const sourceTags = await tx.contactTag.findMany({
        where: { contactId: sourceId },
      })
      let movedTags = 0
      for (const ct of sourceTags) {
        const exists = await tx.contactTag.findUnique({
          where: { contactId_tagId: { contactId: targetId, tagId: ct.tagId } },
        })
        if (!exists) {
          await tx.contactTag.create({
            data: {
              contactId: targetId,
              tagId: ct.tagId,
              assignedBy: ct.assignedBy,
            },
          })
          movedTags++
        }
      }
      await tx.contactTag.deleteMany({ where: { contactId: sourceId } })

      // Move campaign recipients também
      const movedRecipients = await tx.campaignRecipient.updateMany({
        where: { contactId: sourceId },
        data: { contactId: targetId },
      })

      await tx.contact.delete({ where: { id: sourceId } })

      return {
        merged: true,
        target: { id: target.id, phone: target.phone, name: target.name },
        source: { id: source.id, phone: source.phone, name: source.name },
        moved: {
          messages: movedMessages.count,
          tags: movedTags,
          recipients: movedRecipients.count,
        },
      }
    })
  }

  async exportCsv(query: QueryContactsDto) {
    const where: Prisma.ContactWhereInput = {}
    if (query.search) {
      const s = query.search.trim()
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
      ]
    }
    if (query.optInStatus) where.optInStatus = query.optInStatus
    if (query.tagIds?.length) {
      where.tags = { some: { tagId: { in: query.tagIds } } }
    }

    const contacts = await this.prisma.contact.findMany({
      where,
      include: { tags: { include: { tag: true } } },
      orderBy: { name: 'asc' },
    })

    const header = 'name,phone,email,optInStatus,tags,createdAt'
    const rows = contacts.map((c) => {
      const tags = c.tags.map((t) => t.tag.name).join('|')
      const esc = (v: string | null | undefined) =>
        v == null ? '' : `"${String(v).replace(/"/g, '""')}"`
      return [
        esc(c.name),
        esc(c.phone),
        esc(c.email),
        c.optInStatus,
        esc(tags),
        c.createdAt.toISOString(),
      ].join(',')
    })
    return [header, ...rows].join('\n')
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.contact.count({ where: { id } })
    if (!exists) throw new NotFoundException('Contato não encontrado')
  }
}
