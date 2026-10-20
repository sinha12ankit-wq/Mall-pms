import { Global, Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import {
  createDb,
  type Database,
  type TenantContext,
  type Transaction,
  withTenant,
} from '@mall-pms/db';
import { mallScopeFor, Permission, type RoleAssignment } from '@mall-pms/shared';
import type { Pool } from 'pg';
import { APP_CONFIG, type AppConfig } from '../config';

export interface TenantPrincipal {
  orgId: string;
  assignments: readonly RoleAssignment[];
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: Database;
  private readonly pool: Pool;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const { db, pool } = createDb(config.APP_DATABASE_URL);
    this.db = db;
    this.pool = pool;
  }

  /**
   * Runs fn with row-level security limited to the malls the principal can
   * read. Finer per-permission checks happen in PermissionsGuard.
   */
  tenant<T>(principal: TenantPrincipal, fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const ctx: TenantContext = {
      orgId: principal.orgId,
      mallIds: mallScopeFor(principal.assignments, Permission.MallRead),
    };
    return withTenant(this.db, ctx, fn);
  }

  async ping(): Promise<void> {
    await this.pool.query('select 1');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
