import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import {
  ImportsService,
  type ColumnMapping,
} from './imports.service'

const MAX_MB = 10
const ALLOWED = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
])

@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @RequirePermission('IMPORTS', 'VIEW')
  @Get()
  list() {
    return this.imports.list()
  }

  @RequirePermission('IMPORTS', 'VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.imports.findOne(id)
  }

  @RequirePermission('IMPORTS', 'CREATE')
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_MB * 1024 * 1024 } }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('columnMapping') columnMappingRaw: string,
    @Body('tagColumns') tagColumnsRaw: string | undefined,
    @Body('fixedTags') fixedTagsRaw: string | undefined,
    @Body('treatAsOptedIn') treatAsOptedInRaw: string | undefined,
    @Req() req: Request & { user?: { sub: string } },
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado')
    if (
      !ALLOWED.has(file.mimetype) &&
      !file.originalname.toLowerCase().match(/\.(csv|xlsx|xls)$/)
    ) {
      throw new BadRequestException(
        `Tipo não suportado: ${file.mimetype}. Use CSV ou Excel.`,
      )
    }
    const userId = req.user?.sub
    if (!userId) throw new BadRequestException('Sem usuário')

    let columnMapping: ColumnMapping
    try {
      columnMapping = JSON.parse(columnMappingRaw)
    } catch {
      throw new BadRequestException('columnMapping inválido (JSON malformado)')
    }
    const tagColumns = tagColumnsRaw ? JSON.parse(tagColumnsRaw) : []
    const fixedTags = fixedTagsRaw ? JSON.parse(fixedTagsRaw) : []
    const treatAsOptedIn = treatAsOptedInRaw === 'true'

    return this.imports.process({
      fileName: file.originalname,
      buffer: file.buffer,
      mimeType: file.mimetype,
      columnMapping,
      tagColumns,
      fixedTags,
      treatAsOptedIn,
      userId,
    })
  }
}
