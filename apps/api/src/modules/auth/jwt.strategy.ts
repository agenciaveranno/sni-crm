import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Redis } from '../../common/redis/redis.client'
import { PrismaService } from '../../prisma/prisma.service'

export interface JwtPayload {
  sub: string
  email: string
  role: 'ADMIN' | 'OPERATOR'
  jti: string
  iat?: number
  exp?: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret',
    })
  }

  async validate(payload: JwtPayload) {
    // Verifica blacklist no Redis (logout)
    const redis = Redis.maybeClient()
    if (redis) {
      const blacklisted = await redis.get(`jwt:blacklist:${payload.jti}`)
      if (blacklisted) {
        throw new UnauthorizedException('Sessão expirada')
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, active: true },
    })
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuário inativo')
    }

    return { id: user.id, email: user.email, role: user.role }
  }
}
