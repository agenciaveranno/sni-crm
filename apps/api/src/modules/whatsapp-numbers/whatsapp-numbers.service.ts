import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { normalizePhone } from '@kotodama/shared'
import { EncryptionService } from '../../common/crypto/encryption.service'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateWhatsAppNumberDto } from './dto/create-whatsapp-number.dto'
import { UpdateWhatsAppNumberDto } from './dto/update-whatsapp-number.dto'

const SAFE_SELECT = {
  id: true,
  displayName: true,
  phoneNumber: true,
  phoneNumberId: true,
  wabaId: true,
  qualityRating: true,
  messagingLimit: true,
  status: true,
  isDefault: true,
  lastSyncAt: true,
  createdAt: true,
  updatedAt: true,
  // accessToken e webhookVerifyToken propositadamente fora
} satisfies Prisma.WhatsAppNumberSelect

@Injectable()
export class WhatsAppNumbersService {
  private readonly logger = new Logger(WhatsAppNumbersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EncryptionService,
  ) {}

  async list() {
    return this.prisma.whatsAppNumber.findMany({
      select: SAFE_SELECT,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
  }

  async findOne(id: string) {
    const n = await this.prisma.whatsAppNumber.findUnique({
      where: { id },
      select: SAFE_SELECT,
    })
    if (!n) throw new NotFoundException('Número não encontrado')
    return n
  }

  async create(dto: CreateWhatsAppNumberDto) {
    const phone = normalizePhone(dto.phoneNumber)
    if (!phone) {
      throw new ConflictException('Número de telefone inválido')
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await tx.whatsAppNumber.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
          })
        }
        return tx.whatsAppNumber.create({
          data: {
            displayName: dto.displayName.trim(),
            phoneNumber: phone,
            phoneNumberId: dto.phoneNumberId.trim(),
            wabaId: dto.wabaId.trim(),
            accessToken: this.crypto.encrypt(dto.accessToken),
            webhookVerifyToken: dto.webhookVerifyToken,
            isDefault: Boolean(dto.isDefault),
          },
          select: SAFE_SELECT,
        })
      })
      return created
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe um número cadastrado com este phoneNumber/phoneNumberId',
        )
      }
      throw e
    }
  }

  async update(id: string, dto: UpdateWhatsAppNumberDto) {
    await this.ensureExists(id)
    const data: Prisma.WhatsAppNumberUpdateInput = {}
    if (dto.displayName !== undefined) data.displayName = dto.displayName.trim()
    if (dto.accessToken !== undefined)
      data.accessToken = this.crypto.encrypt(dto.accessToken)
    if (dto.webhookVerifyToken !== undefined)
      data.webhookVerifyToken = dto.webhookVerifyToken
    if (dto.status !== undefined) data.status = dto.status

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.whatsAppNumber.updateMany({
          where: { isDefault: true, NOT: { id } },
          data: { isDefault: false },
        })
        data.isDefault = true
      } else if (dto.isDefault === false) {
        data.isDefault = false
      }
      return tx.whatsAppNumber.update({
        where: { id },
        data,
        select: SAFE_SELECT,
      })
    })
  }

  async deactivate(id: string) {
    await this.ensureExists(id)
    return this.prisma.whatsAppNumber.update({
      where: { id },
      data: { status: 'INACTIVE' },
      select: SAFE_SELECT,
    })
  }

  async setDefault(id: string) {
    await this.ensureExists(id)
    return this.prisma.$transaction(async (tx) => {
      await tx.whatsAppNumber.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
      return tx.whatsAppNumber.update({
        where: { id },
        data: { isDefault: true },
        select: SAFE_SELECT,
      })
    })
  }

  /**
   * Sincroniza quality_rating + messaging_limit_tier com a Meta. A
   * implementação completa fica na Fase 6 — por ora apenas marca lastSyncAt
   * para evidenciar o gancho.
   */
  async sync(id: string) {
    await this.ensureExists(id)
    this.logger.log(`Sync da Meta solicitado para número ${id} (stub)`)
    return this.prisma.whatsAppNumber.update({
      where: { id },
      data: { lastSyncAt: new Date() },
      select: SAFE_SELECT,
    })
  }

  /** Para uso interno (sender/worker): devolve o accessToken decifrado. */
  async getInternal(id: string) {
    const n = await this.prisma.whatsAppNumber.findUnique({ where: { id } })
    if (!n) throw new NotFoundException('Número não encontrado')
    return {
      ...n,
      accessToken: this.crypto.decrypt(n.accessToken),
    }
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.whatsAppNumber.count({ where: { id } })
    if (!exists) throw new NotFoundException('Número não encontrado')
  }
}
