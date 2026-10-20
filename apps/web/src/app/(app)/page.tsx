import type { PortfolioMallSummary } from '@mall-pms/shared';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { formatNumber } from '@/lib/format';

export default async function PortfolioPage() {
  const malls = await apiGet<PortfolioMallSummary[]>('/portfolio');
  // Most on-site staff work in one mall; skip the overview for them.
  if (malls.length === 1) redirect(`/malls/${malls[0]!.id}`);
  const totals = malls.reduce(
    (t, m) => ({
      active: t.active + m.activeWorkOrders,
      breached: t.breached + m.breachedWorkOrders,
      compliance: t.compliance + m.complianceOverdue,
    }),
    { active: 0, breached: 0, compliance: 0 },
  );

  return (
    <div className="stack">
      <div>
        <h1>Portfolio</h1>
        <p className="muted">
          {malls.length} {malls.length === 1 ? 'mall' : 'malls'} · {formatNumber(totals.active)}{' '}
          open work orders · {formatNumber(totals.breached)} past SLA · {totals.compliance} licences
          overdue
        </p>
      </div>
      <div className="mall-grid">
        {malls.map((m) => (
          <Link key={m.id} href={`/malls/${m.id}`} className="card mall-card">
            <div className="row">
              <div>
                <div className="mall-code">{m.code}</div>
                <h2>{m.name}</h2>
                <div className="muted">{m.city}</div>
              </div>
              {(m.complianceOverdue > 0 || m.breachedWorkOrders > 0) && (
                <Badge value="overdue" text="Needs attention" />
              )}
            </div>
            <dl className="mall-facts">
              <div>
                <dt>Open work orders</dt>
                <dd>
                  {m.activeWorkOrders}
                  {m.breachedWorkOrders > 0 && (
                    <span className="bad-text"> ({m.breachedWorkOrders} past SLA)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>PPM overdue</dt>
                <dd>{formatNumber(m.overduePpm)}</dd>
              </div>
              <div>
                <dt>Licences</dt>
                <dd>
                  {m.complianceOverdue > 0 && (
                    <span className="bad-text">{m.complianceOverdue} overdue </span>
                  )}
                  {m.complianceDueSoon > 0 && (
                    <span className="warn-text">{m.complianceDueSoon} due soon</span>
                  )}
                  {m.complianceOverdue + m.complianceDueSoon === 0 && 'All valid'}
                </dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
    </div>
  );
}
