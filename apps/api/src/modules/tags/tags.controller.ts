import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import {
  CurrentUser,
  type RequestUser,
} from '../../common/decorators/current-user.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { BulkContactsDto } from './dto/bulk-contacts.dto'
import { CreateTagDto } from './dto/create-tag.dto'
import { UpdateTagDto } from './dto/update-tag.dto'
import { TagsService } from './tags.service'

@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @RequirePermission('TAGS', 'VIEW')
  @Get()
  list() {
    return this.tags.list()
  }

  @RequirePermission('TAGS', 'CREATE')
  @Post()
  create(@Body() dto: CreateTagDto, @CurrentUser() user: RequestUser) {
    return this.tags.create(dto, user.id)
  }

  @RequirePermission('TAGS', 'VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tags.findOne(id)
  }

  @RequirePermission('TAGS', 'EDIT')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.tags.update(id, dto)
  }

  @RequirePermission('TAGS', 'DELETE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tags.remove(id)
  }

  @RequirePermission('TAGS', 'VIEW')
  @Get(':id/contacts')
  listContacts(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.tags.listContacts(id, page, Math.min(limit, 100))
  }

  @RequirePermission('TAGS', 'EDIT')
  @Post(':id/contacts')
  addContacts(
    @Param('id') id: string,
    @Body() dto: BulkContactsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tags.addContacts(id, dto, user.id)
  }

  @RequirePermission('TAGS', 'EDIT')
  @Delete(':id/contacts')
  removeContacts(@Param('id') id: string, @Body() dto: BulkContactsDto) {
    return this.tags.removeContacts(id, dto)
  }
}
