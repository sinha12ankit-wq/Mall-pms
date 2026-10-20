import 'server-only';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import type { MeResponse } from '@mall-pms/shared';
import { ACCESS_COOKIE, apiUrl } from './session';

async function authHeader() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');
  return { authorization: `Bearer ${token}` };
}

type Query = Record<string, string | number | undefined>;

const withQuery = (path: string, query?: Query) => {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (v !== undefined && v !== '') params.set(k, String(v));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

/** Calls the API as the signed-in user. 401 sends them to sign in; 403 and 404 show not found. */
export async function apiGet<T>(path: string, query?: Query): Promise<T> {
  const res = await fetch(apiUrl(withQuery(path, query)), {
    headers: await authHeader(),
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 403 || res.status === 404) notFound();
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** POST/PATCH for server actions. Returns the API's error message instead of throwing. */
export async function apiSend<T>(
  method: 'POST' | 'PATCH',
  path: string,
  body: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(apiUrl(path), {
    method,
    headers: { ...(await authHeader()), 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  }).catch(() => null);
  if (!res) return { ok: false, error: 'The server is unreachable. Try again shortly.' };
  if (res.status === 401) redirect('/login');
  const json = (await res.json().catch(() => ({}))) as {
    message?: string | string[];
    issues?: { path: string; message: string }[];
  };
  if (!res.ok) {
    const issue = json.issues?.[0];
    const message = issue ? `${issue.path}: ${issue.message}` : [json.message].flat().join(', ');
    return { ok: false, error: message || `Request failed (${res.status})` };
  }
  return { ok: true, data: json as T };
}

/** The signed-in user, fetched once per request. */
export const getMe = cache(() => apiGet<MeResponse>('/auth/me'));
