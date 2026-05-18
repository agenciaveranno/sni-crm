import { Controller, Get } from '@nestjs/common'
import { Public } from '../../common/decorators/public.decorator'
import { PrismaService } from '../../prisma/prisma.service'

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    let databaseOk = false
    try {
      await this.prisma.$queryRaw`SELECT 1`
      databaseOk = true
    } catch {
      databaseOk = false
    }

    return {
      status: databaseOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: databaseOk ? 'ok' : 'down',
    }
  }
}
