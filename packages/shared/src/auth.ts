import { z } from 'zod';
import { ALL_ROLES, type Role } from './rbac';

export const loginRequestSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(256),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(20).max(512),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const roleSchema = z.enum(ALL_ROLES as [Role, ...Role[]]);

export interface AuthTokens {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  refreshToken: string;
}

export interface MeResponse {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  roles: { role: Role; mallId: string | null; mallCode: string | null }[];
}

export interface AccessTokenClaims {
  sub: string;
  org: string;
}
