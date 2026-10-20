import type { MaintenanceRow, Page } from '@mall-pms/shared';
import Link from 'next/link';
import { Badge, Empty, Pagination, param } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { formatDate, label } from '@/lib/format';

const WINDOWS = [
  { value: 'overdue', label: 'Overdue' },
  { value: '7d', label: 'Next 7 days' },
  { value: '30d', label: 'Next 30 days' },
] as const;

export default async function MaintenancePage({
  params,
  searchParams,
}: PageProps<'/malls/[mallId]/maintenance'>) {
  const { mallId } = await params;
  const sp = await searchParams;
  const window = WINDOWS.find((w) => w.value === param(sp.window))?.value ?? '7d';
  const page = Number(param(sp.page) ?? 1) || 1;
  const data = await apiGet<Page<MaintenanceRow>>(`/malls/${mallId}/maintenance`, {
    window,
    page,
    pageSize: 50,
  });
  const base = `/malls/${mallId}`;

  return (
    <div className="stack">
      <nav className="segmented" aria-label="Due window">
        {WINDOWS.map((w) => (
          <Link
            key={w.value}
            href={`${base}/maintenance?window=${w.value}`}
            className={w.value === window ? 'active' : ''}
            aria-current={w.value === window ? 'page' : undefined}
          >
            {w.label}
          </Link>
        ))}
      </nav>
      <section className="card flush">
        {data.items.length === 0 ? (
          <Empty>Nothing {window === 'overdue' ? 'overdue' : 'due in this window'}.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Due</th>
                  <th>Asset</th>
                  <th>Task</th>
                  <th>Frequency</th>
                  <th>Last done</th>
                  <th>Vendor</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td className="nowrap">{formatDate(s.nextDueOn)}</td>
                    <td>
                      <Link href={`${base}/assets/${s.assetId}`}>{s.assetCode}</Link>
                      <div className="muted small">
                        {s.assetType} <Badge value={s.criticality} />
                      </div>
                    </td>
                    <td>{s.task}</td>
                    <td>{label(s.frequency)}</td>
                    <td className="nowrap">{formatDate(s.lastDoneOn)}</td>
                    <td>{s.vendorName ?? 'In-house'}</td>
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
        basePath={`${base}/maintenance`}
        params={{ window }}
      />
    </div>
  );
}
