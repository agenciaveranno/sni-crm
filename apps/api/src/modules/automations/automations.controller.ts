import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import {
  AutomationsService,
  type CreateAutomationDto,
} from './automations.service'

@Controller('automations')
export class AutomationsController {
  constructor(private readonly service: AutomationsService) {}

  @RequirePermission('AUTOMATIONS', 'VIEW')
  @Get()
  list() {
    return this.service.list()
  }

  @RequirePermission('AUTOMATIONS', 'VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @RequirePermission('AUTOMATIONS', 'CREATE')
  @Post()
  create(@Body() dto: CreateAutomationDto) {
    return this.service.create(dto)
  }

  @RequirePermission('AUTOMATIONS', 'EDIT')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateAutomationDto>) {
    return this.service.update(id, dto)
  }

  @RequirePermission('AUTOMATIONS', 'DELETE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
