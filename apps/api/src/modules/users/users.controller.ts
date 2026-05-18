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
import {
  CurrentUser,
  type RequestUser,
} from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CreateUserDto } from './dto/create-user.dto'
import { SetPermissionsDto } from './dto/set-permissions.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UsersService } from './users.service'

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list()
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findById(id)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto)
  }

  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.users.deactivate(id, user.id)
  }

  @Get(':id/permissions')
  listPermissions(@Param('id') id: string) {
    return this.users.listPermissions(id)
  }

  @Put(':id/permissions')
  setPermissions(@Param('id') id: string, @Body() dto: SetPermissionsDto) {
    return this.users.setPermissions(id, dto)
  }
}
