import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

export interface RequestUser {
  id: string
  email: string
  role: 'ADMIN' | 'OPERATOR'
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user: RequestUser }>()
    return req.user
  },
)
