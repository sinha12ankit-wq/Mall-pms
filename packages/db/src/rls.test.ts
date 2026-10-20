import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, withTenant } from './client';
import {
  assets,
  complianceItems,
  levels,
  malls,
  organizations,
  units,
  vendors,
  workOrders,
} from './schema';

/**
 * Row-level security is the backstop behind the API's permission checks.
 * These tests use the restricted application role directly, so they prove
 * the database enforces isolation on its own.
 */
describe('row-level security', () => {
  const owner = createDb(process.env.DATABASE_URL!, { max: 1 });
  const app = createDb(process.env.APP_DATABASE_URL!, { max: 2 });
  const ids = { orgA: '', orgB: '', mallA1: '', mallA2: '', mallB1: '', levelA2: '' };

  beforeAll(async () => {
    const db = owner.db;
    const suffix = randomUUID().slice(0, 8);
    const org = async (slug: string) =>
      (
        await db
          .insert(organizations)
          .values({ name: slug, slug: `${slug}-${suffix}` })
          .returning()
      )[0]!.id;
    ids.orgA = await org('rls-a');
    ids.orgB = await org('rls-b');
    const mall = async (orgId: string, code: string) =>
      (
        await db
          .insert(malls)
          .values({ orgId, code, name: code, city: 'Pune', state: 'Maharashtra' })
          .returning()
      )[0]!.id;
    ids.mallA1 = await mall(ids.orgA, 'A1');
    ids.mallA2 = await mall(ids.orgA, 'A2');
    ids.mallB1 = await mall(ids.orgB, 'B1');

    for (const [orgId, mallId, code] of [
      [ids.orgA, ids.mallA1, 'A1'],
      [ids.orgA, ids.mallA2, 'A2'],
      [ids.orgB, ids.mallB1, 'B1'],
    ] as const) {
      await db.insert(assets).values({
        orgId,
        mallId,
        code: `${code}-AHU-001`,
        assetType: 'AHU',
        trade: 'HVAC',
        criticality: 'high',
      });
      await db.insert(workOrders).values({
        orgId,
        mallId,
        code: `${code}-WO-1`,
        type: 'reactive',
        trade: 'HVAC',
        title: 'AHU tripped',
        priority: 'high',
        source: 'help_desk',
        reportedAt: new Date(),
        slaHours: 8,
        dueAt: new Date(Date.now() + 8 * 3_600_000),
      });
      await db.insert(complianceItems).values({
        orgId,
        mallId,
        code: `${code}-C1`,
        item: 'Fire NOC',
        authority: 'Fire dept',
        renewalCycleMonths: 12,
        expiresOn: '2020-01-01',
      });
    }
    await db.insert(vendors).values([
      { orgId: ids.orgA, code: 'VA', name: 'Vendor A', trade: 'HVAC', contractType: 'on_call' },
      { orgId: ids.orgB, code: 'VB', name: 'Vendor B', trade: 'HVAC', contractType: 'on_call' },
    ]);
    ids.levelA2 = (
      await db
        .insert(levels)
        .values({ orgId: ids.orgA, mallId: ids.mallA2, code: 'G', name: 'Ground', sortOrder: 1 })
        .returning()
    )[0]!.id;
  });

  afterAll(async () => {
    await owner.db.delete(vendors).where(sql`${vendors.orgId} in (${ids.orgA}, ${ids.orgB})`);
    await owner.db.delete(malls).where(sql`${malls.orgId} in (${ids.orgA}, ${ids.orgB})`);
    await owner.db
      .delete(organizations)
      .where(sql`${organizations.id} in (${ids.orgA}, ${ids.orgB})`);
    await owner.pool.end();
    await app.pool.end();
  });

  it('returns nothing when no tenant context is set', async () => {
    expect(await app.db.select().from(workOrders)).toEqual([]);
    expect(await app.db.select().from(vendors)).toEqual([]);
  });

  it('limits a mall-scoped caller to their malls', async () => {
    const rows = await withTenant(app.db, { orgId: ids.orgA, mallIds: [ids.mallA1] }, (tx) =>
      tx.select({ code: workOrders.code }).from(workOrders),
    );
    expect(rows.map((r) => r.code)).toEqual(['A1-WO-1']);
  });

  it('lets a portfolio-wide caller see every mall in their organisation only', async () => {
    const rows = await withTenant(app.db, { orgId: ids.orgA, mallIds: 'all' }, (tx) =>
      tx.select({ code: assets.code }).from(assets).orderBy(assets.code),
    );
    expect(rows.map((r) => r.code)).toEqual(['A1-AHU-001', 'A2-AHU-001']);
  });

  it('scopes vendors by organisation', async () => {
    const rows = await withTenant(app.db, { orgId: ids.orgA, mallIds: [ids.mallA1] }, (tx) =>
      tx.select({ code: vendors.code }).from(vendors),
    );
    expect(rows.map((r) => r.code)).toEqual(['VA']);
  });

  it('applies to the compliance status view', async () => {
    const rows = await withTenant(app.db, { orgId: ids.orgA, mallIds: [ids.mallA1] }, (tx) =>
      tx.execute<{ code: string; status: string }>(
        sql`select code, status from ops.compliance_status`,
      ),
    );
    expect(rows.rows).toEqual([{ code: 'A1-C1', status: 'overdue' }]);
  });

  const rlsError = {
    cause: expect.objectContaining({ message: expect.stringMatching(/row-level security/) }),
  };

  it('blocks writes into a mall outside the caller scope', async () => {
    await expect(
      withTenant(app.db, { orgId: ids.orgA, mallIds: [ids.mallA1] }, (tx) =>
        tx.insert(assets).values({
          orgId: ids.orgA,
          mallId: ids.mallA2,
          code: 'X',
          assetType: 'AHU',
          trade: 'HVAC',
          criticality: 'low',
        }),
      ),
    ).rejects.toMatchObject(rlsError);
  });

  it('blocks updates that would move a row to another mall', async () => {
    await expect(
      withTenant(app.db, { orgId: ids.orgA, mallIds: [ids.mallA1] }, (tx) =>
        tx.update(assets).set({ mallId: ids.mallA2 }).where(eq(assets.code, 'A1-AHU-001')),
      ),
    ).rejects.toMatchObject(rlsError);
  });

  it('rejects a unit whose level belongs to another mall', async () => {
    await expect(
      owner.db.insert(units).values({
        orgId: ids.orgA,
        mallId: ids.mallA1,
        code: 'A1-G-001',
        levelId: ids.levelA2,
        unitType: 'inline',
        carpetAreaSqft: '500',
        superAreaSqft: '700',
      }),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: '23503' }) });
  });

  it('rejects a row whose org does not match its mall', async () => {
    await expect(
      owner.db.insert(assets).values({
        orgId: ids.orgB,
        mallId: ids.mallA1,
        code: 'Y',
        assetType: 'AHU',
        trade: 'HVAC',
        criticality: 'low',
      }),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: '23503' }) });
  });
});
