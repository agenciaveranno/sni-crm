import { Module } from '@nestjs/common'
import { MetaModule } from '../meta/meta.module'
import { WhatsAppNumbersModule } from '../whatsapp-numbers/whatsapp-numbers.module'
import { ContactsController } from './contacts.controller'
import { ContactsService } from './contacts.service'

@Module({
  imports: [MetaModule, WhatsAppNumbersModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
