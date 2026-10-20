/**
 * Role-based access control shared by the API and the web app.
 *
 * A user holds one or more role assignments. Each assignment is either
 * portfolio-wide (mallId = null, covers every mall in the organisation)
 * or scoped to a single mall. Permissions are derived from roles here,
 * so the mapping lives in one place and the database only stores roles.
 */

export const Permission = {
  MallRead: 'mall:read',
  MallManage: 'mall:manage',
  UserManage: 'user:manage',
  SpaceRead: 'space:read',
  SpaceWrite: 'space:write',
  AssetRead: 'asset:read',
  AssetWrite: 'asset:write',
  WorkOrderRead: 'work_order:read',
  WorkOrderCreate: 'work_order:create',
  WorkOrderAssign: 'work_order:assign',
  WorkOrderUpdate: 'work_order:update',
  VendorRead: 'vendor:read',
  VendorWrite: 'vendor:write',
  ComplianceRead: 'compliance:read',
  ComplianceWrite: 'compliance:write',
  IncidentRead: 'incident:read',
  IncidentWrite: 'incident:write',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);

export const Role = {
  PortfolioAdmin: 'portfolio_admin',
  MallManager: 'mall_manager',
  FacilityManager: 'facility_manager',
  Technician: 'technician',
  SecuritySupervisor: 'security_supervisor',
  Viewer: 'viewer',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: readonly Role[] = Object.values(Role);

const READ_ONLY: Permission[] = [
  Permission.MallRead,
  Permission.SpaceRead,
  Permission.AssetRead,
  Permission.WorkOrderRead,
  Permission.VendorRead,
  Permission.ComplianceRead,
  Permission.IncidentRead,
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.PortfolioAdmin]: ALL_PERMISSIONS,
  [Role.MallManager]: ALL_PERMISSIONS.filter((p) => p !== Permission.UserManage),
  [Role.FacilityManager]: [
    ...READ_ONLY,
    Permission.SpaceWrite,
    Permission.AssetWrite,
    Permission.WorkOrderCreate,
    Permission.WorkOrderAssign,
    Permission.WorkOrderUpdate,
    Permission.VendorWrite,
    Permission.ComplianceWrite,
  ],
  [Role.Technician]: [
    Permission.MallRead,
    Permission.SpaceRead,
    Permission.AssetRead,
    Permission.WorkOrderRead,
    Permission.WorkOrderCreate,
    Permission.WorkOrderUpdate,
  ],
  [Role.SecuritySupervisor]: [
    Permission.MallRead,
    Permission.SpaceRead,
    Permission.IncidentRead,
    Permission.IncidentWrite,
    Permission.WorkOrderRead,
    Permission.WorkOrderCreate,
  ],
  [Role.Viewer]: READ_ONLY,
};

export interface RoleAssignment {
  role: Role;
  /** null means the assignment covers every mall in the organisation. */
  mallId: string | null;
}

/** Permissions the user holds in a given mall. */
export function permissionsForMall(
  assignments: readonly RoleAssignment[],
  mallId: string,
): Set<Permission> {
  const result = new Set<Permission>();
  for (const a of assignments) {
    if (a.mallId === null || a.mallId === mallId) {
      for (const p of ROLE_PERMISSIONS[a.role]) result.add(p);
    }
  }
  return result;
}

/** Permissions the user holds across the whole organisation (portfolio-wide roles only). */
export function portfolioPermissions(assignments: readonly RoleAssignment[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const a of assignments) {
    if (a.mallId === null) {
      for (const p of ROLE_PERMISSIONS[a.role]) result.add(p);
    }
  }
  return result;
}

export function hasPermission(
  assignments: readonly RoleAssignment[],
  permission: Permission,
  mallId?: string,
): boolean {
  const perms =
    mallId === undefined
      ? portfolioPermissions(assignments)
      : permissionsForMall(assignments, mallId);
  return perms.has(permission);
}

/**
 * Mall scope for a permission: 'all' when a portfolio-wide role grants it,
 * otherwise the list of mall ids where a mall-scoped role grants it.
 */
export function mallScopeFor(
  assignments: readonly RoleAssignment[],
  permission: Permission,
): 'all' | string[] {
  if (portfolioPermissions(assignments).has(permission)) return 'all';
  const malls = new Set<string>();
  for (const a of assignments) {
    if (a.mallId !== null && ROLE_PERMISSIONS[a.role].includes(permission)) malls.add(a.mallId);
  }
  return [...malls];
}
