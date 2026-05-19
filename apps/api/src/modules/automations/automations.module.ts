import { Global, Module } from '@nestjs/common'
import { MetaModule } from '../meta/meta.module'
import { AutomationsController } from './automations.controller'
import { AutomationsService } from './automations.service'

@Global()
@Module({
  imports: [MetaModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}
