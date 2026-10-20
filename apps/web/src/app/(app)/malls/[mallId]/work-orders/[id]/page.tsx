import { Permission, type WorkOrderDetail } from '@mall-pms/shared';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { apiGet, getMe } from '@/lib/api';
import { duration, formatDateTime, formatInr, label } from '@/lib/format';
import { can } from '@/lib/permissions';
import { StatusActions } from './status-actions';

export default async function WorkOrderPage({
  params,
}: PageProps<'/malls/[mallId]/work-orders/[id]'>) {
  const { mallId, id } = await params;
  const [w, me] = await Promise.all([
    apiGet<WorkOrderDetail>(`/malls/${mallId}/work-orders/${id}`),
    getMe(),
  ]);
  const base = `/malls/${mallId}`;
  const cost =
    w.labourCostInr || w.materialCostInr
      ? Number(w.labourCostInr ?? 0) + Number(w.materialCostInr ?? 0)
      : null;

  return (
    <div className="stack">
      <Link href={`${base}/work-orders`} className="muted small-link">
        ← Work orders
      </Link>
      <section className="card">
        <div className="row">
          <div>
            <div className="muted">{w.code}</div>
            <h2>{w.title}</h2>
          </div>
          <div className="badges">
            <Badge value={w.priority} />
            <Badge value={w.status} />
          </div>
        </div>
        {w.description && <p>{w.description}</p>}
        <dl className="facts">
          <div>
            <dt>Type</dt>
            <dd>
              {w.type === 'ppm' ? 'PPM' : label(w.type)} · {w.trade}
            </dd>
          </div>
          <div>
            <dt>Reported via</dt>
            <dd>{label(w.source)}</dd>
          </div>
          <div>
            <dt>Asset</dt>
            <dd>
              {w.asset ? (
                <Link href={`${base}/assets/${w.asset.id}`}>
                  {w.asset.code} ({w.asset.assetType})
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Unit</dt>
            <dd>{w.unitCode ?? '—'}</dd>
          </div>
          <div>
            <dt>Vendor</dt>
            <dd>{w.vendorName ?? 'In-house'}</dd>
          </div>
          <div>
            <dt>Reported</dt>
            <dd>{formatDateTime(w.reportedAt)}</dd>
          </div>
          <div>
            <dt>Responded</dt>
            <dd>
              {formatDateTime(w.respondedAt)}
              {w.respondedAt && (
                <span className="muted"> ({duration(w.reportedAt, w.respondedAt)})</span>
              )}
            </dd>
          </div>
          <div>
            <dt>SLA</dt>
            <dd>
              {w.slaHours}h · due {formatDateTime(w.dueAt)}{' '}
              {w.breached ? (
                <span className="bad-text">(missed)</span>
              ) : (
                w.closedAt && <span className="good-text">(met)</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Closed</dt>
            <dd>
              {formatDateTime(w.closedAt)}
              {w.closedAt && <span className="muted"> ({duration(w.reportedAt, w.closedAt)})</span>}
            </dd>
          </div>
          <div>
            <dt>Cost</dt>
            <dd>
              {cost === null
                ? '—'
                : `${formatInr(cost)} (labour ${formatInr(w.labourCostInr)}, material ${formatInr(w.materialCostInr)})`}
            </dd>
          </div>
        </dl>
      </section>
      {w.allowedTransitions.length > 0 && can(me, Permission.WorkOrderUpdate, mallId) && (
        <StatusActions mallId={mallId} id={w.id} transitions={w.allowedTransitions} />
      )}
    </div>
  );
}
