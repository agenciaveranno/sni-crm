import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { SetPermissionsDto } from './dto/set-permissions.dto'
import { UpdateUserDto } from './dto/update-user.dto'

const PUBLIC_USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.user.findMany({
      select: PUBLIC_USER_FIELDS,
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim()
    const exists = await this.prisma.user.findUnique({ where: { email } })
    if (exists) throw new ConflictException('Já existe um usuário com este e-mail')

    const passwordHash = await bcrypt.hash(dto.password, 12)
    return this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        passwordHash,
        role: dto.role ?? UserRole.OPERATOR,
      },
      select: PUBLIC_USER_FIELDS,
    })
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...PUBLIC_USER_FIELDS,
        permissions: {
          select: { module: true, action: true, granted: true },
        },
      },
    })
    if (!user) throw new NotFoundException('Usuário não encontrado')
    return user
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Usuário não encontrado')

    const data: Prisma.UserUpdateInput = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.role !== undefined) data.role = dto.role
    if (dto.active !== undefined) data.active = dto.active
    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim()
      if (email !== user.email) {
        const conflict = await this.prisma.user.findUnique({ where: { email } })
        if (conflict) throw new ConflictException('E-mail já em uso')
        data.email = email
      }
    }
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12)
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: PUBLIC_USER_FIELDS,
    })
  }

  async deactivate(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new BadRequestException('Não é possível desativar a própria conta')
    }
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Usuário não encontrado')
    return this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: PUBLIC_USER_FIELDS,
    })
  }

  async listPermissions(userId: string) {
    await this.ensureExists(userId)
    return this.prisma.permission.findMany({
      where: { userId },
      select: { module: true, action: true, granted: true },
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    })
  }

  async setPermissions(userId: string, dto: SetPermissionsDto) {
    await this.ensureExists(userId)
    await this.prisma.$transaction([
      this.prisma.permission.deleteMany({ where: { userId } }),
      this.prisma.permission.createMany({
        data: dto.permissions.map((p) => ({
          userId,
          module: p.module,
          action: p.action,
          granted: p.granted,
        })),
        skipDuplicates: true,
      }),
    ])
    return this.listPermissions(userId)
  }

  private async ensureExists(userId: string) {
    const exists = await this.prisma.user.count({ where: { id: userId } })
    if (!exists) throw new NotFoundException('Usuário não encontrado')
  }
}
