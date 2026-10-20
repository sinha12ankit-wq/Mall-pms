import { hasPermission, type MeResponse, type Permission } from '@mall-pms/shared';

/** UI-side check for showing actions. The API enforces the same rule. */
export const can = (me: MeResponse, permission: Permission, mallId: string) =>
  hasPermission(
    me.roles.map((r) => ({ role: r.role, mallId: r.mallId })),
    permission,
    mallId,
  );
