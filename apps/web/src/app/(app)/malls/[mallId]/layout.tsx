import Link from 'next/link';
import { Permission } from '@mall-pms/shared';
import { apiGet, getMe } from '@/lib/api';
import { can } from '@/lib/permissions';
import { MallTabs, type Tab } from './tabs';

const TABS: (Tab & { permission: Permission })[] = [
  { href: '', label: 'Overview', permission: Permission.MallRead },
  { href: '/work-orders', label: 'Work orders', permission: Permission.WorkOrderRead },
  { href: '/assets', label: 'Assets', permission: Permission.AssetRead },
  { href: '/maintenance', label: 'Maintenance', permission: Permission.AssetRead },
  { href: '/compliance', label: 'Compliance', permission: Permission.ComplianceRead },
  { href: '/incidents', label: 'Incidents', permission: Permission.IncidentRead },
];

interface Mall {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
}

export default async function MallLayout({ children, params }: LayoutProps<'/malls/[mallId]'>) {
  const { mallId } = await params;
  const [mall, malls, me] = await Promise.all([
    apiGet<Mall>(`/malls/${mallId}`),
    apiGet<Mall[]>('/malls'),
    getMe(),
  ]);
  const tabs = TABS.filter((t) => can(me, t.permission, mallId)).map(({ href, label }) => ({
    href,
    label,
  }));
  return (
    <div className="stack">
      <div className="mall-header">
        <div>
          {malls.length > 1 && (
            <Link href="/" className="muted small-link">
              ← All malls
            </Link>
          )}
          <h1>
            {mall.name} <span className="muted">· {mall.code}</span>
          </h1>
          <p className="muted">
            {mall.city}, {mall.state}
          </p>
        </div>
      </div>
      <MallTabs base={`/malls/${mallId}`} tabs={tabs} />
      {children}
    </div>
  );
}
