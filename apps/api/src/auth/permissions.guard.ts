import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, mallScopeFor } from '@mall-pms/shared';
import type { AuthenticatedRequest } from './auth.types';
import { IS_PUBLIC, type PermissionRequirement, REQUIRED_PERMISSION } from './decorators';

/**
 * Global guard that enforces @RequirePermission. Authenticated routes without
 * the decorator are allowed, so every controller that touches tenant data must
 * declare what it needs; row-level security in the database is the backstop.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(
      REQUIRED_PERMISSION,
      targets,
    );
    if (!requirement) return true;

    const { permission, scope } = requirement;
    const assignments = req.user.assignments;
    let allowed: boolean;
    switch (scope) {
      case 'portfolio':
        allowed = hasPermission(assignments, permission);
        break;
      case 'any': {
        const malls = mallScopeFor(assignments, permission);
        allowed = malls === 'all' || malls.length > 0;
        break;
      }
      case 'mall': {
        const mallId = req.params.mallId;
        if (typeof mallId !== 'string') {
          throw new InternalServerErrorException(
            `Route requires mall-scoped ${permission} but has no :mallId parameter`,
          );
        }
        allowed = hasPermission(assignments, permission, mallId);
        break;
      }
    }
    if (!allowed) throw new ForbiddenException();
    return true;
  }
}
