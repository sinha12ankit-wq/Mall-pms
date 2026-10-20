CREATE SCHEMA "ops";
--> statement-breakpoint
CREATE TYPE "space"."unit_status" AS ENUM('vacant', 'fit_out', 'occupied');--> statement-breakpoint
CREATE TYPE "space"."unit_type" AS ENUM('anchor', 'inline', 'kiosk');--> statement-breakpoint
CREATE TYPE "ops"."asset_status" AS ENUM('in_service', 'under_repair', 'decommissioned');--> statement-breakpoint
CREATE TYPE "ops"."criticality" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "ops"."maintenance_frequency" AS ENUM('weekly', 'fortnightly', 'monthly', 'quarterly', 'half_yearly', 'yearly');--> statement-breakpoint
CREATE TYPE "ops"."incident_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "ops"."incident_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "ops"."vendor_contract" AS ENUM('comprehensive_amc', 'non_comprehensive_amc', 'on_call');--> statement-breakpoint
CREATE TYPE "ops"."work_order_priority" AS ENUM('low', 'medium', 'high', 'emergency');--> statement-breakpoint
CREATE TYPE "ops"."work_order_source" AS ENUM('ppm_schedule', 'help_desk', 'tenant_app', 'patrol', 'bms_alarm');--> statement-breakpoint
CREATE TYPE "ops"."work_order_status" AS ENUM('open', 'assigned', 'in_progress', 'on_hold', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "ops"."work_order_type" AS ENUM('ppm', 'reactive', 'tenant_request');--> statement-breakpoint
CREATE TABLE "space"."levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mall_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "levels_mall_code_key" UNIQUE("mall_id","code"),
	CONSTRAINT "levels_id_mall_key" UNIQUE("id","mall_id")
);
--> statement-breakpoint
CREATE TABLE "space"."units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mall_id" uuid NOT NULL,
	"code" text NOT NULL,
	"level_id" uuid NOT NULL,
	"zone_id" uuid,
	"unit_type" "space"."unit_type" NOT NULL,
	"category" text,
	"carpet_area_sqft" numeric(10, 2) NOT NULL,
	"super_area_sqft" numeric(10, 2) NOT NULL,
	"frontage_ft" numeric(6, 1),
	"status" "space"."unit_status" DEFAULT 'vacant' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_mall_code_key" UNIQUE("mall_id","code"),
	CONSTRAINT "units_id_mall_key" UNIQUE("id","mall_id"),
	CONSTRAINT "units_area_check" CHECK ("space"."units"."carpet_area_sqft" > 0 and "space"."units"."super_area_sqft" >= "space"."units"."carpet_area_sqft")
);
--> statement-breakpoint
CREATE TABLE "space"."zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mall_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zones_mall_name_key" UNIQUE("mall_id","name"),
	CONSTRAINT "zones_id_mall_key" UNIQUE("id","mall_id")
);
--> statement-breakpoint
CREATE TABLE "ops"."assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mall_id" uuid NOT NULL,
	"code" text NOT NULL,
	"asset_type" text NOT NULL,
	"trade" text NOT NULL,
	"make" text,
	"model" text,
	"level_id" uuid,
	"zone_id" uuid,
	"unit_id" uuid,
	"location_note" text,
	"install_date" date,
	"warranty_end" date,
	"criticality" "ops"."criticality" NOT NULL,
	"amc_vendor_id" uuid,
	"health_score" smallint,
	"status" "ops"."asset_status" DEFAULT 'in_service' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_mall_code_key" UNIQUE("mall_id","code"),
	CONSTRAINT "assets_id_mall_key" UNIQUE("id","mall_id"),
	CONSTRAINT "assets_health_check" CHECK ("ops"."assets"."health_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "ops"."compliance_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mall_id" uuid NOT NULL,
	"code" text NOT NULL,
	"item" text NOT NULL,
	"authority" text NOT NULL,
	"renewal_cycle_months" smallint,
	"issued_on" date,
	"expires_on" date,
	"owner_role" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_items_mall_code_key" UNIQUE("mall_id","code"),
	CONSTRAINT "compliance_items_expiry_check" CHECK (("ops"."compliance_items"."renewal_cycle_months" is null) = ("ops"."compliance_items"."expires_on" is null))
);
--> statement-breakpoint
CREATE TABLE "ops"."incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mall_id" uuid NOT NULL,
	"code" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"severity" "ops"."incident_severity" NOT NULL,
	"level_id" uuid,
	"zone_id" uuid,
	"location_note" text,
	"description" text,
	"response_minutes" numeric(6, 1),
	"police_informed" boolean DEFAULT false NOT NULL,
	"status" "ops"."incident_status" DEFAULT 'open' NOT NULL,
	"reported_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incidents_mall_code_key" UNIQUE("mall_id","code")
);
--> statement-breakpoint
CREATE TABLE "ops"."maintenance_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mall_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"task" text NOT NULL,
	"frequency" "ops"."maintenance_frequency" NOT NULL,
	"vendor_id" uuid,
	"last_done_on" date,
	"next_due_on" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_schedules_id_mall_key" UNIQUE("id","mall_id"),
	CONSTRAINT "maintenance_schedules_asset_task_key" UNIQUE("asset_id","task")
);
--> statement-breakpoint
CREATE TABLE "ops"."vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"trade" text NOT NULL,
	"contract_type" "ops"."vendor_contract" NOT NULL,
	"sla_response_hours" smallint,
	"gstin" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_org_code_key" UNIQUE("org_id","code"),
	CONSTRAINT "vendors_id_org_key" UNIQUE("id","org_id")
);
--> statement-breakpoint
CREATE TABLE "ops"."work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mall_id" uuid NOT NULL,
	"code" text NOT NULL,
	"type" "ops"."work_order_type" NOT NULL,
	"trade" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" "ops"."work_order_priority" NOT NULL,
	"source" "ops"."work_order_source" NOT NULL,
	"status" "ops"."work_order_status" DEFAULT 'open' NOT NULL,
	"asset_id" uuid,
	"unit_id" uuid,
	"schedule_id" uuid,
	"vendor_id" uuid,
	"assignee_user_id" uuid,
	"reported_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"sla_hours" smallint NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"labour_cost_inr" numeric(12, 2),
	"material_cost_inr" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_orders_mall_code_key" UNIQUE("mall_id","code"),
	CONSTRAINT "work_orders_closed_check" CHECK (("ops"."work_orders"."status" = 'closed') = ("ops"."work_orders"."closed_at" is not null) or "ops"."work_orders"."status" = 'cancelled'),
	CONSTRAINT "work_orders_times_check" CHECK ("ops"."work_orders"."closed_at" >= "ops"."work_orders"."reported_at" and "ops"."work_orders"."responded_at" >= "ops"."work_orders"."reported_at"),
	CONSTRAINT "work_orders_sla_check" CHECK ("ops"."work_orders"."sla_hours" > 0)
);
--> statement-breakpoint
ALTER TABLE "space"."malls" ADD COLUMN "tier" text;--> statement-breakpoint
ALTER TABLE "space"."malls" ADD COLUMN "opened_year" smallint;--> statement-breakpoint
ALTER TABLE "space"."malls" ADD COLUMN "gstin" text;--> statement-breakpoint
ALTER TABLE "space"."malls" ADD COLUMN "gla_super_sqft" integer;--> statement-breakpoint
ALTER TABLE "space"."malls" ADD COLUMN "parking_bays" integer;--> statement-breakpoint
ALTER TABLE "space"."malls" ADD COLUMN "opens_at" time;--> statement-breakpoint
ALTER TABLE "space"."malls" ADD COLUMN "closes_at" time;--> statement-breakpoint
-- Must exist before the composite foreign keys that reference it.
ALTER TABLE "space"."malls" ADD CONSTRAINT "malls_id_org_key" UNIQUE("id","org_id");--> statement-breakpoint
ALTER TABLE "space"."levels" ADD CONSTRAINT "levels_mall_id_org_id_malls_id_org_id_fk" FOREIGN KEY ("mall_id","org_id") REFERENCES "space"."malls"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space"."units" ADD CONSTRAINT "units_mall_id_org_id_malls_id_org_id_fk" FOREIGN KEY ("mall_id","org_id") REFERENCES "space"."malls"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space"."units" ADD CONSTRAINT "units_level_id_mall_id_levels_id_mall_id_fk" FOREIGN KEY ("level_id","mall_id") REFERENCES "space"."levels"("id","mall_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space"."units" ADD CONSTRAINT "units_zone_id_mall_id_zones_id_mall_id_fk" FOREIGN KEY ("zone_id","mall_id") REFERENCES "space"."zones"("id","mall_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space"."zones" ADD CONSTRAINT "zones_mall_id_org_id_malls_id_org_id_fk" FOREIGN KEY ("mall_id","org_id") REFERENCES "space"."malls"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."assets" ADD CONSTRAINT "assets_mall_id_org_id_malls_id_org_id_fk" FOREIGN KEY ("mall_id","org_id") REFERENCES "space"."malls"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."assets" ADD CONSTRAINT "assets_level_id_mall_id_levels_id_mall_id_fk" FOREIGN KEY ("level_id","mall_id") REFERENCES "space"."levels"("id","mall_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."assets" ADD CONSTRAINT "assets_zone_id_mall_id_zones_id_mall_id_fk" FOREIGN KEY ("zone_id","mall_id") REFERENCES "space"."zones"("id","mall_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."assets" ADD CONSTRAINT "assets_unit_id_mall_id_units_id_mall_id_fk" FOREIGN KEY ("unit_id","mall_id") REFERENCES "space"."units"("id","mall_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."assets" ADD CONSTRAINT "assets_amc_vendor_id_org_id_vendors_id_org_id_fk" FOREIGN KEY ("amc_vendor_id","org_id") REFERENCES "ops"."vendors"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."compliance_items" ADD CONSTRAINT "compliance_items_mall_id_org_id_malls_id_org_id_fk" FOREIGN KEY ("mall_id","org_id") REFERENCES "space"."malls"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."incidents" ADD CONSTRAINT "incidents_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."incidents" ADD CONSTRAINT "incidents_mall_id_org_id_malls_id_org_id_fk" FOREIGN KEY ("mall_id","org_id") REFERENCES "space"."malls"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."incidents" ADD CONSTRAINT "incidents_level_id_mall_id_levels_id_mall_id_fk" FOREIGN KEY ("level_id","mall_id") REFERENCES "space"."levels"("id","mall_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."incidents" ADD CONSTRAINT "incidents_zone_id_mall_id_zones_id_mall_id_fk" FOREIGN KEY ("zone_id","mall_id") REFERENCES "space"."zones"("id","mall_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_mall_id_org_id_malls_id_org_id_fk" FOREIGN KEY ("mall_id","org_id") REFERENCES "space"."malls"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_asset_id_mall_id_assets_id_mall_id_fk" FOREIGN KEY ("asset_id","mall_id") REFERENCES "ops"."assets"("id","mall_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_vendor_id_org_id_vendors_id_org_id_fk" FOREIGN KEY ("vendor_id","org_id") REFERENCES "ops"."vendors"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."vendors" ADD CONSTRAINT "vendors_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "core"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."work_orders" ADD CONSTRAINT "work_orders_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."work_orders" ADD CONSTRAINT "work_orders_mall_id_org_id_malls_id_org_id_fk" FOREIGN KEY ("mall_id","org_id") REFERENCES "space"."malls"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."work_orders" ADD CONSTRAINT "work_orders_asset_id_mall_id_assets_id_mall_id_fk" FOREIGN KEY ("asset_id","mall_id") REFERENCES "ops"."assets"("id","mall_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."work_orders" ADD CONSTRAINT "work_orders_unit_id_mall_id_units_id_mall_id_fk" FOREIGN KEY ("unit_id","mall_id") REFERENCES "space"."units"("id","mall_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."work_orders" ADD CONSTRAINT "work_orders_schedule_id_mall_id_maintenance_schedules_id_mall_id_fk" FOREIGN KEY ("schedule_id","mall_id") REFERENCES "ops"."maintenance_schedules"("id","mall_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."work_orders" ADD CONSTRAINT "work_orders_vendor_id_org_id_vendors_id_org_id_fk" FOREIGN KEY ("vendor_id","org_id") REFERENCES "ops"."vendors"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_mall_type_idx" ON "ops"."assets" USING btree ("mall_id","asset_type");--> statement-breakpoint
CREATE INDEX "compliance_items_expiry_idx" ON "ops"."compliance_items" USING btree ("mall_id","expires_on");--> statement-breakpoint
CREATE INDEX "incidents_mall_occurred_idx" ON "ops"."incidents" USING btree ("mall_id","occurred_at");--> statement-breakpoint
CREATE INDEX "maintenance_schedules_due_idx" ON "ops"."maintenance_schedules" USING btree ("mall_id","next_due_on") WHERE "ops"."maintenance_schedules"."is_active";--> statement-breakpoint
CREATE INDEX "work_orders_mall_status_idx" ON "ops"."work_orders" USING btree ("mall_id","status");--> statement-breakpoint
CREATE INDEX "work_orders_mall_reported_idx" ON "ops"."work_orders" USING btree ("mall_id","reported_at");--> statement-breakpoint
CREATE INDEX "work_orders_asset_idx" ON "ops"."work_orders" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "work_orders_assignee_idx" ON "ops"."work_orders" USING btree ("assignee_user_id") WHERE "ops"."work_orders"."assignee_user_id" is not null;--> statement-breakpoint
ALTER TABLE "space"."malls" ADD CONSTRAINT "malls_tier_check" CHECK ("space"."malls"."tier" in ('metro', 'tier2', 'tier3'));--> statement-breakpoint
ALTER TABLE "space"."malls" ADD CONSTRAINT "malls_gstin_check" CHECK ("space"."malls"."gstin" ~ '^[0-9]{2}[0-9A-Z]{13}$');