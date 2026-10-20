import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenClaims } from '@mall-pms/shared';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';
import { IS_PUBLIC } from './decorators';

/**
 * Global guard: every route needs a valid access token unless marked @Public().
 * The user and their roles are reloaded on each request, so deactivating a
 * user or removing a role takes effect immediately rather than at token expiry.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(header.slice(7));
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.auth.loadActiveUser(claims.sub);
    if (!user || user.orgId !== claims.org) throw new UnauthorizedException();
    req.user = user;
    return true;
  }
}
