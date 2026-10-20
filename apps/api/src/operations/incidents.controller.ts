import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { incidents, levels, zones } from '@mall-pms/db';
import {
  type IncidentListQuery,
  incidentListQuerySchema,
  type IncidentRow,
  type Page,
  Permission,
} from '@mall-pms/shared';
import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DatabaseService } from '../database/database.module';
import { likeTerm, locationSql, offset, toPage, totalSql } from './query-helpers';

@Controller('malls/:mallId/incidents')
export class IncidentsController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @RequirePermission(Permission.IncidentRead)
  async list(
    @CurrentUser() user: AuthUser,
    @Param('mallId', ParseUUIDPipe) mallId: string,
    @Query(new ZodValidationPipe(incidentListQuerySchema)) q: IncidentListQuery,
  ): Promise<Page<IncidentRow>> {
    const filters: (SQL | undefined)[] = [eq(incidents.mallId, mallId)];
    if (q.severity) filters.push(eq(incidents.severity, q.severity));
    if (q.q) {
      const term = likeTerm(q.q);
      filters.push(or(ilike(incidents.code, term), ilike(incidents.type, term)));
    }
    const rows = await this.database.tenant(user, (tx) =>
      tx
        .select({
          id: incidents.id,
          code: incidents.code,
          occurredAt: incidents.occurredAt,
          type: incidents.type,
          severity: incidents.severity,
          location: locationSql(incidents.locationNote),
          responseMinutes: incidents.responseMinutes,
          policeInformed: incidents.policeInformed,
          status: incidents.status,
          total: totalSql,
        })
        .from(incidents)
        .leftJoin(levels, eq(levels.id, incidents.levelId))
        .leftJoin(zones, eq(zones.id, incidents.zoneId))
        .where(and(...filters))
        .orderBy(desc(incidents.occurredAt))
        .limit(q.pageSize)
        .offset(offset(q)),
    );
    const page = toPage(rows, q);
    return {
      ...page,
      items: page.items.map((r) => ({ ...r, occurredAt: r.occurredAt.toISOString() })),
    };
  }
}
