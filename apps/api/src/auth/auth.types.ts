import type { RoleAssignment } from '@mall-pms/shared';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  assignments: RoleAssignment[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
