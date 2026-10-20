import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { assets, type Transaction, units, vendors, workOrders } from '@mall-pms/db';
import {
  type CreateWorkOrder,
  createWorkOrderSchema,
  OPEN_STATUSES,
  type Page,
  Permission,
  SLA_HOURS,
  type UpdateWorkOrderStatus,
  updateWorkOrderStatusSchema,
  type WorkOrderDetail,
  type WorkOrderListQuery,
  workOrderListQuerySchema,
  type WorkOrderRow,
  WORK_ORDER_TRANSITIONS,
} from '@mall-pms/shared';
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { SelectedFields } from 'drizzle-orm/pg-core';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DatabaseService } from '../database/database.module';
import { breachedSql, likeTerm, offset, toPage, totalSql } from './query-helpers';

export const workOrderRowColumns = {
  id: workOrders.id,
  code: workOrders.code,
  type: workOrders.type,
  trade: workOrders.trade,
  title: workOrders.title,
  priority: workOrders.priority,
  status: workOrders.status,
  reportedAt: workOrders.reportedAt,
  dueAt: workOrders.dueAt,
  closedAt: workOrders.closedAt,
  breached: breachedSql,
  assetCode: assets.code,
  unitCode: units.code,
  vendorName: vendors.name,
};

/** Base query for work-order rows with their asset, unit and vendor. */
export function selectWorkOrderRows<T extends SelectedFields>(tx: Transaction, extra: T) {
  return tx
    .select({ ...workOrderRowColumns, ...extra })
    .from(workOrders)
    .leftJoin(assets, eq(assets.id, workOrders.assetId))
    .leftJoin(units, eq(units.id, workOrders.unitId))
    .leftJoin(vendors, eq(vendors.id, workOrders.vendorId));
}

export const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Dates to ISO strings, as the JSON response carries them. */
export function toWorkOrderRow<T extends { reportedAt: Date; dueAt: Date; closedAt: Date | null }>(
  r: T,
) {
  return { ...r, reportedAt: iso(r.reportedAt)!, dueAt: iso(r.dueAt)!, closedAt: iso(r.closedAt) };
}

