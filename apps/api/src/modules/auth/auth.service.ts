import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { randomUUID } from 'node:crypto'
import { Redis } from '../../common/redis/redis.client'
import { PrismaService } from '../../prisma/prisma.service'
import type { JwtPayload } from './jwt.strategy'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciais inválidas')
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const jti = randomUUID()
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
    }

    const token = await this.jwt.signAsync(payload)

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }
  }

  async logout(token: string) {
    try {
      const decoded = await this.jwt.verifyAsync<JwtPayload>(token)
      const redis = Redis.maybeClient()
      if (!redis) return // sem redis, não há blacklist
      const nowSec = Math.floor(Date.now() / 1000)
      const ttl = Math.max(60, (decoded.exp ?? nowSec + 60) - nowSec)
      await redis.set(`jwt:blacklist:${decoded.jti}`, '1', 'EX', ttl)
    } catch {
      // token inválido — nada a fazer
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        permissions: {
          select: { module: true, action: true, granted: true },
        },
      },
    })
    if (!user) throw new UnauthorizedException('Usuário não encontrado')
    return user
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException()
    const ok = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!ok) throw new BadRequestException('Senha atual incorreta')
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })
    return { ok: true }
  }
}
