/**
 * Loads the synthetic sample dataset (10 malls, ~5,000 units, 14,000 assets,
 * 37,000 work orders) into the demo organisation. Upserts by business code,
 * so it is safe to run more than once.
 *
 *   pnpm db:seed:sample [directory]
 *
 * The directory holds the CSVs, plain or gzipped; it defaults to
 * packages/db/sample-data. Never run against production.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { getTableColumns, type InferInsertModel, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { createDb, type Transaction } from '../client';
import {
  assets,
  complianceItems,
  incidents,
  levels,
  maintenanceSchedules,
  malls,
  organizations,
  units,
  vendors,
  workOrders,
  zones,
} from '../schema';

type Row = Record<string, string>;
type Frequency = InferInsertModel<typeof maintenanceSchedules>['frequency'];

const ORG = { name: 'Demo Mall Portfolio', slug: 'demo' };
const BATCH = 1000;

// ---------------------------------------------------------------------------
// Reading and mapping helpers

function readCsv(dir: string, name: string): Row[] {
  const plain = path.join(dir, `${name}.csv`);
  const gz = `${plain}.gz`;
  const raw = existsSync(gz) ? gunzipSync(readFileSync(gz)) : readFileSync(plain);
  return parse(raw, { columns: true, skip_empty_lines: true }) as Row[];
}

const orNull = (v: string | undefined) => (v === undefined || v === '' ? null : v);
const lower = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
const bool = (v: string) => v === 'True' || v === 'true';
/** The dataset records local mall time without an offset. */
const ist = (v: string | undefined) =>
  orNull(v) ? new Date(`${v!.replace(' ', 'T')}+05:30`) : null;

function req<K, V>(map: Map<K, V>, key: K, what: string): V {
  const v = map.get(key);
  if (v === undefined) throw new Error(`Unknown ${what}: ${String(key)}`);
  return v;
}

/** Splits "F1 North Atrium" into level and zone; anything else is a free-text note. */
function parseLocation(location: string): {
  level: string | null;
  zone: string | null;
  note: string | null;
} {
  const m = /^(LG|UG|G|B\d|F\d+)\s+(.+)$/.exec(location.trim());
  return m
    ? { level: m[1]!, zone: m[2]!, note: null }
    : { level: null, zone: null, note: orNull(location) };
}

function levelOrder(code: string): { sortOrder: number; name: string } {
  if (code === 'LG') return { sortOrder: 0, name: 'Lower ground' };
  if (code === 'G') return { sortOrder: 1, name: 'Ground' };
  if (code === 'UG') return { sortOrder: 2, name: 'Upper ground' };
  const floor = /^F(\d+)$/.exec(code);
  if (floor) return { sortOrder: 2 + Number(floor[1]), name: `Floor ${floor[1]}` };
  const basement = /^B(\d+)$/.exec(code);
  if (basement) return { sortOrder: -Number(basement[1]), name: `Basement ${basement[1]}` };
  throw new Error(`Unknown level code: ${code}`);
}

const FREQUENCY_DAYS: Record<Frequency, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  quarterly: 91,
  half_yearly: 182,
  yearly: 365,
};

/** The dataset covers Oct 2025 to Sep 2026. */
const DATA_END = '2026-09-30';