@Controller('malls/:mallId/work-orders')
export class WorkOrdersController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @RequirePermission(Permission.WorkOrderRead)
  async list(
    @CurrentUser() user: AuthUser,
    @Param('mallId', ParseUUIDPipe) mallId: string,
    @Query(new ZodValidationPipe(workOrderListQuerySchema)) q: WorkOrderListQuery,
  ): Promise<Page<WorkOrderRow>> {
    const filters: (SQL | undefined)[] = [eq(workOrders.mallId, mallId)];
    if (q.status === 'active') filters.push(inArray(workOrders.status, [...OPEN_STATUSES]));
    else if (q.status) filters.push(eq(workOrders.status, q.status));
    if (q.priority) filters.push(eq(workOrders.priority, q.priority));
    if (q.type) filters.push(eq(workOrders.type, q.type));
    if (q.breached) filters.push(q.breached === 'true' ? breachedSql : sql`not ${breachedSql}`);
    if (q.q) {
      const term = likeTerm(q.q);
      filters.push(
        or(
          ilike(workOrders.code, term),
          ilike(workOrders.title, term),
          ilike(assets.code, term),
          ilike(units.code, term),
        ),
      );
    }

    const rows = await this.database.tenant(user, (tx) =>
      selectWorkOrderRows(tx, { total: totalSql })
        .where(and(...filters))
        .orderBy(desc(workOrders.reportedAt))
        .limit(q.pageSize)
        .offset(offset(q)),
    );
    const page = toPage(rows, q);
    return { ...page, items: page.items.map(toWorkOrderRow) };
  }

  @Get(':id')
  @RequirePermission(Permission.WorkOrderRead)
  async get(
    @CurrentUser() user: AuthUser,
    @Param('mallId', ParseUUIDPipe) mallId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkOrderDetail> {
    const detail = await this.database.tenant(user, (tx) => this.load(tx, mallId, id));
    if (!detail) throw new NotFoundException();
    return detail;
  }

  @Post()
  @RequirePermission(Permission.WorkOrderCreate)
  async create(
    @CurrentUser() user: AuthUser,
    @Param('mallId', ParseUUIDPipe) mallId: string,
    @Body(new ZodValidationPipe(createWorkOrderSchema)) body: CreateWorkOrder,
  ): Promise<WorkOrderDetail> {
    return this.database.tenant(user, async (tx) => {
      const assetId = body.assetCode
        ? await this.findId(tx, assets, mallId, body.assetCode, 'asset')
        : null;
      const unitId = body.unitCode
        ? await this.findId(tx, units, mallId, body.unitCode, 'unit')
        : null;
      const [{ next }] = (
        await tx.execute<{ next: string }>(
          sql`select nextval('ops.work_order_number_seq')::text as next`,
        )
      ).rows as [{ next: string }];
      const reportedAt = new Date();
      const slaHours = SLA_HOURS[body.priority];
      const [created] = await tx
        .insert(workOrders)
        .values({
          orgId: user.orgId,
          mallId,
          code: `WO${next.padStart(7, '0')}`,
          type: body.type,
          trade: body.trade,
          title: body.title,
          description: body.description ?? null,
          priority: body.priority,
          source: body.source,
          assetId,
          unitId,
          reportedAt,
          slaHours,
          dueAt: new Date(reportedAt.getTime() + slaHours * 3_600_000),
        })
        .returning({ id: workOrders.id });
      return (await this.load(tx, mallId, created!.id))!;
    });
  }

  @Patch(':id/status')
  @RequirePermission(Permission.WorkOrderUpdate)
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('mallId', ParseUUIDPipe) mallId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateWorkOrderStatusSchema)) body: UpdateWorkOrderStatus,
  ): Promise<WorkOrderDetail> {
    return this.database.tenant(user, async (tx) => {
      const [current] = await tx
        .select({ status: workOrders.status, respondedAt: workOrders.respondedAt })
        .from(workOrders)
        .where(and(eq(workOrders.id, id), eq(workOrders.mallId, mallId)))
        .for('update');
      if (!current) throw new NotFoundException();
      if (!WORK_ORDER_TRANSITIONS[current.status].includes(body.status)) {
        throw new BadRequestException(
          `Cannot move a work order from ${current.status} to ${body.status}`,
        );
      }

      const now = new Date();
      await tx
        .update(workOrders)
        .set({
          status: body.status,
          respondedAt: current.respondedAt ?? (body.status === 'cancelled' ? null : now),
          closedAt: body.status === 'closed' ? now : null,
          ...(body.labourCostInr !== undefined && { labourCostInr: body.labourCostInr.toFixed(2) }),
          ...(body.materialCostInr !== undefined && {
            materialCostInr: body.materialCostInr.toFixed(2),
          }),
        })
        .where(eq(workOrders.id, id));
      return (await this.load(tx, mallId, id))!;
    });
  }

  private async load(tx: Transaction, mallId: string, id: string): Promise<WorkOrderDetail | null> {
    const [row] = await selectWorkOrderRows(tx, {
      description: workOrders.description,
      source: workOrders.source,
      respondedAt: workOrders.respondedAt,
      slaHours: workOrders.slaHours,
      labourCostInr: workOrders.labourCostInr,
      materialCostInr: workOrders.materialCostInr,
      assetId: assets.id,
      assetType: assets.assetType,
    }).where(and(eq(workOrders.id, id), eq(workOrders.mallId, mallId)));
    if (!row) return null;
    const { assetId, assetType, respondedAt, ...rest } = row;
    return {
      ...toWorkOrderRow(rest),
      respondedAt: iso(respondedAt),
      asset: assetId ? { id: assetId, code: rest.assetCode!, assetType: assetType! } : null,
      allowedTransitions: [...WORK_ORDER_TRANSITIONS[rest.status]],
    };
  }

  private async findId(
    tx: Transaction,
    table: typeof assets | typeof units,
    mallId: string,
    code: string,
    what: string,
  ): Promise<string> {
    const [row] = await tx
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.mallId, mallId), eq(table.code, code)));
    if (!row) throw new BadRequestException(`No ${what} ${code} in this mall`);
    return row.id;
  }
}
