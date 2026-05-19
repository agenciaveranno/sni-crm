import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { MetaModule } from '../meta/meta.module'
import { CAMPAIGN_DISPATCH_QUEUE } from '../../queue/queue.module'
import { CampaignsController } from './campaigns.controller'
import { CampaignsService } from './campaigns.service'
import { CampaignDispatcherProcessor } from './dispatcher.processor'

@Module({
  imports: [
    BullModule.registerQueue({ name: CAMPAIGN_DISPATCH_QUEUE }),
    MetaModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignDispatcherProcessor],
  exports: [CampaignsService],
})
export class CampaignsModule {}
