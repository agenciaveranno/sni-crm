import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import {
  createCampaignSchema,
  type CreateCampaignDto,
  listCampaignsSchema,
  type ListCampaignsDto,
  updateCampaignSchema,
  type UpdateCampaignDto,
} from './dto/campaign.dto'
import { CampaignsService } from './campaigns.service'

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @RequirePermission('CAMPAIGNS', 'VIEW')
  @Get()
  list(
    @Query(new ZodValidationPipe(listCampaignsSchema)) dto: ListCampaignsDto,
  ) {
    return this.service.list(dto)
  }

  @RequirePermission('CAMPAIGNS', 'VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @RequirePermission('CAMPAIGNS', 'VIEW')
  @Get(':id/recipients')
  recipients(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ) {
    return this.service.listRecipients(id, Number(page), Number(pageSize))
  }

  @RequirePermission('CAMPAIGNS', 'CREATE')
  @Post()
  create(
    @Body(new ZodValidationPipe(createCampaignSchema)) dto: CreateCampaignDto,
    @Req() req: Request & { user?: { sub: string } },
  ) {
    const userId = req.user?.sub
    if (!userId) throw new Error('Sem usuário autenticado')
    return this.service.create(dto, userId)
  }

  @RequirePermission('CAMPAIGNS', 'EDIT')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCampaignSchema)) dto: UpdateCampaignDto,
  ) {
    return this.service.update(id, dto)
  }

  @RequirePermission('CAMPAIGNS', 'DELETE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }

  @RequirePermission('CAMPAIGNS', 'SEND')
  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.service.start(id)
  }

  @RequirePermission('CAMPAIGNS', 'SEND')
  @Post(':id/pause')
  pause(@Param('id') id: string) {
    return this.service.pause(id)
  }

  @RequirePermission('CAMPAIGNS', 'SEND')
  @Post(':id/resume')
  resume(@Param('id') id: string) {
    return this.service.resume(id)
  }

  @RequirePermission('CAMPAIGNS', 'SEND')
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id)
  }
}
