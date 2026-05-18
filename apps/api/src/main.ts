import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true })

  app.setGlobalPrefix('api/v1')
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  )
  app.use(helmet())

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'
  app.enableCors({
    origin: frontendUrl.split(',').map((u) => u.trim()),
    credentials: true,
  })

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001)
  await app.listen(port, '0.0.0.0')

  Logger.log(`Kotodama API rodando em http://localhost:${port}/api/v1`, 'Bootstrap')
}

bootstrap()
