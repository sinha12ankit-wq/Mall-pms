import Link from 'next/link';
import type { ReactNode } from 'react';
import { getMe } from '@/lib/api';
import { label } from '@/lib/format';
import { logout } from '../actions';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  const roleText = me.roles
    .map((r) => `${label(r.role)} · ${r.mallCode ?? 'All malls'}`)
    .join(', ');
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">
          Mall PMS
        </Link>
        <div className="topbar-user">
          <span className="topbar-name">
            {me.fullName}
            <span className="muted"> · {roleText}</span>
          </span>
          <form action={logout}>
            <button type="submit" className="secondary small">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
