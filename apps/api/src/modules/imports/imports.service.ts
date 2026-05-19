import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ImportStatus, OptInMethod, OptInStatus } from '@prisma/client'
import * as XLSX from 'xlsx'
import { normalizePhone } from '@kotodama/shared'
import { PrismaService } from '../../prisma/prisma.service'

export interface ColumnMapping {
  name?: string
  phone: string
  email?: string
  notes?: string
}

export interface ImportRowError {
  row: number
  reason: string
}

export interface ImportInput {
  fileName: string
  buffer: Buffer
  mimeType: string
  columnMapping: ColumnMapping
  /** Cada item é o header de uma coluna onde o valor (não vazio) vira nome de tag. */
  tagColumns?: string[]
  /** IDs de Tag aplicadas a TODOS os contatos importados. */
  fixedTags?: string[]
  /** Marca contatos importados como OPTED_IN ao invés de PENDING. */
  treatAsOptedIn?: boolean
  userId: string
}

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.import.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  async findOne(id: string) {
    const imp = await this.prisma.import.findUnique({ where: { id } })
    if (!imp) throw new NotFoundException('Importação não encontrada')
    return imp
  }

  /**
   * Faz o parse + upsert em memória. Retorna o registro Import final
   * com contadores e a lista de erros.
   */
  async process(input: ImportInput) {
    const rows = this.parse(input.buffer, input.fileName)
    if (rows.length === 0) {
      throw new BadRequestException('Arquivo sem linhas de dados')
    }
    if (rows.length > 50000) {
      throw new BadRequestException(
        'Arquivo excede 50.000 linhas — divida em partes',
      )
    }
    if (!input.columnMapping.phone) {
      throw new BadRequestException(
        'columnMapping.phone é obrigatório',
      )
    }

    const imp = await this.prisma.import.create({
      data: {
        fileName: input.fileName,
        filePath: '',
        status: ImportStatus.PROCESSING,
        columnMapping: input.columnMapping as object,
        tagColumns: input.tagColumns ?? [],
        fixedTags: input.fixedTags ?? [],
        totalRows: rows.length,
        processedById: input.userId,
      },
    })

    let success = 0
    let errorCount = 0
    let newContacts = 0
    let updatedContacts = 0
    const errors: ImportRowError[] = []

    const tagCache = new Map<string, string>()
    if (input.fixedTags?.length) {
      const tags = await this.prisma.tag.findMany({
        where: { id: { in: input.fixedTags } },
        select: { id: true, name: true },
      })
      for (const t of tags) tagCache.set(t.name.toLowerCase(), t.id)
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const rawPhone = row[input.columnMapping.phone]
        if (rawPhone === undefined || rawPhone === null || rawPhone === '') {
          throw new Error('Telefone vazio')
        }
        const phone = normalizePhone(String(rawPhone))
        if (!phone) throw new Error(`Telefone inválido: ${rawPhone}`)

        const name = input.columnMapping.name
          ? String(row[input.columnMapping.name] ?? '').trim()
          : ''
        const email = input.columnMapping.email
          ? (String(row[input.columnMapping.email] ?? '').trim() || null)
          : null
        const notes = input.columnMapping.notes
          ? (String(row[input.columnMapping.notes] ?? '').trim() || null)
          : null

        const dynamicTagNames: string[] = []
        for (const col of input.tagColumns ?? []) {
          const v = row[col]
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            dynamicTagNames.push(String(v).trim())
          }
        }

        const tagIds: string[] = [...(input.fixedTags ?? [])]
        for (const tname of dynamicTagNames) {
          const key = tname.toLowerCase()
          let id = tagCache.get(key)
          if (!id) {
            const tag = await this.prisma.tag.upsert({
              where: { name: tname },
              update: {},
              create: { name: tname },
              select: { id: true },
            })
            id = tag.id
            tagCache.set(key, id)
          }
          if (!tagIds.includes(id)) tagIds.push(id)
        }

        const existing = await this.prisma.contact.findUnique({
          where: { phone },
          select: { id: true },
        })

        if (existing) {
          await this.prisma.contact.update({
            where: { id: existing.id },
            data: {
              ...(name && { name }),
              ...(email !== null && { email }),
              ...(notes !== null && { notes }),
              ...(input.treatAsOptedIn && {
                optInStatus: OptInStatus.OPTED_IN,
                optInMethod: OptInMethod.IMPORT,
                optInAt: new Date(),
              }),
            },
          })
          updatedContacts++
        } else {
          await this.prisma.contact.create({
            data: {
              name: name || phone,
              phone,
              email,
              notes,
              optInStatus: input.treatAsOptedIn
                ? OptInStatus.OPTED_IN
                : OptInStatus.PENDING,
              optInMethod: input.treatAsOptedIn ? OptInMethod.IMPORT : null,
              optInAt: input.treatAsOptedIn ? new Date() : null,
              optInSource: 'import',
            },
          })
          newContacts++
        }

        if (tagIds.length > 0) {
          const contact = await this.prisma.contact.findUnique({
            where: { phone },
            select: { id: true },
          })
          if (contact) {
            await this.prisma.contactTag.createMany({
              data: tagIds.map((tagId) => ({
                contactId: contact.id,
                tagId,
                assignedBy: input.userId,
              })),
              skipDuplicates: true,
            })
          }
        }

        success++
      } catch (err) {
        errorCount++
        errors.push({
          row: i + 2, // +1 header, +1 1-indexed
          reason: err instanceof Error ? err.message : String(err),
        })
        if (errors.length >= 200) {
          // limita para não estourar
        }
      }

      // updates progressivos a cada 100 linhas
      if ((i + 1) % 100 === 0) {
        await this.prisma.import.update({
          where: { id: imp.id },
          data: {
            processedRows: i + 1,
            successRows: success,
            errorRows: errorCount,
            newContacts,
            updatedContacts,
          },
        })
      }
    }

    const finalStatus =
      errorCount === 0
        ? ImportStatus.COMPLETED
        : success === 0
          ? ImportStatus.FAILED
          : ImportStatus.COMPLETED_WITH_ERRORS

    return this.prisma.import.update({
      where: { id: imp.id },
      data: {
        status: finalStatus,
        processedRows: rows.length,
        successRows: success,
        errorRows: errorCount,
        newContacts,
        updatedContacts,
        errors: errors.slice(0, 200) as object,
      },
    })
  }

  private parse(buffer: Buffer, fileName: string): Array<Record<string, unknown>> {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) {
      throw new BadRequestException(`Arquivo ${fileName} sem planilhas`)
    }
    const sheet = wb.Sheets[sheetName]
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    })
  }
}
