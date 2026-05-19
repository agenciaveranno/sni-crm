import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

export interface AuditRecord {
  userId: string
  userEmail: string
  action: string
  entity: string
  entityId?: string | null
  dataBefore?: Prisma.InputJsonValue
  dataAfter?: Prisma.InputJsonValue
  ip?: string | null
  userAgent?: string | null
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name)

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecord): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId,
          userEmail: input.userEmail,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          dataBefore: input.dataBefore ?? Prisma.JsonNull,
          dataAfter: input.dataAfter ?? Prisma.JsonNull,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      })
    } catch (err) {
      // Audit log nunca pode travar a operação principal.
      this.logger.error(
        `Falha ao gravar AuditLog: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  async list(params: {
    page: number
    pageSize: number
    entity?: string
    userId?: string
    action?: string
  }) {
    const where: Prisma.AuditLogWhereInput = {}
    if (params.entity) where.entity = params.entity
    if (params.userId) where.userId = params.userId
    if (params.action) where.action = params.action

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ])
    return { items, total, page: params.page, pageSize: params.pageSize }
  }
}
