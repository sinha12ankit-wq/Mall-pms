import { type MallDashboard, Permission, WORK_ORDER_PRIORITIES } from '@mall-pms/shared';
import Link from 'next/link';
import { Health, StatTile } from '@/components/ui';
import { apiGet, getMe } from '@/lib/api';
import { formatDate, label } from '@/lib/format';
import { can } from '@/lib/permissions';

export default async function MallDashboardPage({ params }: PageProps<'/malls/[mallId]'>) {
  const { mallId } = await params;
  const [d, me] = await Promise.all([apiGet<MallDashboard>(`/malls/${mallId}/dashboard`), getMe()]);
  const base = `/malls/${mallId}`;
  const onTimePct = d.workOrders.closed30d
    ? Math.round((d.workOrders.closedOnTime30d / d.workOrders.closed30d) * 100)
    : null;
  const maxPriority = Math.max(1, ...Object.values(d.workOrders.byPriority));

  return (
    <div className="stack">
      <div className="stat-grid">
        <StatTile
          title="Open work orders"
          value={d.workOrders.active}
          note={
            d.workOrders.activeBreached
              ? `${d.workOrders.activeBreached} past SLA`
              : 'All within SLA'
          }
          tone={d.workOrders.activeBreached ? 'bad' : 'good'}
          href={`${base}/work-orders?status=active`}
        />
        <StatTile
          title="Closed on time (30 days)"
          value={onTimePct === null ? '—' : `${onTimePct}%`}
          note={`${d.workOrders.closedOnTime30d} of ${d.workOrders.closed30d} within SLA`}
          tone={
            onTimePct === null
              ? 'neutral'
              : onTimePct >= 90
                ? 'good'
                : onTimePct >= 75
                  ? 'warn'
                  : 'bad'
          }
        />
        <StatTile
          title="PPM overdue"
          value={d.maintenance.overdue}
          note={`${d.maintenance.dueNext7d} due in the next 7 days`}
          tone={d.maintenance.overdue ? 'warn' : 'good'}
          href={`${base}/maintenance?window=overdue`}
        />
        {can(me, Permission.ComplianceRead, mallId) && (
          <StatTile
            title="Licences"
            value={d.compliance.overdue ? `${d.compliance.overdue} overdue` : 'Up to date'}
            note={`${d.compliance.dueSoon} expiring within 60 days`}
            tone={d.compliance.overdue ? 'bad' : d.compliance.dueSoon ? 'warn' : 'good'}
            href={`${base}/compliance`}
          />
        )}
        {can(me, Permission.IncidentRead, mallId) && (
          <StatTile
            title="Incidents (30 days)"
            value={d.incidents.last30d}
            note={`${d.incidents.high30d} high severity`}
            href={`${base}/incidents`}
          />
        )}
      </div>

      <div className="two-col">
        <section className="card">
          <h2>Open work orders by priority</h2>
          <div className="bars">
            {[...WORK_ORDER_PRIORITIES].reverse().map((p) => (
              <Link
                key={p}
                href={`${base}/work-orders?status=active&priority=${p}`}
                className="bar-row"
              >
                <span className="bar-label">{label(p)}</span>
                <span className="bar-track">
                  <span
                    className={`bar-fill prio-${p}`}
                    style={{ width: `${(d.workOrders.byPriority[p] / maxPriority) * 100}%` }}
                  />
                </span>
                <span className="bar-value">{d.workOrders.byPriority[p]}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Most breakdowns (90 days)</h2>
          {d.problemAssets.length === 0 ? (
            <p className="muted">No reactive work orders in the last 90 days.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th className="num">Breakdowns</th>
                    <th>Health</th>
                  </tr>
                </thead>
                <tbody>
                  {d.problemAssets.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`${base}/assets/${a.id}`}>{a.code}</Link>
                      </td>
                      <td>{a.assetType}</td>
                      <td className="num">{a.reactive90d}</td>
                      <td>
                        <Health score={a.healthScore} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <p className="muted small">
        Rolling windows end on {formatDate(d.asOf)}, the latest activity recorded for this mall.
      </p>
    </div>
  );
}
