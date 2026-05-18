import { Module } from '@nestjs/common'
import { MetaModule } from '../meta/meta.module'
import { WhatsAppNumbersModule } from '../whatsapp-numbers/whatsapp-numbers.module'
import { TemplatesController } from './templates.controller'
import { TemplatesService } from './templates.service'

@Module({
  imports: [MetaModule, WhatsAppNumbersModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
