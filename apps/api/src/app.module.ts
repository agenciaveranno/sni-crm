import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'

import { PrismaModule } from './prisma/prisma.module'
import { CryptoModule } from './common/crypto/crypto.module'
import { HealthModule } from './modules/health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { TagsModule } from './modules/tags/tags.module'
import { ContactsModule } from './modules/contacts/contacts.module'
import { WhatsAppNumbersModule } from './modules/whatsapp-numbers/whatsapp-numbers.module'
import { InboxModule } from './modules/inbox/inbox.module'
import { MetaModule } from './modules/meta/meta.module'
import { TemplatesModule } from './modules/templates/templates.module'
import { WebhooksModule } from './modules/webhooks/webhooks.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { PermissionsGuard } from './common/guards/permissions.guard'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
    ]),
    PrismaModule,
    CryptoModule,
    HealthModule,
    AuthModule,
    UsersModule,
    TagsModule,
    ContactsModule,
    WhatsAppNumbersModule,
    TemplatesModule,
    MetaModule,
    InboxModule,
    WebhooksModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
