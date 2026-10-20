import Link from 'next/link';
import type { ReactNode } from 'react';
import { label } from '@/lib/format';

export function StatTile({
  title,
  value,
  note,
  tone = 'neutral',
  href,
}: {
  title: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  href?: string;
}) {
  const body = (
    <>
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </>
  );
  return href ? (
    <Link href={href} className={`stat tone-${tone}`}>
      {body}
    </Link>
  ) : (
    <div className={`stat tone-${tone}`}>{body}</div>
  );
}

const BADGE_TONE: Record<string, string> = {
  emergency: 'bad',
  critical: 'bad',
  overdue: 'bad',
  high: 'warn',
  due_soon: 'warn',
  on_hold: 'warn',
  open: 'info',
  assigned: 'info',
  in_progress: 'info',
  closed: 'good',
  valid: 'good',
  in_service: 'good',
  under_repair: 'warn',
  cancelled: 'muted',
  permanent: 'muted',
};

export function Badge({ value, text }: { value: string; text?: string }) {
  return (
    <span className={`badge tone-${BADGE_TONE[value] ?? 'muted'}`}>{text ?? label(value)}</span>
  );
}

export function Health({ score }: { score: number | null }) {
  if (score === null) return <span className="muted">—</span>;
  const tone = score < 40 ? 'bad' : score < 60 ? 'warn' : 'good';
  return (
    <span className="health" title={`Health ${score}/100`}>
      <span className="health-track">
        <span className={`health-bar tone-${tone}`} style={{ width: `${score}%` }} />
      </span>
      <span className="health-num">{score}</span>
    </span>
  );
}

/** Previous/next links that keep the current filters. */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set('page', String(p));
    return `${basePath}?${q.toString()}`;
  };
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted">
        {first}–{Math.min(page * pageSize, total)} of {total.toLocaleString('en-IN')}
      </span>
      <span className="pagination-links">
        {page > 1 ? (
          <Link href={href(page - 1)}>Previous</Link>
        ) : (
          <span className="muted">Previous</span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)}>Next</Link>
        ) : (
          <span className="muted">Next</span>
        )}
      </span>
    </nav>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** Reads a single string from Next.js search params. */
export const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
