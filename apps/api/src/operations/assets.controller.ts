import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { assets, levels, maintenanceSchedules, vendors, workOrders, zones } from '@mall-pms/db';
import {
  type AssetDetail,
  type AssetListQuery,
  assetListQuerySchema,
  type AssetRow,
  type Page,
  Permission,
} from '@mall-pms/shared';
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DatabaseService } from '../database/database.module';
import { asOfSql, likeTerm, locationSql, offset, toPage, totalSql } from './query-helpers';
import { selectWorkOrderRows, toWorkOrderRow } from './work-orders.controller';

const assetColumns = {
  id: assets.id,
  code: assets.code,
  assetType: assets.assetType,
  trade: assets.trade,
  make: assets.make,
  location: locationSql(assets.locationNote),
  criticality: assets.criticality,
  healthScore: assets.healthScore,
  status: assets.status,
  vendorName: vendors.name,
};

@Controller('malls/:mallId/assets')
export class AssetsController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @RequirePermission(Permission.AssetRead)
  async list(
    @CurrentUser() user: AuthUser,
    @Param('mallId', ParseUUIDPipe) mallId: string,
    @Query(new ZodValidationPipe(assetListQuerySchema)) q: AssetListQuery,
  ): Promise<Page<AssetRow>> {
    const filters: (SQL | undefined)[] = [eq(assets.mallId, mallId)];
    if (q.trade) filters.push(eq(assets.trade, q.trade));
    if (q.criticality) filters.push(eq(assets.criticality, q.criticality));
    if (q.q) {
      const term = likeTerm(q.q);
      filters.push(
        or(ilike(assets.code, term), ilike(assets.assetType, term), ilike(assets.make, term)),
      );
    }
    const rows = await this.database.tenant(user, (tx) =>
      tx
        .select({ ...assetColumns, total: totalSql })
        .from(assets)
        .leftJoin(levels, eq(levels.id, assets.levelId))
        .leftJoin(zones, eq(zones.id, assets.zoneId))
        .leftJoin(vendors, eq(vendors.id, assets.amcVendorId))
        .where(and(...filters))
        // Worst condition first, which is what a facility manager looks for.
        .orderBy(asc(assets.healthScore), asc(assets.code))
        .limit(q.pageSize)
        .offset(offset(q)),
    );
    return toPage(rows, q);
  }

  @Get(':id')
  @RequirePermission(Permission.AssetRead)
  async get(
    @CurrentUser() user: AuthUser,
    @Param('mallId', ParseUUIDPipe) mallId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AssetDetail> {
    return this.database.tenant(user, async (tx) => {
      const [asset] = await tx
        .select({
          ...assetColumns,
          model: assets.model,
          installDate: assets.installDate,
          warrantyEnd: assets.warrantyEnd,
        })
        .from(assets)
        .leftJoin(levels, eq(levels.id, assets.levelId))
        .leftJoin(zones, eq(zones.id, assets.zoneId))
        .leftJoin(vendors, eq(vendors.id, assets.amcVendorId))
        .where(and(eq(assets.id, id), eq(assets.mallId, mallId)));
      if (!asset) throw new NotFoundException();

      const schedules = await tx
        .select({
          id: maintenanceSchedules.id,
          task: maintenanceSchedules.task,
          frequency: maintenanceSchedules.frequency,
          lastDoneOn: maintenanceSchedules.lastDoneOn,
          nextDueOn: maintenanceSchedules.nextDueOn,
        })
        .from(maintenanceSchedules)
        .where(eq(maintenanceSchedules.assetId, id));

      const [stats] = await tx
        .select({
          workOrders12m: sql<number>`count(*)`.mapWith(Number),
          reactive12m: sql<number>`count(*) filter (where ${workOrders.type} = 'reactive')`.mapWith(
            Number,
          ),
          costInr12m: sql<string>`coalesce(sum(coalesce(${workOrders.labourCostInr}, 0) + coalesce(${workOrders.materialCostInr}, 0)), 0)::text`,
        })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.assetId, id),
            sql`${workOrders.reportedAt} > ${asOfSql(mallId)} - interval '12 months'`,
          ),
        );

      const recent = await selectWorkOrderRows(tx, {})
        .where(eq(workOrders.assetId, id))
        .orderBy(desc(workOrders.reportedAt))
        .limit(15);

      return { ...asset, schedules, stats: stats!, recentWorkOrders: recent.map(toWorkOrderRow) };
    });
  }
}
