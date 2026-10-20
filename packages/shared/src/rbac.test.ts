import { describe, expect, it } from 'vitest';
import { hasPermission, mallScopeFor, Permission, Role, type RoleAssignment } from './rbac';

const M1 = 'mall-1';
const M2 = 'mall-2';

describe('rbac', () => {
  it('portfolio-wide roles apply to every mall', () => {
    const a: RoleAssignment[] = [{ role: Role.PortfolioAdmin, mallId: null }];
    expect(hasPermission(a, Permission.UserManage, M1)).toBe(true);
    expect(hasPermission(a, Permission.UserManage)).toBe(true);
    expect(mallScopeFor(a, Permission.AssetRead)).toBe('all');
  });

  it('mall-scoped roles apply only to that mall', () => {
    const a: RoleAssignment[] = [{ role: Role.Technician, mallId: M1 }];
    expect(hasPermission(a, Permission.WorkOrderUpdate, M1)).toBe(true);
    expect(hasPermission(a, Permission.WorkOrderUpdate, M2)).toBe(false);
    expect(hasPermission(a, Permission.WorkOrderUpdate)).toBe(false);
    expect(mallScopeFor(a, Permission.WorkOrderRead)).toEqual([M1]);
  });

  it('technicians cannot assign work orders or manage users', () => {
    const a: RoleAssignment[] = [{ role: Role.Technician, mallId: M1 }];
    expect(hasPermission(a, Permission.WorkOrderAssign, M1)).toBe(false);
    expect(hasPermission(a, Permission.UserManage, M1)).toBe(false);
  });

  it('combines roles across malls', () => {
    const a: RoleAssignment[] = [
      { role: Role.MallManager, mallId: M1 },
      { role: Role.Viewer, mallId: M2 },
    ];
    expect(hasPermission(a, Permission.AssetWrite, M1)).toBe(true);
    expect(hasPermission(a, Permission.AssetWrite, M2)).toBe(false);
    expect(mallScopeFor(a, Permission.AssetRead).toString()).toBe([M1, M2].toString());
    expect(mallScopeFor(a, Permission.AssetWrite)).toEqual([M1]);
  });

  it('nobody but a portfolio admin manages users', () => {
    const a: RoleAssignment[] = [{ role: Role.MallManager, mallId: null }];
    expect(hasPermission(a, Permission.UserManage)).toBe(false);
  });
});
