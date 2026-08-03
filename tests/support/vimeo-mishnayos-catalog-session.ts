export const VIMEO_CATALOG_E2E_STUDENT_SESSION_TOKEN = 'vimeo-catalog-student-session-local-only';
export const VIMEO_CATALOG_E2E_STUDENT_CSRF_TOKEN = 'vimeo-catalog-student-csrf-local-only';

export const VIMEO_CATALOG_E2E_STUDENT_COOKIES = [
  {
    name: 'otcrm_session',
    value: VIMEO_CATALOG_E2E_STUDENT_SESSION_TOKEN,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Strict',
  },
  {
    name: 'otcrm_csrf',
    value: VIMEO_CATALOG_E2E_STUDENT_CSRF_TOKEN,
    domain: '127.0.0.1',
    path: '/',
    sameSite: 'Strict',
  },
] as const;
