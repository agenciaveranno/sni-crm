import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { PrismaService } from '../../prisma/prisma.service'
import {
  PERMISSION_KEY,
  type RequiredPermission,
} from '../decorators/require-permission.decorator'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!required) return true

    const req = context.switchToHttp().getRequest<
      Request & { user?: { id: string; role: 'ADMIN' | 'OPERATOR' } }
    >()
    const user = req.user
    if (!user) return false
    if (user.role === 'ADMIN') return true

    const perm = await this.prisma.permission.findUnique({
      where: {
        userId_module_action: {
          userId: user.id,
          module: required.module,
          action: required.action,
        },
      },
      select: { granted: true },
    })
    return Boolean(perm?.granted)
  }
}
