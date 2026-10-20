import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  foreignKey,
  integer,
  numeric,
  pgSchema,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './core';

/** Space model: malls, levels, zones and leasable units. */
export const space = pgSchema('space');

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const malls = space.table(
  'malls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    /** Short human code used across the business, e.g. M01. */
    code: text('code').notNull(),
    name: text('name').notNull(),
    city: text('city').notNull(),
    state: text('state').notNull(),
    timezone: text('timezone').notNull().default('Asia/Kolkata'),
    /** City tier: metro, tier2 or tier3. */
    tier: text('tier'),
    openedYear: smallint('opened_year'),
    /** 15-character GST identification number of the mall's legal entity. */
    gstin: text('gstin'),
    glaSuperSqft: integer('gla_super_sqft'),
    parkingBays: integer('parking_bays'),
    opensAt: time('opens_at'),
    closesAt: time('closes_at'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('malls_org_code_key').on(t.orgId, t.code),
    // Lets child tables prove their org_id matches their mall's.
    unique('malls_id_org_key').on(t.id, t.orgId),
    check('malls_tier_check', sql`${t.tier} in ('metro', 'tier2', 'tier3')`),
    check('malls_gstin_check', sql`${t.gstin} ~ '^[0-9]{2}[0-9A-Z]{13}$'`),
  ],
);

/**
 * Columns every mall-scoped table carries. org_id is denormalised so that
 * row-level security can filter without a join; the composite foreign key to
 * malls(id, org_id) keeps it consistent.
 */
export const mallScoped = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  mallId: uuid('mall_id').notNull(),
});

/** Ties a mall-scoped row to its mall and keeps org_id consistent with it. */
export const mallFk = (t: { mallId: AnyPgColumn; orgId: AnyPgColumn }) =>
  foreignKey({ columns: [t.mallId, t.orgId], foreignColumns: [malls.id, malls.orgId] }).onDelete(
    'cascade',
  );

export const levels = space.table(
  'levels',
  {
    ...mallScoped(),
    /** Floor code as used on signage and unit numbers: LG, G, F1, F2... */
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** Vertical order, lowest first. */
    sortOrder: smallint('sort_order').notNull(),
    ...timestamps,
  },
  (t) => [
    mallFk(t),
    unique('levels_mall_code_key').on(t.mallId, t.code),
    unique('levels_id_mall_key').on(t.id, t.mallId),
  ],
);

/** A named area of a mall, e.g. North Atrium. Zones span levels. */
export const zones = space.table(
  'zones',
  {
    ...mallScoped(),
    name: text('name').notNull(),
    ...timestamps,
  },
  (t) => [
    mallFk(t),
    unique('zones_mall_name_key').on(t.mallId, t.name),
    unique('zones_id_mall_key').on(t.id, t.mallId),
  ],
);

export const unitTypeEnum = space.enum('unit_type', ['anchor', 'inline', 'kiosk']);
export const unitStatusEnum = space.enum('unit_status', ['vacant', 'fit_out', 'occupied']);

export const units = space.table(
  'units',
  {
    ...mallScoped(),
    /** Unit number, e.g. M01-G-002. */
    code: text('code').notNull(),
    levelId: uuid('level_id').notNull(),
    zoneId: uuid('zone_id'),
    unitType: unitTypeEnum('unit_type').notNull(),
    /** Trade category the unit is planned for, e.g. Fashion and apparel. */
    category: text('category'),
    carpetAreaSqft: numeric('carpet_area_sqft', { precision: 10, scale: 2 }).notNull(),
    superAreaSqft: numeric('super_area_sqft', { precision: 10, scale: 2 }).notNull(),
    frontageFt: numeric('frontage_ft', { precision: 6, scale: 1 }),
    status: unitStatusEnum('status').notNull().default('vacant'),
    ...timestamps,
  },
  (t) => [
    mallFk(t),
    // Level and zone must belong to the same mall as the unit.
    foreignKey({ columns: [t.levelId, t.mallId], foreignColumns: [levels.id, levels.mallId] }),
    foreignKey({ columns: [t.zoneId, t.mallId], foreignColumns: [zones.id, zones.mallId] }),
    unique('units_mall_code_key').on(t.mallId, t.code),
    unique('units_id_mall_key').on(t.id, t.mallId),
    check(
      'units_area_check',
      sql`${t.carpetAreaSqft} > 0 and ${t.superAreaSqft} >= ${t.carpetAreaSqft}`,
    ),
  ],
);
