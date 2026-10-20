import { z } from 'zod';

/** API contracts for the Operations module, shared by the API and the web app. */

export const WORK_ORDER_STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'on_hold',
  'closed',
  'cancelled',
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const WORK_ORDER_PRIORITIES = ['low', 'medium', 'high', 'emergency'] as const;
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];

export const WORK_ORDER_TYPES = ['ppm', 'reactive', 'tenant_request'] as const;
export type WorkOrderType = (typeof WORK_ORDER_TYPES)[number];

export const WORK_ORDER_SOURCES = [
  'ppm_schedule',
  'help_desk',
  'tenant_app',
  'patrol',
  'bms_alarm',
] as const;

/** Resolution SLA by priority, in hours. Matches the sample data. */
export const SLA_HOURS: Record<WorkOrderPriority, number> = {
  emergency: 2,
  high: 8,
  medium: 24,
  low: 72,
};

/** Statuses a work order may move to from each status. */
export const WORK_ORDER_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  open: ['in_progress', 'on_hold', 'closed', 'cancelled'],
  assigned: ['in_progress', 'on_hold', 'closed', 'cancelled'],
  in_progress: ['on_hold', 'closed'],
  on_hold: ['in_progress', 'closed', 'cancelled'],
  closed: [],
  cancelled: [],
};

export const OPEN_STATUSES: readonly WorkOrderStatus[] = [
  'open',
  'assigned',
  'in_progress',
  'on_hold',
];

const page = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};
const search = z.string().trim().max(100).optional();

export const workOrderListQuerySchema = z.object({
  ...page,
  /** 'active' means any open status. */
  status: z.enum([...WORK_ORDER_STATUSES, 'active']).optional(),
  priority: z.enum(WORK_ORDER_PRIORITIES).optional(),
  type: z.enum(WORK_ORDER_TYPES).optional(),
  breached: z.enum(['true', 'false']).optional(),
  q: search,
});
export type WorkOrderListQuery = z.infer<typeof workOrderListQuerySchema>;

export const createWorkOrderSchema = z
  .object({
    type: z.enum(['reactive', 'tenant_request']),
    trade: z.string().trim().min(1).max(60),
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional(),
    priority: z.enum(WORK_ORDER_PRIORITIES),
    source: z.enum(['help_desk', 'tenant_app', 'patrol', 'bms_alarm']),
    assetCode: z.string().trim().max(40).optional(),
    unitCode: z.string().trim().max(40).optional(),
  })
  .refine((v) => v.type !== 'tenant_request' || !!v.unitCode, {
    message: 'A tenant request needs a unit',
    path: ['unitCode'],
  });
export type CreateWorkOrder = z.infer<typeof createWorkOrderSchema>;

export const updateWorkOrderStatusSchema = z.object({
  status: z.enum(WORK_ORDER_STATUSES),
  labourCostInr: z.coerce.number().min(0).max(10_000_000).optional(),
  materialCostInr: z.coerce.number().min(0).max(10_000_000).optional(),
});
export type UpdateWorkOrderStatus = z.infer<typeof updateWorkOrderStatusSchema>;

export const assetListQuerySchema = z.object({
  ...page,
  trade: z.string().max(60).optional(),
  criticality: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  q: search,
});
export type AssetListQuery = z.infer<typeof assetListQuerySchema>;

export const maintenanceQuerySchema = z.object({
  ...page,
  window: z.enum(['overdue', '7d', '30d']).default('7d'),
});
export type MaintenanceQuery = z.infer<typeof maintenanceQuerySchema>;

export const incidentListQuerySchema = z.object({
  ...page,
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  q: search,
});
export type IncidentListQuery = z.infer<typeof incidentListQuerySchema>;

// --- Responses ------------------------------------------------------------

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkOrderRow {
  id: string;
  code: string;
  type: WorkOrderType;
  trade: string;
  title: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  reportedAt: string;
  dueAt: string;
  closedAt: string | null;
  breached: boolean;
  assetCode: string | null;
  unitCode: string | null;
  vendorName: string | null;
}

export interface WorkOrderDetail extends WorkOrderRow {
  description: string | null;
  source: string;
  respondedAt: string | null;
  slaHours: number;
  labourCostInr: string | null;
  materialCostInr: string | null;
  asset: { id: string; code: string; assetType: string } | null;
  allowedTransitions: WorkOrderStatus[];
}

export interface AssetRow {
  id: string;
  code: string;
  assetType: string;
  trade: string;
  make: string | null;
  location: string;
  criticality: string;
  healthScore: number | null;
  status: string;
  vendorName: string | null;
}

export interface AssetDetail extends AssetRow {
  model: string | null;
  installDate: string | null;
  warrantyEnd: string | null;
  schedules: {
    id: string;
    task: string;
    frequency: string;
    lastDoneOn: string | null;
    nextDueOn: string;
  }[];
  stats: { workOrders12m: number; reactive12m: number; costInr12m: string };
  recentWorkOrders: WorkOrderRow[];
}

export interface MaintenanceRow {
  id: string;
  assetId: string;
  assetCode: string;
  assetType: string;
  task: string;
  frequency: string;
  lastDoneOn: string | null;
  nextDueOn: string;
  vendorName: string | null;
  criticality: string;
}

export interface ComplianceRow {
  id: string;
  code: string;
  item: string;
  authority: string;
  renewalCycleMonths: number | null;
  issuedOn: string | null;
  expiresOn: string | null;
  ownerRole: string | null;
  daysToExpiry: number | null;
  status: 'overdue' | 'due_soon' | 'valid' | 'permanent';
}

export interface IncidentRow {
  id: string;
  code: string;
  occurredAt: string;
  type: string;
  severity: string;
  location: string;
  responseMinutes: string | null;
  policeInformed: boolean;
  status: string;
}

export interface MallDashboard {
  mall: { id: string; code: string; name: string; city: string };
  workOrders: {
    active: number;
    activeBreached: number;
    byPriority: Record<WorkOrderPriority, number>;
    /** Closed in the last 30 days of activity, and how many met their SLA. */
    closed30d: number;
    closedOnTime30d: number;
  };
  maintenance: { overdue: number; dueNext7d: number };
  compliance: { overdue: number; dueSoon: number };
  incidents: { last30d: number; high30d: number };
  /** Assets with the most reactive work orders in the last 90 days. */
  problemAssets: {
    id: string;
    code: string;
    assetType: string;
    reactive90d: number;
    healthScore: number | null;
  }[];
  /** Latest activity date in the data, which anchors the rolling windows. */
  asOf: string;
}

export interface PortfolioMallSummary {
  id: string;
  code: string;
  name: string;
  city: string;
  activeWorkOrders: number;
  breachedWorkOrders: number;
  overduePpm: number;
  complianceOverdue: number;
  complianceDueSoon: number;
}
