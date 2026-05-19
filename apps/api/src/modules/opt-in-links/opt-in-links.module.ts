import { Module } from '@nestjs/common'
import { OptInLinksController } from './opt-in-links.controller'
import { OptInLinksService } from './opt-in-links.service'

@Module({
  controllers: [OptInLinksController],
  providers: [OptInLinksService],
})
export class OptInLinksModule {}
