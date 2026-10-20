import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgSchema,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './core';
import { levels, mallFk, mallScoped, units, zones } from './space';

/**
 * Operations: vendors, assets, planned maintenance, work orders, statutory
 * compliance and security incidents.
 */
export const ops = pgSchema('ops');

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

export const vendorContractEnum = ops.enum('vendor_contract', [
  'comprehensive_amc',
  'non_comprehensive_amc',
  'on_call',
]);
export const criticalityEnum = ops.enum('criticality', ['critical', 'high', 'medium', 'low']);
export const assetStatusEnum = ops.enum('asset_status', [
  'in_service',
  'under_repair',
  'decommissioned',
]);
export const frequencyEnum = ops.enum('maintenance_frequency', [
  'weekly',
  'fortnightly',
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
]);
export const workOrderTypeEnum = ops.enum('work_order_type', ['ppm', 'reactive', 'tenant_request']);
export const workOrderPriorityEnum = ops.enum('work_order_priority', [
  'low',
  'medium',
  'high',
  'emergency',
]);
export const workOrderSourceEnum = ops.enum('work_order_source', [
  'ppm_schedule',
  'help_desk',
  'tenant_app',
  'patrol',
  'bms_alarm',
]);
export const workOrderStatusEnum = ops.enum('work_order_status', [
  'open',
  'assigned',
  'in_progress',
  'on_hold',
  'closed',
  'cancelled',
]);
export const severityEnum = ops.enum('incident_severity', ['low', 'medium', 'high', 'critical']);
export const incidentStatusEnum = ops.enum('incident_status', ['open', 'closed']);

/** Service contractors. Shared across the organisation's malls. */
export const vendors = ops.table(
  'vendors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** Trade the vendor services, e.g. HVAC, Vertical transport. */
    trade: text('trade').notNull(),
    contractType: vendorContractEnum('contract_type').notNull(),
    slaResponseHours: smallint('sla_response_hours'),
    gstin: text('gstin'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    unique('vendors_org_code_key').on(t.orgId, t.code),
    unique('vendors_id_org_key').on(t.id, t.orgId),
  ],
);

export const assets = ops.table(
  'assets',
  {
    ...mallScoped(),
    /** Asset tag, e.g. M01-CHI-001. */
    code: text('code').notNull(),
    assetType: text('asset_type').notNull(),
    trade: text('trade').notNull(),
    make: text('make'),
    model: text('model'),
    levelId: uuid('level_id'),
    zoneId: uuid('zone_id'),
    unitId: uuid('unit_id'),
    /** Free-text location for places outside the level/zone grid, e.g. Terrace. */
    locationNote: text('location_note'),
    installDate: date('install_date'),
    warrantyEnd: date('warranty_end'),
    criticality: criticalityEnum('criticality').notNull(),
    amcVendorId: uuid('amc_vendor_id'),
    /** 0 to 100, from condition surveys and breakdown history. */
    healthScore: smallint('health_score'),
    status: assetStatusEnum('status').notNull().default('in_service'),
    ...timestamps,
  },
  (t) => [
    mallFk(t),
    foreignKey({ columns: [t.levelId, t.mallId], foreignColumns: [levels.id, levels.mallId] }),
    foreignKey({ columns: [t.zoneId, t.mallId], foreignColumns: [zones.id, zones.mallId] }),
    foreignKey({ columns: [t.unitId, t.mallId], foreignColumns: [units.id, units.mallId] }),
    foreignKey({ columns: [t.amcVendorId, t.orgId], foreignColumns: [vendors.id, vendors.orgId] }),
    unique('assets_mall_code_key').on(t.mallId, t.code),
    unique('assets_id_mall_key').on(t.id, t.mallId),
    index('assets_mall_type_idx').on(t.mallId, t.assetType),
    check('assets_health_check', sql`${t.healthScore} between 0 and 100`),
  ],
);

/** A recurring planned preventive maintenance (PPM) task on an asset. */
export const maintenanceSchedules = ops.table(
  'maintenance_schedules',
  {
    ...mallScoped(),
    assetId: uuid('asset_id').notNull(),
    task: text('task').notNull(),
    frequency: frequencyEnum('frequency').notNull(),
    vendorId: uuid('vendor_id'),
    lastDoneOn: date('last_done_on'),
    nextDueOn: date('next_due_on').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    mallFk(t),
    foreignKey({
      columns: [t.assetId, t.mallId],
      foreignColumns: [assets.id, assets.mallId],
    }).onDelete('cascade'),
    foreignKey({ columns: [t.vendorId, t.orgId], foreignColumns: [vendors.id, vendors.orgId] }),
    unique('maintenance_schedules_id_mall_key').on(t.id, t.mallId),
    unique('maintenance_schedules_asset_task_key').on(t.assetId, t.task),
    index('maintenance_schedules_due_idx')
      .on(t.mallId, t.nextDueOn)
      .where(sql`${t.isActive}`),
  ],
);

