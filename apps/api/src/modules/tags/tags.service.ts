import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { BulkContactsDto } from './dto/bulk-contacts.dto'
import { CreateTagDto } from './dto/create-tag.dto'
import { UpdateTagDto } from './dto/update-tag.dto'

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const tags = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { contacts: true } } },
    })
    return tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      description: t.description,
      contactsCount: t._count.contacts,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))
  }

  async create(dto: CreateTagDto, userId: string) {
    try {
      return await this.prisma.tag.create({
        data: {
          name: dto.name.trim(),
          color: dto.color ?? '#1B4FA8',
          description: dto.description,
        },
      })
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Já existe uma tag com este nome')
      }
      throw e
    }
  }

  async findOne(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { contacts: true } } },
    })
    if (!tag) throw new NotFoundException('Tag não encontrada')
    return tag
  }

  async update(id: string, dto: UpdateTagDto) {
    await this.ensureExists(id)
    try {
      return await this.prisma.tag.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          color: dto.color,
          description: dto.description,
        },
      })
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Já existe uma tag com este nome')
      }
      throw e
    }
  }

  async remove(id: string) {
    await this.ensureExists(id)
    await this.prisma.tag.delete({ where: { id } })
    return { ok: true }
  }

  async listContacts(id: string, page = 1, limit = 25) {
    await this.ensureExists(id)
    const skip = (page - 1) * limit
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contactTag.findMany({
        where: { tagId: id },
        include: {
          contact: {
            select: { id: true, name: true, phone: true, optInStatus: true },
          },
        },
        orderBy: { assignedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contactTag.count({ where: { tagId: id } }),
    ])
    return {
      data: items.map((it) => it.contact),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async addContacts(id: string, dto: BulkContactsDto, userId: string) {
    await this.ensureExists(id)
    await this.prisma.contactTag.createMany({
      data: dto.contactIds.map((contactId) => ({
        tagId: id,
        contactId,
        assignedBy: userId,
      })),
      skipDuplicates: true,
    })
    return { ok: true, added: dto.contactIds.length }
  }

  async removeContacts(id: string, dto: BulkContactsDto) {
    await this.ensureExists(id)
    const res = await this.prisma.contactTag.deleteMany({
      where: { tagId: id, contactId: { in: dto.contactIds } },
    })
    return { ok: true, removed: res.count }
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.tag.count({ where: { id } })
    if (!exists) throw new NotFoundException('Tag não encontrada')
  }
}
