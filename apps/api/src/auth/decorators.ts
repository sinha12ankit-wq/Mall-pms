import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission } from '@mall-pms/shared';
import type { AuthenticatedRequest, AuthUser } from './auth.types';

export const IS_PUBLIC = 'auth:isPublic';
/** Skips authentication for a route. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Where a permission must be held:
 * - 'mall': in the mall named by the :mallId route parameter
 * - 'any': in at least one mall (the handler must filter by scope)
 * - 'portfolio': through a portfolio-wide role
 */
export type PermissionScope = 'mall' | 'any' | 'portfolio';

export interface PermissionRequirement {
  permission: Permission;
  scope: PermissionScope;
}

export const REQUIRED_PERMISSION = 'auth:requiredPermission';
export const RequirePermission = (permission: Permission, scope: PermissionScope = 'mall') =>
  SetMetadata(REQUIRED_PERMISSION, { permission, scope } satisfies PermissionRequirement);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
