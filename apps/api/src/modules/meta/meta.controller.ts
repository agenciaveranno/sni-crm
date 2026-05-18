import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { MetaService } from './meta.service'

const MAX_UPLOAD_MB = 16
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/3gpp',
  'application/pdf',
])

@Controller('meta')
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  @RequirePermission('SETTINGS_TEMPLATES', 'CREATE')
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 } }),
  )
  async upload(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('Arquivo não enviado')
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        `Tipo não suportado: ${file.mimetype}. Use JPG, PNG, MP4 ou PDF.`,
      )
    }
    return this.meta.uploadMedia({
      file: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
    })
  }
}
