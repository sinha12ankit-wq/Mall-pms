-- Row-level security and the application role.
--
-- Migrations and seeds run as the schema owner. The API connects as
-- mallpms_app, which can read and write data but cannot change the schema,
-- and is always subject to row-level security.
--
-- Each API transaction sets two settings (see withTenant in @mall-pms/db):
--   app.org_id   the caller's organisation
--   app.mall_ids '*' for portfolio-wide access, otherwise a comma-separated
--                list of mall ids
-- If they are not set, the policies match nothing, so access fails closed.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mallpms_app') THEN
    CREATE ROLE mallpms_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
CREATE FUNCTION core.current_org_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE FUNCTION core.mall_visible(mall uuid) RETURNS boolean
  LANGUAGE sql STABLE
  AS $$
    SELECT CASE coalesce(current_setting('app.mall_ids', true), '')
      WHEN '*' THEN true
      WHEN '' THEN false
      ELSE mall = ANY (string_to_array(current_setting('app.mall_ids', true), ',')::uuid[])
    END
  $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA core, space TO mallpms_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core, space TO mallpms_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA core, space GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mallpms_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION core.current_org_id(), core.mall_visible(uuid) TO mallpms_app;
--> statement-breakpoint
ALTER TABLE space.malls ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON space.malls
  USING (org_id = core.current_org_id() AND core.mall_visible(id))
  WITH CHECK (org_id = core.current_org_id() AND core.mall_visible(id));
