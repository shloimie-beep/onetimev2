export const APPLICATION_ORIGIN = 'https://app.onetimeonetime.com' as const;
export const TRANSITION_ORIGIN = 'https://join.onetimeonetime.com' as const;

const SAFE_KEYS = [
  'source',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
] as const;
const SAFE_VALUE = /^[a-z0-9][a-z0-9._~-]{0,79}$/iu;

export function applicationLoginUrl(search: string | URLSearchParams = ''): string {
  return canonicalPublicUrl(APPLICATION_ORIGIN, '/login', search);
}

export function transitionSignupUrl(search: string | URLSearchParams = ''): string {
  return canonicalPublicUrl(TRANSITION_ORIGIN, '/signup', search);
}

export function canonicalPublicUrl(
  origin: typeof APPLICATION_ORIGIN | typeof TRANSITION_ORIGIN,
  path: '/login' | '/signup' | '/',
  search: string | URLSearchParams,
): string {
  const source = typeof search === 'string' ? new URLSearchParams(search) : search;
  const safe = new URLSearchParams();
  for (const key of SAFE_KEYS) {
    const value = source.get(key)?.trim();
    if (value && SAFE_VALUE.test(value)) safe.set(key, value);
  }
  const url = new URL(path, origin);
  url.search = safe.toString();
  return url.toString();
}
