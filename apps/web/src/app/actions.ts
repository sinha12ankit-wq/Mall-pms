'use server';

import { type AuthTokens, loginRequestSchema } from '@mall-pms/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE, apiUrl, REFRESH_COOKIE, writeSessionCookies } from '@/lib/session';

export interface LoginState {
  error?: string;
  /** Echoed back so the form keeps it after React resets the inputs. */
  email?: string;
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '');
  const parsed = loginRequestSchema.safeParse({ email, password: form.get('password') });
  if (!parsed.success) return { error: 'Enter a valid email and password.', email };
  const fail = (error: string): LoginState => ({ error, email });

  const res = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  }).catch(() => null);
  if (!res) return fail('The server is unreachable. Try again shortly.');
  if (res.status === 401) return fail('Invalid email or password.');
  if (res.status === 429) return fail('Too many attempts. Wait a minute and try again.');
  if (!res.ok) return fail('Sign-in failed. Try again.');

  writeSessionCookies(await cookies(), (await res.json()) as AuthTokens);
  redirect('/');
}

export async function logout() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  redirect('/login');
}
