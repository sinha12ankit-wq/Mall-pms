import { levels, workOrders, zones } from '@mall-pms/db';
import { sql, type SQL } from 'drizzle-orm';

/** True when a work order closed after its due time, or is still open past it. */
export const breachedSql = sql<boolean>`coalesce(${workOrders.closedAt}, now()) > ${workOrders.dueAt}`;

/** "F1 North Atrium" from level and zone, or the free-text note. */
export const locationSql = (note: SQL | unknown) =>
  sql<string>`coalesce(nullif(concat_ws(' ', ${levels.code}, ${zones.name}), ''), ${note}, '')`;

/** Total row count alongside each row, so a page needs one query. */
export const totalSql = sql<number>`count(*) over ()`.mapWith(Number);

export const offset = (q: { page: number; pageSize: number }) => (q.page - 1) * q.pageSize;

/** Escapes LIKE wildcards in user input. */
export const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export function toPage<T extends { total: number }>(
  rows: T[],
  q: { page: number; pageSize: number },
) {
  return {
    items: rows.map(({ total: _total, ...rest }) => rest),
    total: rows[0]?.total ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  };
}

/**
 * The end of the rolling windows on dashboards: now, or the latest activity in
 * the mall if the data stops earlier (as the sample data does).
 */
export const asOfSql = (mallId: string) =>
  sql<string>`(select least(now(), coalesce(max(${workOrders.reportedAt}), now())) from ${workOrders} where ${workOrders.mallId} = ${mallId})`;
