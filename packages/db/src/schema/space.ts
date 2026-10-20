import { pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './core';

/** Space model: malls and, later, levels, zones and units. */
export const space = pgSchema('space');

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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('malls_org_code_key').on(t.orgId, t.code)],
);
