import {
  type Page,
  Permission,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
  type WorkOrderRow,
} from '@mall-pms/shared';
import Link from 'next/link';
import { Badge, Empty, Pagination, param } from '@/components/ui';
import { apiGet, getMe } from '@/lib/api';
import { duration, formatDateTime, label } from '@/lib/format';
import { can } from '@/lib/permissions';

export default async function WorkOrdersPage({
  params,
  searchParams,
}: PageProps<'/malls/[mallId]/work-orders'>) {
  const { mallId } = await params;
  const sp = await searchParams;
  const filters = {
    status: param(sp.status),
    priority: param(sp.priority),
    type: param(sp.type),
    breached: param(sp.breached),
    q: param(sp.q),
  };
  const page = Number(param(sp.page) ?? 1) || 1;
  const [data, me] = await Promise.all([
    apiGet<Page<WorkOrderRow>>(`/malls/${mallId}/work-orders`, { ...filters, page, pageSize: 25 }),
    getMe(),
  ]);
  const base = `/malls/${mallId}/work-orders`;

  return (
    <div className="stack">
      <div className="row">
        <form className="filters" action={base}>
          <input
            name="q"
            placeholder="Search number, title, asset, unit"
            defaultValue={filters.q}
          />
          <select name="status" defaultValue={filters.status ?? ''}>
            <option value="">Any status</option>
            <option value="active">Open (any)</option>
            {WORK_ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <select name="priority" defaultValue={filters.priority ?? ''}>
            <option value="">Any priority</option>
            {WORK_ORDER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {label(p)}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={filters.type ?? ''}>
            <option value="">Any type</option>
            {WORK_ORDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'ppm' ? 'PPM' : label(t)}
              </option>
            ))}
          </select>
          <select name="breached" defaultValue={filters.breached ?? ''}>
            <option value="">SLA: any</option>
            <option value="true">Past SLA</option>
            <option value="false">Within SLA</option>
          </select>
          <button type="submit" className="secondary">
            Filter
          </button>
        </form>
        {can(me, Permission.WorkOrderCreate, mallId) && (
          <Link href={`${base}/new`} className="button">
            New work order
          </Link>
        )}
      </div>

      <section className="card flush">
        {data.items.length === 0 ? (
          <Empty>No work orders match these filters.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Title</th>
                  <th>Where</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Reported</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <Link href={`${base}/${w.id}`}>{w.code}</Link>
                    </td>
                    <td>
                      {w.title}
                      <div className="muted small">
                        {w.type === 'ppm' ? 'PPM' : label(w.type)} · {w.trade}
                      </div>
                    </td>
                    <td>{w.assetCode ?? w.unitCode ?? '—'}</td>
                    <td>
                      <Badge value={w.priority} />
                    </td>
                    <td>
                      <Badge value={w.status} />
                    </td>
                    <td className="nowrap">{formatDateTime(w.reportedAt)}</td>
                    <td className="nowrap">
                      <SlaCell row={w} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        basePath={base}
        params={filters}
      />
    </div>
  );
}

function SlaCell({ row }: { row: WorkOrderRow }) {
  if (row.status === 'cancelled') return <span className="muted">—</span>;
  if (row.closedAt) {
    return row.breached ? (
      <span className="bad-text">Late by {duration(row.dueAt, row.closedAt)}</span>
    ) : (
      <span className="good-text">Met</span>
    );
  }
  return row.breached ? (
    <span className="bad-text">Overdue {duration(row.dueAt)}</span>
  ) : (
    <span className="warn-text">{duration(new Date().toISOString(), row.dueAt)} left</span>
  );
}
