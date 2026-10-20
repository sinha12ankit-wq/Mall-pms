import { randomUUID } from 'node:crypto';
import { createDb, malls, organizations, roleAssignments, users } from '@mall-pms/db';
import { type Role } from '@mall-pms/shared';
import { hash } from '@node-rs/argon2';
import { eq, inArray } from 'drizzle-orm';

export const PASSWORD = 'Test-Password-123';

export interface Fixture {
  orgId: string;
  mallIds: Record<string, string>;
  emails: Record<string, string>;
  cleanup(): Promise<void>;
}

/**
 * Creates an isolated organisation with malls and users, using the owner
 * connection (which bypasses row-level security).
 */
export async function createFixture(
  mallCodes: string[],
  people: { key: string; role: Role; mall: string | null; active?: boolean }[],
): Promise<Fixture> {
  const { db, pool } = createDb(process.env.DATABASE_URL!, { max: 1 });
  const suffix = randomUUID().slice(0, 8);
  const [org] = await db
    .insert(organizations)
    .values({ name: `Test ${suffix}`, slug: `test-${suffix}` })
    .returning();
  const mallIds: Record<string, string> = {};
  for (const code of mallCodes) {
    const [m] = await db
      .insert(malls)
      .values({ orgId: org!.id, code, name: `Mall ${code}`, city: 'Pune', state: 'Maharashtra' })
      .returning();
    mallIds[code] = m!.id;
  }
  const passwordHash = await hash(PASSWORD);
  const emails: Record<string, string> = {};
  const userIds: string[] = [];
  for (const p of people) {
    const email = `${p.key}-${suffix}@test.mallpms.in`;
    const [u] = await db
      .insert(users)
      .values({ orgId: org!.id, email, fullName: p.key, passwordHash, isActive: p.active ?? true })
      .returning();
    userIds.push(u!.id);
    await db
      .insert(roleAssignments)
      .values({ userId: u!.id, role: p.role, mallId: p.mall ? mallIds[p.mall]! : null });
    emails[p.key] = email;
  }
  return {
    orgId: org!.id,
    mallIds,
    emails,
    async cleanup() {
      await db.delete(users).where(inArray(users.id, userIds));
      await db.delete(malls).where(eq(malls.orgId, org!.id));
      await db.delete(organizations).where(eq(organizations.id, org!.id));
      await pool.end();
    },
  };
}