/** Small stable string hash, so reloading gives the same dates. */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const addDays = (d: string, days: number) => {
  const date = new Date(`${d}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// ---------------------------------------------------------------------------
// Database helpers

/** ON CONFLICT ... DO UPDATE SET every column except the keys and created_at. */
function excludedSet(table: PgTable, keep: string[]) {
  const set: Record<string, unknown> = {};
  for (const [prop, col] of Object.entries(getTableColumns(table)) as [string, PgColumn][]) {
    if (keep.includes(prop) || prop === 'id' || prop === 'createdAt') continue;
    set[prop] = prop === 'updatedAt' ? sql`now()` : sql.raw(`excluded."${col.name}"`);
  }
  return set;
}

/**
 * Upserts rows in batches and returns a map from the natural key to id.
 * keyOf builds the map key from a returned row.
 */
async function upsert<T extends PgTable, K extends keyof InferInsertModel<T> & string>(
  tx: Transaction,
  table: T,
  rows: InferInsertModel<T>[],
  conflictKeys: K[],
  keyOf: (r: Record<string, unknown>) => string,
): Promise<Map<string, string>> {
  const cols = getTableColumns(table) as Record<string, PgColumn>;
  const target = conflictKeys.map((k) => cols[k]!);
  const returning = Object.fromEntries(['id', ...conflictKeys].map((k) => [k, cols[k]!])) as Record<
    string,
    PgColumn
  >;
  const ids = new Map<string, string>();
  for (let i = 0; i < rows.length; i += BATCH) {
    const out = (await tx
      .insert(table)
      .values(rows.slice(i, i + BATCH))
      .onConflictDoUpdate({ target, set: excludedSet(table, conflictKeys) })
      .returning(returning)) as Record<string, unknown>[];
    for (const r of out) ids.set(keyOf(r), r.id as string);
  }
  return ids;
}

const byMall = (mallId: unknown, code: unknown) => `${mallId as string}|${code as string}`;

// ---------------------------------------------------------------------------

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing to load sample data in production');
  const dir = path.resolve(process.argv[2] ?? path.join(__dirname, '../../sample-data'));

  const data = {
    malls: readCsv(dir, 'malls'),
    units: readCsv(dir, 'units'),
    vendors: readCsv(dir, 'vendors'),
    assets: readCsv(dir, 'assets'),
    workOrders: readCsv(dir, 'work_orders'),
    compliance: readCsv(dir, 'compliance_register'),
    incidents: readCsv(dir, 'security_incidents'),
  };

  const { db, pool } = createDb(url, { max: 1 });
  const started = Date.now();
  try {
    await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values(ORG)
        .onConflictDoUpdate({ target: organizations.slug, set: { name: ORG.name } })
        .returning();
      const orgId = org!.id;

      // Malls
      const mallIds = await upsert(
        tx,
        malls,
        data.malls.map((m) => {
          const [opensAt, closesAt] = m.operating_hours!.split('-');
          return {
            orgId,
            code: m.mall_id!,
            name: m.mall_name!,
            city: m.city!,
            state: m.state!,
            tier: m.tier!,
            openedYear: Number(m.opened_year),
            gstin: m.gstin!,
            glaSuperSqft: Number(m.gla_super_sqft),
            parkingBays: Number(m.parking_bays),
            opensAt: orNull(opensAt),
            closesAt: orNull(closesAt),
          };
        }),
        ['orgId', 'code'],
        (r) => r.code as string,
      );
      const mallId = (code: string) => req(mallIds, code, 'mall');

      // Levels and zones, collected from every place the data mentions them.
      const levelCodes = new Set<string>();
      const zoneNames = new Set<string>();
      const note = (mall: string, level: string | null, zone: string | null) => {
        if (level) levelCodes.add(`${mall}|${level}`);
        if (zone) zoneNames.add(`${mall}|${zone}`);
      };
      for (const u of data.units) note(u.mall_id!, u.level!, orNull(u.zone));
      for (const r of [...data.assets, ...data.incidents]) {
        const loc = parseLocation(r.location!);
        note(r.mall_id!, loc.level, loc.zone);
      }

      const levelIds = await upsert(
        tx,
        levels,
        [...levelCodes].map((key) => {
          const [mall, code] = key.split('|') as [string, string];
          return { orgId, mallId: mallId(mall), code, ...levelOrder(code) };
        }),
        ['mallId', 'code'],
        (r) => byMall(r.mallId, r.code),
      );
      const zoneIds = await upsert(
        tx,
        zones,
        [...zoneNames].map((key) => {
          const [mall, name] = key.split('|') as [string, string];
          return { orgId, mallId: mallId(mall), name };
        }),
        ['mallId', 'name'],
        (r) => byMall(r.mallId, r.name),
      );
      const levelId = (mall: string, code: string | null) =>
        code ? req(levelIds, byMall(mallId(mall), code), 'level') : null;
      const zoneId = (mall: string, name: string | null) =>
        name ? req(zoneIds, byMall(mallId(mall), name), 'zone') : null;

      // Units
      const unitIds = await upsert(
        tx,
        units,
        data.units.map((u) => ({
          orgId,
          mallId: mallId(u.mall_id!),
          code: u.unit_id!,
          levelId: levelId(u.mall_id!, u.level!)!,
          zoneId: zoneId(u.mall_id!, orNull(u.zone)),
          unitType: lower(u.unit_type!) as 'anchor' | 'inline' | 'kiosk',
          category: orNull(u.category),
          carpetAreaSqft: u.carpet_area_sqft!,
          superAreaSqft: u.super_area_sqft!,
          frontageFt: orNull(u.frontage_ft),
          status: lower(u.status!) as 'vacant' | 'fit_out' | 'occupied',
        })),
        ['mallId', 'code'],
        (r) => byMall(r.mallId, r.code),
      );
      const unitId = (mall: string, code: string | undefined) =>
        orNull(code) ? req(unitIds, byMall(mallId(mall), code), 'unit') : null;

      // Vendors
      const vendorIds = await upsert(
        tx,
        vendors,
        data.vendors.map((v) => ({
          orgId,
          code: v.vendor_id!,
          name: v.vendor_name!,
          trade: v.trade!,
          contractType: lower(v.contract_type!) as
            'comprehensive_amc' | 'non_comprehensive_amc' | 'on_call',
          slaResponseHours: Number(v.sla_response_hrs),
          gstin: orNull(v.gstin),
        })),
        ['orgId', 'code'],
        (r) => r.code as string,
      );
      const vendorId = (code: string | undefined) =>
        orNull(code) ? req(vendorIds, code, 'vendor') : null;

      // Assets
      const assetIds = await upsert(
        tx,
        assets,
        data.assets.map((a) => {
          const loc = parseLocation(a.location!);
          return {
            orgId,
            mallId: mallId(a.mall_id!),
            code: a.asset_id!,
            assetType: a.asset_type!,
            trade: a.trade!,
            make: orNull(a.make),
            model: orNull(a.model),
            levelId: levelId(a.mall_id!, loc.level),
            zoneId: zoneId(a.mall_id!, loc.zone),
            locationNote: loc.note,
            installDate: orNull(a.install_date),
            warrantyEnd: orNull(a.warranty_end),
            criticality: lower(a.criticality!) as 'critical' | 'high' | 'medium' | 'low',
            amcVendorId: vendorId(a.amc_vendor_id),
            healthScore: a.health_score ? Number(a.health_score) : null,
            status: lower(a.status!) as 'in_service' | 'under_repair' | 'decommissioned',
          };
        }),
        ['mallId', 'code'],
        (r) => byMall(r.mallId, r.code),
      );
      const assetId = (mall: string, code: string | undefined) =>
        orNull(code) ? req(assetIds, byMall(mallId(mall), code), 'asset') : null;

      // PPM schedules: one per asset. Last done and next due come from the
      // asset's most recent PPM work order.
      const lastPpm = new Map<string, { raised: string; closed: string | null }>();
      for (const w of data.workOrders) {
        if (w.wo_type !== 'PPM' || !w.asset_id) continue;
        const key = `${w.mall_id}|${w.asset_id}`;
        const raised = w.created_at!.slice(0, 10);
        const prev = lastPpm.get(key);
        if (!prev || raised > prev.raised)
          lastPpm.set(key, { raised, closed: orNull(w.closed_at?.slice(0, 10)) });
      }
      const scheduleIds = await upsert(
        tx,
        maintenanceSchedules,
        data.assets.map((a) => {
          const frequency = lower(a.ppm_frequency!) as Frequency;
          const last = lastPpm.get(`${a.mall_id}|${a.asset_id}`);
          return {
            orgId,
            mallId: mallId(a.mall_id!),
            assetId: assetId(a.mall_id!, a.asset_id)!,
            task: a.ppm_task!,
            frequency,
            vendorId: vendorId(a.amc_vendor_id),
            lastDoneOn: last?.closed ?? null,
            nextDueOn: last
              ? addDays(last.raised, FREQUENCY_DAYS[frequency])
              : // No PPM history in the dataset: spread first due dates across one cycle.
                addDays(DATA_END, 1 + (hash(a.asset_id!) % FREQUENCY_DAYS[frequency])),
          };
        }),
        ['assetId', 'task'],
        (r) => r.assetId as string,
      );

      // Work orders
      await upsert(
        tx,
        workOrders,
        data.workOrders.map((w) => {
          const reportedAt = ist(w.created_at)!;
          const asset = assetId(w.mall_id!, w.asset_id);
          return {
            orgId,
            mallId: mallId(w.mall_id!),
            code: w.wo_id!,
            type: lower(w.wo_type!) as 'ppm' | 'reactive' | 'tenant_request',
            trade: w.trade!,
            title: w.title!,
            priority: lower(w.priority!) as 'low' | 'medium' | 'high' | 'emergency',
            source: lower(w.source!) as
              'ppm_schedule' | 'help_desk' | 'tenant_app' | 'patrol' | 'bms_alarm',
            status: lower(w.status!) as 'open' | 'in_progress' | 'closed',
            assetId: asset,
            unitId: unitId(w.mall_id!, w.unit_id),
            scheduleId: w.wo_type === 'PPM' && asset ? (scheduleIds.get(asset) ?? null) : null,
            vendorId: vendorId(w.vendor_id),
            reportedAt,
            respondedAt: ist(w.responded_at),
            closedAt: ist(w.closed_at),
            slaHours: Number(w.sla_hours),
            dueAt: new Date(reportedAt.getTime() + Number(w.sla_hours) * 3_600_000),
            labourCostInr: orNull(w.labour_cost_inr),
            materialCostInr: orNull(w.material_cost_inr),
          };
        }),
        ['mallId', 'code'],
        (r) => byMall(r.mallId, r.code),
      );

      // Compliance register
      await upsert(
        tx,
        complianceItems,
        data.compliance.map((c) => ({
          orgId,
          mallId: mallId(c.mall_id!),
          code: c.compliance_id!,
          item: c.item!,
          authority: c.authority!,
          renewalCycleMonths: c.renewal_cycle_years
            ? Math.round(Number(c.renewal_cycle_years) * 12)
            : null,
          issuedOn: orNull(c.issued_on),
          expiresOn: orNull(c.expires_on),
          ownerRole: orNull(c.owner_role),
        })),
        ['mallId', 'code'],
        (r) => byMall(r.mallId, r.code),
      );

      // Security incidents
      await upsert(
        tx,
        incidents,
        data.incidents.map((i) => {
          const loc = parseLocation(i.location!);
          return {
            orgId,
            mallId: mallId(i.mall_id!),
            code: i.incident_id!,
            occurredAt: ist(i.occurred_at)!,
            type: i.type!,
            severity: lower(i.severity!) as 'low' | 'medium' | 'high' | 'critical',
            levelId: levelId(i.mall_id!, loc.level),
            zoneId: zoneId(i.mall_id!, loc.zone),
            locationNote: loc.note,
            responseMinutes: orNull(i.response_min),
            policeInformed: bool(i.police_informed!),
            status: lower(i.status!) as 'open' | 'closed',
          };
        }),
        ['mallId', 'code'],
        (r) => byMall(r.mallId, r.code),
      );
    });

    const counts = Object.entries(data)
      .map(([k, rows]) => `${k} ${rows.length.toLocaleString('en-IN')}`)
      .join(', ');
    console.log(`Loaded sample data in ${((Date.now() - started) / 1000).toFixed(1)}s: ${counts}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
