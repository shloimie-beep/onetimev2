export const W12_E2E_ADMIN_SESSION_TOKEN = 'w12-admin-session-token-local-only-2026-07-17';
export const W12_E2E_ADMIN_CSRF_TOKEN = 'w12-admin-csrf-local-only';

export const W12_E2E_ADMIN_COOKIES = [
  {
    name: 'otcrm_session',
    value: W12_E2E_ADMIN_SESSION_TOKEN,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  },
  {
    name: 'otcrm_csrf',
    value: W12_E2E_ADMIN_CSRF_TOKEN,
    domain: '127.0.0.1',
    path: '/',
    sameSite: 'Strict',
  },
] as const;
