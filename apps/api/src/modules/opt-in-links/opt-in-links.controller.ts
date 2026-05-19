import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { Public } from '../../common/decorators/public.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import {
  OptInLinksService,
  type CreateOptInLinkDto,
} from './opt-in-links.service'

@Controller('opt-in-links')
export class OptInLinksController {
  constructor(private readonly service: OptInLinksService) {}

  @RequirePermission('SETTINGS_OPT_IN_LINKS', 'VIEW')
  @Get()
  list() {
    return this.service.list()
  }

  @RequirePermission('SETTINGS_OPT_IN_LINKS', 'CREATE')
  @Post()
  create(@Body() dto: CreateOptInLinkDto) {
    if (!dto.code?.trim() || !dto.description?.trim()) {
      throw new BadRequestException('code e description são obrigatórios')
    }
    return this.service.create(dto)
  }

  @RequirePermission('SETTINGS_OPT_IN_LINKS', 'EDIT')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateOptInLinkDto>) {
    return this.service.update(id, dto)
  }

  @RequirePermission('SETTINGS_OPT_IN_LINKS', 'DELETE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }

  // Endpoint público (sem JWT): consumido pelas páginas de opt-in.
  @Public()
  @Get('public/:code')
  publicInfo(@Param('code') code: string) {
    return this.service.findByCode(code).then((l) => ({
      code: l.code,
      description: l.description,
      redirectUrl: l.redirectUrl,
    }))
  }

  @Public()
  @Post('public/:code/submit')
  submit(
    @Param('code') code: string,
    @Body() body: { name: string; phone: string; email?: string },
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      null
    return this.service.submit({
      code,
      name: body.name,
      phone: body.phone,
      email: body.email,
      ip,
    })
  }
}
