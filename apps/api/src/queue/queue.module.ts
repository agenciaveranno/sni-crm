import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

export const CAMPAIGN_DISPATCH_QUEUE = 'campaign-dispatch'

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL')
        if (!url) throw new Error('REDIS_URL não configurada')
        return { connection: { url } }
      },
    }),
    BullModule.registerQueue({ name: CAMPAIGN_DISPATCH_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
