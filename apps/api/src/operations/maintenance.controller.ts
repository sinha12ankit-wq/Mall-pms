import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { assets, maintenanceSchedules, vendors } from '@mall-pms/db';
import {
  type MaintenanceQuery,
  maintenanceQuerySchema,
  type MaintenanceRow,
  type Page,
  Permission,
} from '@mall-pms/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DatabaseService } from '../database/database.module';
import { offset, toPage, totalSql } from './query-helpers';

const WINDOW: Record<MaintenanceQuery['window'], ReturnType<typeof sql>> = {
  overdue: sql`${maintenanceSchedules.nextDueOn} < current_date`,
  '7d': sql`${maintenanceSchedules.nextDueOn} between current_date and current_date + 7`,
  '30d': sql`${maintenanceSchedules.nextDueOn} between current_date and current_date + 30`,
};

/** Planned preventive maintenance (PPM) due or overdue. */
@Controller('malls/:mallId/maintenance')
export class MaintenanceController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @RequirePermission(Permission.AssetRead)
  async list(
    @CurrentUser() user: AuthUser,
    @Param('mallId', ParseUUIDPipe) mallId: string,
    @Query(new ZodValidationPipe(maintenanceQuerySchema)) q: MaintenanceQuery,
  ): Promise<Page<MaintenanceRow>> {
    const rows = await this.database.tenant(user, (tx) =>
      tx
        .select({
          id: maintenanceSchedules.id,
          assetId: assets.id,
          assetCode: assets.code,
          assetType: assets.assetType,
          task: maintenanceSchedules.task,
          frequency: maintenanceSchedules.frequency,
          lastDoneOn: maintenanceSchedules.lastDoneOn,
          nextDueOn: maintenanceSchedules.nextDueOn,
          vendorName: vendors.name,
          criticality: assets.criticality,
          total: totalSql,
        })
        .from(maintenanceSchedules)
        .innerJoin(assets, eq(assets.id, maintenanceSchedules.assetId))
        .leftJoin(vendors, eq(vendors.id, maintenanceSchedules.vendorId))
        .where(
          and(
            eq(maintenanceSchedules.mallId, mallId),
            eq(maintenanceSchedules.isActive, true),
            WINDOW[q.window],
          ),
        )
        // criticality enum is ordered critical..low, so critical assets come first on a day.
        .orderBy(asc(maintenanceSchedules.nextDueOn), asc(assets.criticality), asc(assets.code))
        .limit(q.pageSize)
        .offset(offset(q)),
    );
    return toPage(rows, q);
  }
}
