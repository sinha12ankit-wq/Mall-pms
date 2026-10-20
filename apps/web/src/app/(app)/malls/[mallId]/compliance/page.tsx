import type { ComplianceRow } from '@mall-pms/shared';
import { Badge, Empty } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';

const cycle = (months: number | null) =>
  months === null ? 'Permanent' : months % 12 === 0 ? `${months / 12} yr` : `${months} mo`;

export default async function CompliancePage({ params }: PageProps<'/malls/[mallId]/compliance'>) {
  const { mallId } = await params;
  const items = await apiGet<ComplianceRow[]>(`/malls/${mallId}/compliance`);

  return (
    <section className="card flush">
      {items.length === 0 ? (
        <Empty>No compliance items recorded.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Licence or test</th>
                <th>Authority</th>
                <th>Renewal</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>{c.item}</td>
                  <td>{c.authority}</td>
                  <td>{cycle(c.renewalCycleMonths)}</td>
                  <td className="nowrap">
                    {formatDate(c.expiresOn)}
                    {c.daysToExpiry !== null && (
                      <div className={c.daysToExpiry < 0 ? 'bad-text small' : 'muted small'}>
                        {c.daysToExpiry < 0
                          ? `${-c.daysToExpiry} days ago`
                          : `in ${c.daysToExpiry} days`}
                      </div>
                    )}
                  </td>
                  <td>
                    <Badge
                      value={c.status}
                      text={c.status === 'due_soon' ? 'Due within 60 days' : undefined}
                    />
                  </td>
                  <td>{c.ownerRole ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
