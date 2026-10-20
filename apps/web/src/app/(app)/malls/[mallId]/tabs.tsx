'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface Tab {
  href: string;
  label: string;
}

export function MallTabs({ base, tabs }: { base: string; tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <nav className="tabs" aria-label="Mall sections">
      {tabs.map((t) => {
        const href = `${base}${t.href}`;
        const active = t.href === '' ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={t.href}
            href={href}
            className={active ? 'tab active' : 'tab'}
            aria-current={active ? 'page' : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
