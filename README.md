# Mall PMS

Property management system for a portfolio of shopping malls in India (10 malls, ~500 units each).
Operations (assets, maintenance, work orders, compliance, security) is the first module.

## Stack

| Part        | Choice                                                          |
| ----------- | --------------------------------------------------------------- |
| Monorepo    | pnpm workspaces                                                 |
| API         | NestJS 11 (TypeScript), `apps/api`                              |
| Web         | Next.js 16 App Router, `apps/web`                               |
| Database    | PostgreSQL 16, Drizzle ORM and SQL migrations, `packages/db`    |
| Shared code | Roles, permissions and request schemas (zod), `packages/shared` |

## Layout

```
apps/
  api/          NestJS API (auth, malls, health)
  web/          Next.js web app (sign-in, mall list)
packages/
  db/           Drizzle schema, migrations, migrate and seed scripts
  shared/       RBAC model and DTO schemas used by API and web
infra/postgres/ Local database bootstrap (creates the application role)
```

The API is a modular monolith. Each business area gets its own NestJS module and its own Postgres
schema, so a module can later be split out without untangling tables.

## Data model

| Schema  | Tables                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------- |
| `core`  | organizations, users, role_assignments, refresh_tokens                                                   |
| `space` | malls, levels, zones, units                                                                              |
| `ops`   | vendors, assets, maintenance_schedules, work_orders, compliance_items, incidents; view compliance_status |

Conventions:

- Every mall-scoped table carries `org_id` and `mall_id`, with row-level security on both. A composite
  foreign key to `malls(id, org_id)` keeps them consistent, and references between mall-scoped tables
  (a work order's asset, a unit's level) include `mall_id`, so a row can never point into another mall.
- Rows have a UUID primary key and a human `code` unique within the mall (e.g. `M01-CHI-001`, `WO0021181`).
- Values that depend on today's date are computed, not stored: compliance status comes from the
  `ops.compliance_status` view, and a work order is in SLA breach when it closes (or is still open) after `due_at`.
- Money is `numeric(12,2)` in rupees; areas are square feet, carpet and super area kept separately.

## Getting started

Requirements: Node 22, pnpm 10 (`corepack enable`), Docker.

```bash
pnpm install
cp .env.example .env
docker compose up -d db        # Postgres on localhost:5432
pnpm build:packages
pnpm db:migrate
pnpm db:seed                   # demo org and 5 users
pnpm db:seed:sample            # optional: 10 malls of synthetic operations data (~15s)
pnpm dev                       # API on :4000, web on :3000
```

Sign in at http://localhost:3000 with any seeded user and the password `ChangeMe!2026`:

| Email                        | Role                | Scope     |
| ---------------------------- | ------------------- | --------- |
| admin@demo.mallpms.in        | Portfolio admin     | All malls |
| manager.m01@demo.mallpms.in  | Mall manager        | M01       |
| fm.m01@demo.mallpms.in       | Facility manager    | M01       |
| tech.m01@demo.mallpms.in     | Technician          | M01       |
| security.m02@demo.mallpms.in | Security supervisor | M02       |

To run everything in containers instead: `docker compose --profile app up --build`.

## Using the web app

Load the sample data first (`pnpm db:seed:sample`) so there is something to look at.

- **Portfolio** (`/`): every mall you can access, with open work orders, SLA breaches, overdue
  maintenance and licence alerts. Users with a single mall go straight to it.
- **Mall overview**: KPIs (open work orders, on-time closure, PPM overdue, licences, incidents),
  open work by priority and the assets breaking down most often.
- **Work orders**: search and filter, raise a new one (the SLA is set from the priority), then start,
  hold, close (with labour and material cost) or cancel it.
- **Assets**: worst health first, with each asset's PPM schedule, 12-month cost and recent work orders.
- **Maintenance**: PPM tasks overdue, due this week or this month.
- **Compliance**: licences and statutory tests, overdue and expiring first.
- **Incidents**: the security incident log.

Tabs and buttons follow the user's role (a technician sees no compliance or incidents, a viewer can't
raise work orders); the API enforces the same rules.

The sample data stops on 30 Sep 2026, so dashboards measure their rolling windows up to the last
recorded activity, and work orders still open in the data show as past their SLA.

## Common commands

| Command                                      | What it does                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm test`                                  | Unit tests and API end-to-end tests (needs the database running and migrated) |
| `pnpm lint`, `pnpm typecheck`, `pnpm format` | Code quality                                                                  |
| `pnpm db:generate`                           | Write a new migration after changing `packages/db/src/schema`                 |
| `pnpm db:migrate`                            | Apply migrations                                                              |

CI runs formatting, lint, typecheck, migrations, a check that migrations match the schema, tests,
builds and both Docker images on every pull request.

## Security model

- **Authentication.** Email and password (argon2id). The API issues a 15-minute JWT access token and a
  30-day refresh token. Refresh tokens are stored hashed, rotate on every use, and reusing an old one
  revokes the whole session family. Login is rate limited to 5 attempts a minute per IP.
- **Web sessions.** Tokens live in httpOnly cookies set by the Next.js server, so browser scripts never
  see them. `src/proxy.ts` refreshes the access token before it expires.
- **Authorisation.** Users hold roles, each either portfolio-wide or limited to one mall. Roles map to
  permissions in `packages/shared/src/rbac.ts`. Routes declare what they need with
  `@RequirePermission(permission, scope)`; a global guard checks it against the `:mallId` in the URL.
  Users and roles are reloaded on every request, so revoking access takes effect immediately.
- **Row-level security.** The API connects as `mallpms_app`, which cannot change the schema and is always
  subject to Postgres row-level security. Every tenant query runs inside `withTenant`, which sets the
  caller's organisation and malls for that transaction. Without them, queries return nothing. Migrations
  and seeds run as the schema owner.

| Role                | Can do                                                           |
| ------------------- | ---------------------------------------------------------------- |
| Portfolio admin     | Everything, including managing users                             |
| Mall manager        | Everything in their mall except managing users                   |
| Facility manager    | Read all; manage space, assets, work orders, vendors, compliance |
| Technician          | Read space and assets; create and update work orders             |
| Security supervisor | Manage incidents; raise work orders                              |
| Viewer              | Read only                                                        |

## Roadmap

1. Foundations: monorepo, auth, roles per mall, row-level security, CI, Docker.
2. Space model (levels, zones, units) and Operations tables, with a loader for the sample dataset.
3. Operations MVP: assets, planned maintenance, work orders and SLAs, compliance calendar, incidents
   (first version of the API and web app in place).
4. Staff mobile app.
