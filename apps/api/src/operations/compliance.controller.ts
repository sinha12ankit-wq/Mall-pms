import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { type ComplianceRow, Permission } from '@mall-pms/shared';
import { sql } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../auth/decorators';
import { DatabaseService } from '../database/database.module';

/** Statutory compliance register, most urgent first. A mall has a few dozen items, so no paging. */
@Controller('malls/:mallId/compliance')
export class ComplianceController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @RequirePermission(Permission.ComplianceRead)
  list(
    @CurrentUser() user: AuthUser,
    @Param('mallId', ParseUUIDPipe) mallId: string,
  ): Promise<ComplianceRow[]> {
    return this.database.tenant(user, async (tx) => {
      const result = await tx.execute<ComplianceRow & Record<string, unknown>>(sql`
        select id, code, item, authority,
               renewal_cycle_months as "renewalCycleMonths",
               issued_on::text as "issuedOn", expires_on::text as "expiresOn",
               owner_role as "ownerRole", days_to_expiry as "daysToExpiry", status
        from ops.compliance_status
        where mall_id = ${mallId}
        order by array_position(array['overdue', 'due_soon', 'valid', 'permanent'], status),
                 expires_on nulls last, item`);
      return result.rows;
    });
  }
}
