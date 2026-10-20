import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { assets, incidents, maintenanceSchedules, malls, workOrders } from '@mall-pms/db';
import {
  type MallDashboard,
  OPEN_STATUSES,
  Permission,
  type PortfolioMallSummary,
  type WorkOrderPriority,
} from '@mall-pms/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../auth/decorators';
import { DatabaseService } from '../database/database.module';
import { asOfSql, breachedSql } from './query-helpers';

const count = (where?: ReturnType<typeof sql>) =>
  (where ? sql<number>`count(*) filter (where ${where})` : sql<number>`count(*)`).mapWith(Number);
const isActive = inArray(workOrders.status, [...OPEN_STATUSES]);

@Controller()
export class DashboardController {
  constructor(private readonly database: DatabaseService) {}

  /** One row per mall the caller can see, for the portfolio overview. */
  @Get('portfolio')
  @RequirePermission(Permission.MallRead, 'any')
  portfolio(@CurrentUser() user: AuthUser): Promise<PortfolioMallSummary[]> {
    return this.database.tenant(user, async (tx) => {
      const result = await tx.execute<PortfolioMallSummary & Record<string, unknown>>(sql`
        select m.id, m.code, m.name, m.city,
          (select count(*)::int from ops.work_orders w
             where w.mall_id = m.id and w.status in ('open', 'assigned', 'in_progress', 'on_hold')) as "activeWorkOrders",
          (select count(*)::int from ops.work_orders w
             where w.mall_id = m.id and w.status in ('open', 'assigned', 'in_progress', 'on_hold')
               and w.due_at < now()) as "breachedWorkOrders",
          (select count(*)::int from ops.maintenance_schedules s
             where s.mall_id = m.id and s.is_active and s.next_due_on < current_date) as "overduePpm",
          (select count(*)::int from ops.compliance_status c
             where c.mall_id = m.id and c.status = 'overdue') as "complianceOverdue",
          (select count(*)::int from ops.compliance_status c
             where c.mall_id = m.id and c.status = 'due_soon') as "complianceDueSoon"
        from space.malls m
        order by m.code`);
      return result.rows;
    });
  }

  @Get('malls/:mallId/dashboard')
  @RequirePermission(Permission.MallRead)
  dashboard(
    @CurrentUser() user: AuthUser,
    @Param('mallId', ParseUUIDPipe) mallId: string,
  ): Promise<MallDashboard> {
    return this.database.tenant(user, async (tx) => {
      const [mall] = await tx
        .select({ id: malls.id, code: malls.code, name: malls.name, city: malls.city })
        .from(malls)
        .where(eq(malls.id, mallId));
      if (!mall) throw new NotFoundException();

      const asOf = sql`(${asOfSql(mallId)})`;
      const closedRecently = sql`${workOrders.closedAt} > ${asOf} - interval '30 days'`;

      const [wo] = await tx
        .select({
          active: count(isActive),
          activeBreached: count(sql`${isActive} and ${breachedSql}`),
          emergency: count(sql`${isActive} and ${workOrders.priority} = 'emergency'`),
          high: count(sql`${isActive} and ${workOrders.priority} = 'high'`),
          medium: count(sql`${isActive} and ${workOrders.priority} = 'medium'`),
          low: count(sql`${isActive} and ${workOrders.priority} = 'low'`),
          closed30d: count(closedRecently),
          closedOnTime30d: count(
            sql`${closedRecently} and ${workOrders.closedAt} <= ${workOrders.dueAt}`,
          ),
          asOf: sql<string>`${asOf}::date::text`,
        })
        .from(workOrders)
        .where(eq(workOrders.mallId, mallId));

      const [ppm] = await tx
        .select({
          overdue: count(sql`${maintenanceSchedules.nextDueOn} < current_date`),
          dueNext7d: count(
            sql`${maintenanceSchedules.nextDueOn} between current_date and current_date + 7`,
          ),
        })
        .from(maintenanceSchedules)
        .where(
          and(eq(maintenanceSchedules.mallId, mallId), eq(maintenanceSchedules.isActive, true)),
        );

      const compliance = await tx.execute<{ overdue: number; dueSoon: number }>(sql`
        select count(*) filter (where status = 'overdue')::int as overdue,
               count(*) filter (where status = 'due_soon')::int as "dueSoon"
        from ops.compliance_status where mall_id = ${mallId}`);

      const recentIncident = sql`${incidents.occurredAt} > ${asOf} - interval '30 days'`;
      const [inc] = await tx
        .select({
          last30d: count(recentIncident),
          high30d: count(sql`${recentIncident} and ${incidents.severity} in ('high', 'critical')`),
        })
        .from(incidents)
        .where(eq(incidents.mallId, mallId));

      const reactive90d = sql<number>`count(*)`.mapWith(Number);
      const problemAssets = await tx
        .select({
          id: assets.id,
          code: assets.code,
          assetType: assets.assetType,
          healthScore: assets.healthScore,
          reactive90d,
        })
        .from(workOrders)
        .innerJoin(assets, eq(assets.id, workOrders.assetId))
        .where(
          and(
            eq(workOrders.mallId, mallId),
            eq(workOrders.type, 'reactive'),
            sql`${workOrders.reportedAt} > ${asOf} - interval '90 days'`,
          ),
        )
        .groupBy(assets.id)
        .orderBy(desc(reactive90d), asc(assets.healthScore))
        .limit(5);

      const byPriority: Record<WorkOrderPriority, number> = {
        emergency: wo!.emergency,
        high: wo!.high,
        medium: wo!.medium,
        low: wo!.low,
      };
      return {
        mall,
        workOrders: {
          active: wo!.active,
          activeBreached: wo!.activeBreached,
          byPriority,
          closed30d: wo!.closed30d,
          closedOnTime30d: wo!.closedOnTime30d,
        },
        maintenance: ppm!,
        compliance: compliance.rows[0]!,
        incidents: inc!,
        problemAssets,
        asOf: wo!.asOf,
      };
    });
  }
}
