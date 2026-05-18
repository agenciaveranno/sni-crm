import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CreateWhatsAppNumberDto } from './dto/create-whatsapp-number.dto'
import { UpdateWhatsAppNumberDto } from './dto/update-whatsapp-number.dto'
import { WhatsAppNumbersService } from './whatsapp-numbers.service'

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('whatsapp-numbers')
export class WhatsAppNumbersController {
  constructor(private readonly numbers: WhatsAppNumbersService) {}

  @Get()
  list() {
    return this.numbers.list()
  }

  @Post()
  create(@Body() dto: CreateWhatsAppNumberDto) {
    return this.numbers.create(dto)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.numbers.findOne(id)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWhatsAppNumberDto) {
    return this.numbers.update(id, dto)
  }

  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.numbers.deactivate(id)
  }

  @Post(':id/sync')
  sync(@Param('id') id: string) {
    return this.numbers.sync(id)
  }

  @Post(':id/set-default')
  setDefault(@Param('id') id: string) {
    return this.numbers.setDefault(id)
  }
}
