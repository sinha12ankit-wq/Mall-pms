-- Row-level security and grants for the space and ops tables added in 0002.
-- Same model as 0001: the caller's organisation and malls come from
-- app.org_id and app.mall_ids, set per transaction by withTenant.

GRANT USAGE ON SCHEMA ops TO mallpms_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA space, ops TO mallpms_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA ops GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mallpms_app;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'space.levels', 'space.zones', 'space.units',
    'ops.assets', 'ops.maintenance_schedules', 'ops.work_orders',
    'ops.compliance_items', 'ops.incidents'
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s
         USING (org_id = core.current_org_id() AND core.mall_visible(mall_id))
         WITH CHECK (org_id = core.current_org_id() AND core.mall_visible(mall_id))',
      t);
  END LOOP;
END
$$;
--> statement-breakpoint
-- Vendors serve the whole organisation, so they are scoped by org only.
ALTER TABLE ops.vendors ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON ops.vendors
  USING (org_id = core.current_org_id())
  WITH CHECK (org_id = core.current_org_id());
--> statement-breakpoint
-- Compliance status depends on today's date, so it is computed rather than
-- stored. security_invoker makes the view obey the caller's row-level security.
CREATE VIEW ops.compliance_status WITH (security_invoker = true) AS
SELECT
  c.*,
  c.expires_on - current_date AS days_to_expiry,
  CASE
    WHEN c.expires_on IS NULL THEN 'permanent'
    WHEN c.expires_on < current_date THEN 'overdue'
    WHEN c.expires_on <= current_date + 60 THEN 'due_soon'
    ELSE 'valid'
  END AS status
FROM ops.compliance_items c;
--> statement-breakpoint
GRANT SELECT ON ops.compliance_status TO mallpms_app;
