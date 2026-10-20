import type { AssetDetail } from '@mall-pms/shared';
import Link from 'next/link';
import { Badge, Empty, Health, StatTile } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { formatDate, formatDateTime, formatInr, label } from '@/lib/format';

export default async function AssetPage({ params }: PageProps<'/malls/[mallId]/assets/[id]'>) {
  const { mallId, id } = await params;
  const a = await apiGet<AssetDetail>(`/malls/${mallId}/assets/${id}`);
  const base = `/malls/${mallId}`;

  return (
    <div className="stack">
      <Link href={`${base}/assets`} className="muted small-link">
        ← Assets
      </Link>
      <section className="card">
        <div className="row">
          <div>
            <div className="muted">{a.code}</div>
            <h2>{a.assetType}</h2>
          </div>
          <div className="badges">
            <Badge value={a.criticality} />
            <Badge value={a.status} />
          </div>
        </div>
        <dl className="facts">
          <div>
            <dt>Make and model</dt>
            <dd>{[a.make, a.model].filter(Boolean).join(' ') || '—'}</dd>
          </div>
          <div>
            <dt>Trade</dt>
            <dd>{a.trade}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{a.location || '—'}</dd>
          </div>
          <div>
            <dt>Installed</dt>
            <dd>{formatDate(a.installDate)}</dd>
          </div>
          <div>
            <dt>Warranty until</dt>
            <dd>{formatDate(a.warrantyEnd)}</dd>
          </div>
          <div>
            <dt>AMC vendor</dt>
            <dd>{a.vendorName ?? '—'}</dd>
          </div>
          <div>
            <dt>Health</dt>
            <dd>
              <Health score={a.healthScore} />
            </dd>
          </div>
        </dl>
      </section>

      <div className="stat-grid">
        <StatTile title="Work orders (12 months)" value={a.stats.workOrders12m} />
        <StatTile
          title="Breakdowns (12 months)"
          value={a.stats.reactive12m}
          tone={a.stats.reactive12m >= 6 ? 'bad' : a.stats.reactive12m >= 3 ? 'warn' : 'neutral'}
        />
        <StatTile title="Maintenance cost (12 months)" value={formatInr(a.stats.costInr12m)} />
      </div>

      <section className="card">
        <h2>Planned maintenance</h2>
        {a.schedules.length === 0 ? (
          <Empty>No PPM schedule.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Frequency</th>
                <th>Last done</th>
                <th>Next due</th>
              </tr>
            </thead>
            <tbody>
              {a.schedules.map((s) => (
                <tr key={s.id}>
                  <td>{s.task}</td>
                  <td>{label(s.frequency)}</td>
                  <td>{formatDate(s.lastDoneOn)}</td>
                  <td>{formatDate(s.nextDueOn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card flush">
        <h2 className="pad">Recent work orders</h2>
        {a.recentWorkOrders.length === 0 ? (
          <Empty>No work orders on this asset.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Reported</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {a.recentWorkOrders.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <Link href={`${base}/work-orders/${w.id}`}>{w.code}</Link>
                    </td>
                    <td>{w.title}</td>
                    <td>
                      <Badge value={w.status} />
                    </td>
                    <td className="nowrap">{formatDateTime(w.reportedAt)}</td>
                    <td>
                      {w.breached ? (
                        <span className="bad-text">Missed</span>
                      ) : (
                        <span className="good-text">Met</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