export const workOrders = ops.table(
  'work_orders',
  {
    ...mallScoped(),
    /** Ticket number, e.g. WO0021181. */
    code: text('code').notNull(),
    type: workOrderTypeEnum('type').notNull(),
    trade: text('trade').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    priority: workOrderPriorityEnum('priority').notNull(),
    source: workOrderSourceEnum('source').notNull(),
    status: workOrderStatusEnum('status').notNull().default('open'),
    assetId: uuid('asset_id'),
    unitId: uuid('unit_id'),
    scheduleId: uuid('schedule_id'),
    vendorId: uuid('vendor_id'),
    assigneeUserId: uuid('assignee_user_id').references(() => users.id),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /** Resolution SLA in hours, set from the priority when the ticket is raised. */
    slaHours: smallint('sla_hours').notNull(),
    /** reported_at + sla_hours. A ticket is in breach when it closes, or is still open, after this. */
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    labourCostInr: money('labour_cost_inr'),
    materialCostInr: money('material_cost_inr'),
    ...timestamps,
  },
  (t) => [
    mallFk(t),
    foreignKey({ columns: [t.assetId, t.mallId], foreignColumns: [assets.id, assets.mallId] }),
    foreignKey({ columns: [t.unitId, t.mallId], foreignColumns: [units.id, units.mallId] }),
    foreignKey({
      columns: [t.scheduleId, t.mallId],
      foreignColumns: [maintenanceSchedules.id, maintenanceSchedules.mallId],
    }),
    foreignKey({ columns: [t.vendorId, t.orgId], foreignColumns: [vendors.id, vendors.orgId] }),
    unique('work_orders_mall_code_key').on(t.mallId, t.code),
    index('work_orders_mall_status_idx').on(t.mallId, t.status),
    index('work_orders_mall_reported_idx').on(t.mallId, t.reportedAt),
    index('work_orders_asset_idx').on(t.assetId),
    index('work_orders_assignee_idx')
      .on(t.assigneeUserId)
      .where(sql`${t.assigneeUserId} is not null`),
    check(
      'work_orders_closed_check',
      sql`(${t.status} = 'closed') = (${t.closedAt} is not null) or ${t.status} = 'cancelled'`,
    ),
    check(
      'work_orders_times_check',
      sql`${t.closedAt} >= ${t.reportedAt} and ${t.respondedAt} >= ${t.reportedAt}`,
    ),
    check('work_orders_sla_check', sql`${t.slaHours} > 0`),
  ],
);

/** Statutory licences, certificates and periodic tests a mall must keep current. */
export const complianceItems = ops.table(
  'compliance_items',
  {
    ...mallScoped(),
    code: text('code').notNull(),
    item: text('item').notNull(),
    authority: text('authority').notNull(),
    /** Null for permanent certificates, e.g. the occupancy certificate. */
    renewalCycleMonths: smallint('renewal_cycle_months'),
    issuedOn: date('issued_on'),
    expiresOn: date('expires_on'),
    ownerRole: text('owner_role'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [
    mallFk(t),
    unique('compliance_items_mall_code_key').on(t.mallId, t.code),
    index('compliance_items_expiry_idx').on(t.mallId, t.expiresOn),
    check(
      'compliance_items_expiry_check',
      sql`(${t.renewalCycleMonths} is null) = (${t.expiresOn} is null)`,
    ),
  ],
);

export const incidents = ops.table(
  'incidents',
  {
    ...mallScoped(),
    code: text('code').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    /** Incident category, e.g. Medical emergency, Theft / shoplifting. */
    type: text('type').notNull(),
    severity: severityEnum('severity').notNull(),
    levelId: uuid('level_id'),
    zoneId: uuid('zone_id'),
    locationNote: text('location_note'),
    description: text('description'),
    responseMinutes: numeric('response_minutes', { precision: 6, scale: 1 }),
    policeInformed: boolean('police_informed').notNull().default(false),
    status: incidentStatusEnum('status').notNull().default('open'),
    reportedByUserId: uuid('reported_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    mallFk(t),
    foreignKey({ columns: [t.levelId, t.mallId], foreignColumns: [levels.id, levels.mallId] }),
    foreignKey({ columns: [t.zoneId, t.mallId], foreignColumns: [zones.id, zones.mallId] }),
    unique('incidents_mall_code_key').on(t.mallId, t.code),
    index('incidents_mall_occurred_idx').on(t.mallId, t.occurredAt),
  ],
);
