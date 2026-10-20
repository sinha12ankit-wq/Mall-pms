import type { AssetRow, Page } from '@mall-pms/shared';
import Link from 'next/link';
import { Badge, Empty, Health, Pagination, param } from '@/components/ui';
import { apiGet } from '@/lib/api';

const TRADES = [
  'HVAC',
  'Electrical',
  'Plumbing and STP',
  'Vertical transport',
  'Fire',
  'ELV and security',
];

export default async function AssetsPage({
  params,
  searchParams,
}: PageProps<'/malls/[mallId]/assets'>) {
  const { mallId } = await params;
  const sp = await searchParams;
  const filters = { q: param(sp.q), trade: param(sp.trade), criticality: param(sp.criticality) };
  const page = Number(param(sp.page) ?? 1) || 1;
  const data = await apiGet<Page<AssetRow>>(`/malls/${mallId}/assets`, {
    ...filters,
    page,
    pageSize: 25,
  });
  const base = `/malls/${mallId}/assets`;

  return (
    <div className="stack">
      <form className="filters" action={base}>
        <input name="q" placeholder="Search tag, type, make" defaultValue={filters.q} />
        <select name="trade" defaultValue={filters.trade ?? ''}>
          <option value="">Any trade</option>
          {TRADES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select name="criticality" defaultValue={filters.criticality ?? ''}>
          <option value="">Any criticality</option>
          {['critical', 'high', 'medium', 'low'].map((c) => (
            <option key={c} value={c}>
              {c[0]!.toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
        <button type="submit" className="secondary">
          Filter
        </button>
      </form>
      <p className="muted small">Sorted by health, worst first.</p>
      <section className="card flush">
        {data.items.length === 0 ? (
          <Empty>No assets match these filters.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Criticality</th>
                  <th>Health</th>
                  <th>AMC vendor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`${base}/${a.id}`}>{a.code}</Link>
                    </td>
                    <td>
                      {a.assetType}
                      <div className="muted small">
                        {[a.make, a.trade].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td>{a.location || '—'}</td>
                    <td>
                      <Badge value={a.criticality} />
                    </td>
                    <td>
                      <Health score={a.healthScore} />
                    </td>
                    <td>{a.vendorName ?? '—'}</td>
                    <td>
                      <Badge value={a.status} />
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
