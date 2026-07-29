export const CANONICAL_MARKETING_HOSTS = ['onetimeonetime.com', 'www.onetimeonetime.com'] as const;
export const CANONICAL_TRANSITION_HOST = 'join.onetimeonetime.com' as const;
export const CANONICAL_APPLICATION_HOST = 'app.onetimeonetime.com' as const;
export const CANONICAL_APPLICATION_ORIGIN = `https://${CANONICAL_APPLICATION_HOST}` as const;
export const CANONICAL_TRANSITION_ORIGIN = `https://${CANONICAL_TRANSITION_HOST}` as const;

export const HOST_ONLY_SESSION_REQUIREMENTS = Object.freeze({
  domainAttribute: null,
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
} as const);

export type DomainTransitionMode =
  'pre_cutover_read_only' | 'post_acceptance_transition' | 'retired';

export type DomainRole = 'application' | 'transition' | 'marketing' | 'unknown';

export type TransitionDecision =
  | {
      action: 'pass_through';
      role: Exclude<DomainRole, 'unknown'>;
    }
  | {
      action: 'redirect';
      status: 302 | 308;
      location: string;
    }
  | {
      action: 'gone';
      status: 410;
      reason: 'legacy_mutation_retired' | 'tisha_bav_archived';
    }
  | {
      action: 'not_found';
      status: 404;
      reason: 'unknown_host' | 'unknown_legacy_path';
    };

const SAFE_ATTRIBUTION_KEYS = new Set([
  'source',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
]);
const SAFE_ATTRIBUTION_VALUE = /^[a-z0-9][a-z0-9._~-]{0,79}$/iu;

const LEGACY_LOGIN_PATHS = new Set(['/login', '/one-time/login', '/rabbi-member']);
const LEGACY_SIGNUP_PATHS = new Set(['/join', '/one-time/signup', '/signup']);
const LEGACY_MARKETING_PATHS = new Set(['/one-time']);
const TISHA_BAV_BROWSER_PATHS = new Set([
  '/tisha-bav',
  '/tisha-bav.html',
  '/tisha-bav/live',
  '/tisha-bav/success',
]);
const TISHA_BAV_API_PREFIX = '/api/v1/events/tisha-bav-2026/';
const LEGACY_MUTATION_PREFIXES = ['/api/legacy/', '/api/v1/legacy/'] as const;

export function classifyDomain(hostHeader: string): DomainRole {
  const host = normalizeHost(hostHeader);
  if (host === CANONICAL_APPLICATION_HOST) return 'application';
  if (host === CANONICAL_TRANSITION_HOST) return 'transition';
  if ((CANONICAL_MARKETING_HOSTS as readonly string[]).includes(host)) return 'marketing';
  return 'unknown';
}

export function decideDomainTransition(input: {
  host: string;
  method: string;
  path: string;
  query?: Readonly<Record<string, string | readonly string[] | undefined>>;
  mode?: DomainTransitionMode;
}): TransitionDecision {
  const role = classifyDomain(input.host);
  if (role === 'unknown') {
    return { action: 'not_found', status: 404, reason: 'unknown_host' };
  }

  const path = normalizePath(input.path);
  const method = input.method.toUpperCase();
  const safeRead = method === 'GET' || method === 'HEAD';

  if (TISHA_BAV_BROWSER_PATHS.has(path) || path.startsWith(TISHA_BAV_API_PREFIX)) {
    return { action: 'gone', status: 410, reason: 'tisha_bav_archived' };
  }

  if (
    LEGACY_MUTATION_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
    (!safeRead &&
      (LEGACY_LOGIN_PATHS.has(path) ||
        LEGACY_SIGNUP_PATHS.has(path) ||
        LEGACY_MARKETING_PATHS.has(path)))
  ) {
    return { action: 'gone', status: 410, reason: 'legacy_mutation_retired' };
  }

  if (!safeRead) return { action: 'pass_through', role };

  const status = input.mode === 'retired' ? 308 : 302;
  if (LEGACY_LOGIN_PATHS.has(path) && !(role === 'application' && path === '/login')) {
    return {
      action: 'redirect',
      status,
      location: canonicalUrl(CANONICAL_APPLICATION_ORIGIN, '/login', input.query),
    };
  }
  if (LEGACY_SIGNUP_PATHS.has(path) && !(role === 'transition' && path === '/signup')) {
    return {
      action: 'redirect',
      status,
      location: canonicalUrl(CANONICAL_TRANSITION_ORIGIN, '/signup', input.query),
    };
  }
  if (LEGACY_MARKETING_PATHS.has(path)) {
    return {
      action: 'redirect',
      status,
      location: canonicalUrl(CANONICAL_TRANSITION_ORIGIN, '/', input.query),
    };
  }

  return { action: 'pass_through', role };
}

export function safeAttributionQuery(
  query: Readonly<Record<string, string | readonly string[] | undefined>> | undefined,
): URLSearchParams {
  const safe = new URLSearchParams();
  if (!query) return safe;

  for (const key of [...SAFE_ATTRIBUTION_KEYS].sort()) {
    const raw = query[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (SAFE_ATTRIBUTION_VALUE.test(trimmed)) safe.set(key, trimmed);
  }
  return safe;
}

export function evaluateCutoverGate(input: {
  immutableCandidateVerified: boolean;
  productionAcceptancePassed: boolean;
  rollbackTargetHealthy: boolean;
  backupAndRestoreProofCurrent: boolean;
  unexpectedExternalEffects: number;
}):
  | { allowed: true }
  | {
      allowed: false;
      blockers: readonly string[];
    } {
  const blockers: string[] = [];
  if (!input.immutableCandidateVerified) blockers.push('immutable_candidate_unverified');
  if (!input.productionAcceptancePassed) blockers.push('production_acceptance_not_passed');
  if (!input.rollbackTargetHealthy) blockers.push('rollback_target_unhealthy');
  if (!input.backupAndRestoreProofCurrent) blockers.push('backup_restore_proof_not_current');
  if (input.unexpectedExternalEffects !== 0) blockers.push('unexpected_external_effects_nonzero');
  return blockers.length === 0 ? { allowed: true } : { allowed: false, blockers };
}

function canonicalUrl(
  origin: typeof CANONICAL_APPLICATION_ORIGIN | typeof CANONICAL_TRANSITION_ORIGIN,
  path: string,
  query: Readonly<Record<string, string | readonly string[] | undefined>> | undefined,
): string {
  const url = new URL(path, origin);
  url.search = safeAttributionQuery(query).toString();
  return url.toString();
}

function normalizeHost(hostHeader: string): string {
  const first = hostHeader.split(',')[0]?.trim().toLowerCase() ?? '';
  if (first.startsWith('[')) return first;
  return first.replace(/:\d+$/u, '');
}

function normalizePath(path: string): string {
  const pathname = path.split(/[?#]/u, 1)[0] || '/';
  if (!pathname.startsWith('/')) return `/${pathname}`;
  return pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
}
