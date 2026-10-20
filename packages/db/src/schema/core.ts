import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { malls } from './space';

/** Platform core: organisations, users, role assignments and sessions. */
export const core = pgSchema('core');

export const roleEnum = core.enum('role', [
  'portfolio_admin',
  'mall_manager',
  'facility_manager',
  'technician',
  'security_supervisor',
  'viewer',
]);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const organizations = core.table('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ...timestamps,
});

export const users = core.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    /** Stored lower-case; the check constraint enforces it. */
    email: text('email').notNull().unique(),
    fullName: text('full_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [check('users_email_lowercase', sql`${t.email} = lower(${t.email})`)],
);

/**
 * A role held by a user. mall_id null means the role covers every mall in the
 * organisation; otherwise it is limited to that mall.
 */
export const roleAssignments = core.table(
  'role_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    mallId: uuid('mall_id').references(() => malls.id, { onDelete: 'cascade' }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index('role_assignments_user_idx').on(t.userId),
    unique('role_assignments_unique').on(t.userId, t.role, t.mallId).nullsNotDistinct(),
  ],
);

/**
 * Refresh tokens are stored as SHA-256 hashes. Each login starts a family;
 * rotating a token revokes it and issues the next one in the same family, so a
 * reused (stolen) token can revoke the whole family.
 */
export const refreshTokens = core.table(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('refresh_tokens_family_idx').on(t.familyId)],
);

export { timestamps };
