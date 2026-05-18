import { Module } from '@nestjs/common'
import { WhatsAppNumbersController } from './whatsapp-numbers.controller'
import { WhatsAppNumbersService } from './whatsapp-numbers.service'

@Module({
  controllers: [WhatsAppNumbersController],
  providers: [WhatsAppNumbersService],
  exports: [WhatsAppNumbersService],
})
export class WhatsAppNumbersModule {}
