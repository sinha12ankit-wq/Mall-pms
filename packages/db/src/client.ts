import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export function createDb(connectionString: string, options: PoolConfig = {}) {
  const pool = new Pool({ connectionString, max: 10, ...options });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export interface TenantContext {
  orgId: string;
  /** 'all' for portfolio-wide access, otherwise the malls the caller may see. */
  mallIds: 'all' | readonly string[];
}

/**
 * Runs fn in a transaction with the row-level security settings for the
 * caller. Every query against tenant data must go through here.
 */
export function withTenant<T>(
  db: Database,
  ctx: TenantContext,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const mallIds = ctx.mallIds === 'all' ? '*' : ctx.mallIds.join(',');
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.org_id', ${ctx.orgId}, true), set_config('app.mall_ids', ${mallIds}, true)`,
    );
    return fn(tx);
  });
}
