import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { malls } from '@mall-pms/db';
import { Permission } from '@mall-pms/shared';
import { asc, eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../auth/decorators';
import { DatabaseService } from '../database/database.module';

const mallColumns = {
  id: malls.id,
  code: malls.code,
  name: malls.name,
  city: malls.city,
  state: malls.state,
  timezone: malls.timezone,
};

@Controller('malls')
export class MallsController {
  constructor(private readonly database: DatabaseService) {}

  /** Malls the caller can see; row-level security does the filtering. */
  @Get()
  @RequirePermission(Permission.MallRead, 'any')
  list(@CurrentUser() user: AuthUser) {
    return this.database.tenant(user, (tx) =>
      tx.select(mallColumns).from(malls).orderBy(asc(malls.code)),
    );
  }

  @Get(':mallId')
  @RequirePermission(Permission.MallRead)
  async get(@CurrentUser() user: AuthUser, @Param('mallId', ParseUUIDPipe) mallId: string) {
    const [mall] = await this.database.tenant(user, (tx) =>
      tx.select(mallColumns).from(malls).where(eq(malls.id, mallId)),
    );
    if (!mall) throw new NotFoundException();
    return mall;
  }
}
