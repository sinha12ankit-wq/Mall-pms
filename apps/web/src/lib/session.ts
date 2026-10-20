import type { AuthTokens } from '@mall-pms/shared';

/**
 * Tokens live in httpOnly cookies, so browser JavaScript never sees them.
 * Server components and actions call the API on the user's behalf.
 */
export const ACCESS_COOKIE = 'pms_at';
export const REFRESH_COOKIE = 'pms_rt';

export const apiUrl = (path: string) =>
  `${process.env.API_URL ?? 'http://localhost:4000'}/api/v1${path}`;

interface CookieWriter {
  set(name: string, value: string, options: Record<string, unknown>): unknown;
}

export function writeSessionCookies(
  cookies: CookieWriter,
  tokens: AuthTokens,
  refreshTtlDays = 30,
) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
  cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...base, maxAge: tokens.expiresIn });
  cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...base, maxAge: refreshTtlDays * 86_400 });
}

/** Reads exp from a JWT without verifying it; the API does the verification. */
export function tokenExpiresSoon(token: string, skewSeconds = 30): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as {
      exp?: number;
    };
    return !payload.exp || payload.exp * 1000 < Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}
