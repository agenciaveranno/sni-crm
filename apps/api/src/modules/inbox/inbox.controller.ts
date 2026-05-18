import { Controller, Get } from '@nestjs/common'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { InboxService } from './inbox.service'

@Controller('inbox')
export class InboxController {
  constructor(private readonly service: InboxService) {}

  @RequirePermission('INBOX', 'VIEW')
  @Get('conversations')
  conversations() {
    return this.service.listConversations()
  }
}
