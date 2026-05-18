import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import {
  CurrentUser,
  type RequestUser,
} from '../../common/decorators/current-user.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { ContactsService } from './contacts.service'
import { AddContactTagsDto } from './dto/contact-tags.dto'
import { CreateContactDto } from './dto/create-contact.dto'
import { QueryContactsDto } from './dto/query-contacts.dto'
import { SendMessageDto } from './dto/send-message.dto'
import { UpdateContactDto } from './dto/update-contact.dto'

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @RequirePermission('CONTACTS', 'VIEW')
  @Get()
  list(@Query() query: QueryContactsDto) {
    return this.contacts.list(query)
  }

  @RequirePermission('CONTACTS', 'EXPORT')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Get('export')
  async export(@Query() query: QueryContactsDto, @Res() res: Response) {
    const csv = await this.contacts.exportCsv(query)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="contatos-${new Date().toISOString().slice(0, 10)}.csv"`,
    )
    res.send(csv)
  }

  @RequirePermission('CONTACTS', 'CREATE')
  @Post()
  create(@Body() dto: CreateContactDto, @CurrentUser() user: RequestUser) {
    return this.contacts.create(dto, user.id)
  }

  @RequirePermission('CONTACTS', 'VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contacts.findOne(id)
  }

  @RequirePermission('CONTACTS', 'EDIT')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contacts.update(id, dto)
  }

  @RequirePermission('CONTACTS', 'DELETE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contacts.remove(id)
  }

  @RequirePermission('CONTACTS', 'EDIT')
  @Post(':id/tags')
  addTags(
    @Param('id') id: string,
    @Body() dto: AddContactTagsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.contacts.addTags(id, dto, user.id)
  }

  @RequirePermission('CONTACTS', 'EDIT')
  @Delete(':id/tags/:tagId')
  removeTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.contacts.removeTag(id, tagId)
  }

  @RequirePermission('CONTACTS', 'EDIT')
  @Put(':id/opt-in')
  optIn(@Param('id') id: string, @Req() req: Request) {
    return this.contacts.optIn(id, 'manual', 'MANUAL', req.ip)
  }

  @RequirePermission('CONTACTS', 'EDIT')
  @Put(':id/opt-out')
  optOut(@Param('id') id: string) {
    return this.contacts.optOut(id, 'manual')
  }

  @RequirePermission('CONTACTS', 'VIEW')
  @Get(':id/messages')
  messages(@Param('id') id: string) {
    return this.contacts.messages(id)
  }

  @RequirePermission('INBOX', 'SEND')
  @Post(':id/messages')
  sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.contacts.sendMessage(id, dto)
  }

  @RequirePermission('CONTACTS', 'DELETE')
  @Post(':id/merge-from/:sourceId')
  mergeFrom(@Param('id') targetId: string, @Param('sourceId') sourceId: string) {
    return this.contacts.mergeFrom(targetId, sourceId)
  }
}
