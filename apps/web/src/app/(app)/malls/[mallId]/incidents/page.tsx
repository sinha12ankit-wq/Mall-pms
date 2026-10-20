import type { IncidentRow, Page } from '@mall-pms/shared';
import { Badge, Empty, Pagination, param } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export default async function IncidentsPage({
  params,
  searchParams,
}: PageProps<'/malls/[mallId]/incidents'>) {
  const { mallId } = await params;
  const sp = await searchParams;
  const filters = { q: param(sp.q), severity: param(sp.severity) };
  const page = Number(param(sp.page) ?? 1) || 1;
  const data = await apiGet<Page<IncidentRow>>(`/malls/${mallId}/incidents`, {
    ...filters,
    page,
    pageSize: 25,
  });
  const base = `/malls/${mallId}/incidents`;

  return (
    <div className="stack">
      <form className="filters" action={base}>
        <input name="q" placeholder="Search number or type" defaultValue={filters.q} />
        <select name="severity" defaultValue={filters.severity ?? ''}>
          <option value="">Any severity</option>
          {['critical', 'high', 'medium', 'low'].map((s) => (
            <option key={s} value={s}>
              {s[0]!.toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <button type="submit" className="secondary">
          Filter
        </button>
      </form>
      <section className="card flush">
        {data.items.length === 0 ? (
          <Empty>No incidents match these filters.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>When</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Severity</th>
                  <th className="num">Response</th>
                  <th>Police</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.code}</td>
                    <td className="nowrap">{formatDateTime(i.occurredAt)}</td>
                    <td>{i.type}</td>
                    <td>{i.location || '—'}</td>
                    <td>
                      <Badge value={i.severity} />
                    </td>
                    <td className="num">{i.responseMinutes ? `${i.responseMinutes} min` : '—'}</td>
                    <td>{i.policeInformed ? 'Informed' : '—'}</td>
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
