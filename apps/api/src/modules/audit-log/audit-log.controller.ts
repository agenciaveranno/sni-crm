import { Controller, Get, Query } from '@nestjs/common'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { AuditLogService } from './audit-log.service'

@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @RequirePermission('AUDIT_LOG', 'VIEW')
  @Get()
  list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
    @Query('entity') entity?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ) {
    return this.service.list({
      page: Number(page),
      pageSize: Number(pageSize),
      entity,
      userId,
      action,
    })
  }
}
