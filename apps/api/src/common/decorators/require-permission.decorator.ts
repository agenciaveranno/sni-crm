import { SetMetadata } from '@nestjs/common'
import type {
  PermissionAction,
  PermissionModule,
} from '@kotodama/shared'

export const PERMISSION_KEY = 'requiredPermission'

export interface RequiredPermission {
  module: PermissionModule
  action: PermissionAction
}

export const RequirePermission = (
  module: PermissionModule,
  action: PermissionAction,
) => SetMetadata(PERMISSION_KEY, { module, action } satisfies RequiredPermission)
