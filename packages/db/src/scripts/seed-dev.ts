/**
 * Development seed: one organisation, two malls and a login for each role
 * scope. Safe to run more than once. Never run against production.
 */
import { hash } from '@node-rs/argon2';
import { Role } from '@mall-pms/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { createDb } from '../client';
import { malls, organizations, roleAssignments, users } from '../schema';

const ORG = { name: 'Demo Mall Portfolio', slug: 'demo' };

const MALLS = [
  { code: 'M01', name: 'Aurum Central', city: 'Mumbai', state: 'Maharashtra' },
  { code: 'M02', name: 'Saffron Square', city: 'Gurugram', state: 'Haryana' },
];

const USERS: { email: string; fullName: string; role: Role; mallCode: string | null }[] = [
  {
    email: 'admin@demo.mallpms.in',
    fullName: 'Portfolio Admin',
    role: Role.PortfolioAdmin,
    mallCode: null,
  },
  {
    email: 'manager.m01@demo.mallpms.in',
    fullName: 'Aurum Mall Manager',
    role: Role.MallManager,
    mallCode: 'M01',
  },
  {
    email: 'fm.m01@demo.mallpms.in',
    fullName: 'Aurum Facility Manager',
    role: Role.FacilityManager,
    mallCode: 'M01',
  },
  {
    email: 'tech.m01@demo.mallpms.in',
    fullName: 'Aurum Technician',
    role: Role.Technician,
    mallCode: 'M01',
  },
  {
    email: 'security.m02@demo.mallpms.in',
    fullName: 'Saffron Security Supervisor',
    role: Role.SecuritySupervisor,
    mallCode: 'M02',
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing to run the dev seed in production');
  const password = process.env.SEED_PASSWORD ?? 'ChangeMe!2026';

  const { db, pool } = createDb(url, { max: 1 });
  try {
    await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values(ORG)
        .onConflictDoUpdate({ target: organizations.slug, set: { name: ORG.name } })
        .returning();
      if (!org) throw new Error('organisation upsert failed');

      const mallIds = new Map<string, string>();
      for (const m of MALLS) {
        const [row] = await tx
          .insert(malls)
          .values({ ...m, orgId: org.id })
          .onConflictDoUpdate({
            target: [malls.orgId, malls.code],
            set: { name: m.name, city: m.city, state: m.state },
          })
          .returning({ id: malls.id });
        mallIds.set(m.code, row!.id);
      }

      const passwordHash = await hash(password);
      for (const u of USERS) {
        const [user] = await tx
          .insert(users)
          .values({ orgId: org.id, email: u.email, fullName: u.fullName, passwordHash })
          .onConflictDoUpdate({
            target: users.email,
            set: { fullName: u.fullName, passwordHash },
          })
          .returning({ id: users.id });
        const mallId = u.mallCode ? mallIds.get(u.mallCode)! : null;
        const existing = await tx
          .select({ id: roleAssignments.id })
          .from(roleAssignments)
          .where(
            and(
              eq(roleAssignments.userId, user!.id),
              eq(roleAssignments.role, u.role),
              mallId ? eq(roleAssignments.mallId, mallId) : isNull(roleAssignments.mallId),
            ),
          );
        if (existing.length === 0) {
          await tx.insert(roleAssignments).values({ userId: user!.id, role: u.role, mallId });
        }
      }
    });
    console.log(
      `Seeded ${USERS.length} users. Password: ${process.env.SEED_PASSWORD ? '(from SEED_PASSWORD)' : 'ChangeMe!2026'}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
