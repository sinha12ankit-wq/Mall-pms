import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE, apiUrl } from './session';

/** Calls the API as the signed-in user. Redirects to /login if the session is gone. */
export async function apiGet<T>(path: string): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');
  const res = await fetch(apiUrl(path), {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}
