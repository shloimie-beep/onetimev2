import {
  AUTH_SESSION_COOKIE,
  type AuthRole,
} from '../../../../../../packages/contracts/src/identity/auth/index.ts';
import { safeReturnTo } from '../../../../../../packages/domain/src/auth/sessions.ts';

export function sessionCookieHeader(input: { token: string; max_age_seconds: number }): string {
  return [
    `${AUTH_SESSION_COOKIE.name}=${encodeURIComponent(input.token)}`,
    `Path=${AUTH_SESSION_COOKIE.path}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(input.max_age_seconds))}`,
  ].join('; ');
}

export function clearSessionCookieHeader(): string {
  return sessionCookieHeader({ token: '', max_age_seconds: 0 });
}

export function authReturnLocation(input: { return_to?: string; role: AuthRole }): string {
  const prefixes =
    input.role === 'admin'
      ? ['/app/admin']
      : input.role === 'parent'
        ? ['/app/parent', '/select-household', '/select-role']
        : ['/app/student'];
  return safeReturnTo({
    requested_path: input.return_to,
    role: input.role,
    allowed_path_prefixes: prefixes,
  });
}
