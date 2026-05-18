import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { CreateTemplateDto } from './dto/create-template.dto'
import { UpdateTemplateDto } from './dto/update-template.dto'
import { TemplatesService } from './templates.service'

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @RequirePermission('SETTINGS_TEMPLATES', 'VIEW')
  @Get()
  list(@Query('numberId') numberId?: string) {
    return this.templates.list(numberId)
  }

  @RequirePermission('SETTINGS_TEMPLATES', 'CREATE')
  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templates.create(dto)
  }

  @RequirePermission('SETTINGS_TEMPLATES', 'VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templates.findOne(id)
  }

  @RequirePermission('SETTINGS_TEMPLATES', 'EDIT')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templates.update(id, dto)
  }

  @RequirePermission('SETTINGS_TEMPLATES', 'DELETE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templates.remove(id)
  }

  @RequirePermission('SETTINGS_TEMPLATES', 'EDIT')
  @Post(':id/sync')
  sync(@Param('id') id: string) {
    return this.templates.sync(id)
  }
}
