import type { AuthTokens } from '@mall-pms/shared';
import { type NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  apiUrl,
  REFRESH_COOKIE,
  tokenExpiresSoon,
  writeSessionCookies,
} from './lib/session';

/**
 * Keeps the session alive: when the access token is missing or about to
 * expire, swap the refresh token for a new pair before the page renders.
 */
export async function proxy(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  if (access && !tokenExpiresSoon(access)) return NextResponse.next();
  if (!refresh) return toLogin(request);

  const res = await fetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
    cache: 'no-store',
  }).catch(() => null);
  if (!res?.ok) return toLogin(request);

  const tokens = (await res.json()) as AuthTokens;
  // Pass the new tokens to this render and to the browser.
  request.cookies.set(ACCESS_COOKIE, tokens.accessToken);
  request.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
  const response = NextResponse.next({ request: { headers: request.headers } });
  writeSessionCookies(response.cookies, tokens);
  return response;
}

function toLogin(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

export const config = {
  // Everything except the login page, Next internals and static files.
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)'],
};
