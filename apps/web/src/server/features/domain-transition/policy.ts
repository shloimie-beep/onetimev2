import path from 'node:path';

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

export type DomainTransitionPathClass =
  | 'legacy_login'
  | 'legacy_marketing'
  | 'legacy_mutation_retired'
  | 'legacy_signup'
  | 'tisha_bav_archived'
  | 'tisha_bav_archived_asset'
  | 'uncontrolled';

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
  '/tisha-bav-live',
  '/tisha-bav-live.html',
  '/tisha-bav/live',
  '/tisha-bav/success',
]);
const TISHA_BAV_API_ROOT = '/api/v1/events/tisha-bav-2026';
const TISHA_BAV_ARCHIVED_ASSET_ROOT = '/assets/events/tisha-bav-2026';
const LEGACY_MUTATION_ROOTS = ['/api/legacy', '/api/v1/legacy'] as const;

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

  const pathClass = classifyDomainTransitionPath(input.path);
  const normalizedPath = normalizeDomainTransitionPath(input.path);
  const method = input.method.toUpperCase();
  const safeRead = method === 'GET' || method === 'HEAD';

  if (pathClass === 'tisha_bav_archived') {
    return { action: 'gone', status: 410, reason: 'tisha_bav_archived' };
  }

  if (
    pathClass === 'legacy_mutation_retired' ||
    (!safeRead &&
      (pathClass === 'legacy_login' ||
        pathClass === 'legacy_signup' ||
        pathClass === 'legacy_marketing'))
  ) {
    return { action: 'gone', status: 410, reason: 'legacy_mutation_retired' };
  }

  if (!safeRead) return { action: 'pass_through', role };

  const status = input.mode === 'retired' ? 308 : 302;
  if (pathClass === 'legacy_login' && !(role === 'application' && normalizedPath === '/login')) {
    return {
      action: 'redirect',
      status,
      location: canonicalUrl(CANONICAL_APPLICATION_ORIGIN, '/login', input.query),
    };
  }
  if (pathClass === 'legacy_signup' && !(role === 'transition' && normalizedPath === '/signup')) {
    return {
      action: 'redirect',
      status,
      location: canonicalUrl(CANONICAL_TRANSITION_ORIGIN, '/signup', input.query),
    };
  }
  if (pathClass === 'legacy_marketing') {
    return {
      action: 'redirect',
      status,
      location: canonicalUrl(CANONICAL_TRANSITION_ORIGIN, '/', input.query),
    };
  }

  return { action: 'pass_through', role };
}

export function normalizeDomainTransitionPath(rawPath: string): string | null {
  const rawPathname = rawPath.split(/[?#]/u, 1)[0] || '/';
  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }

  const slashNormalized = decodedPathname.replace(/\\/gu, '/');
  const rooted = slashNormalized.startsWith('/') ? slashNormalized : `/${slashNormalized}`;
  const dotNormalized = path.posix.normalize(rooted);
  const withoutTrailingSlash =
    dotNormalized.length > 1 ? dotNormalized.replace(/\/+$/u, '') : dotNormalized;
  return withoutTrailingSlash.replace(/[A-Z]/gu, (character) => character.toLowerCase());
}

export function classifyDomainTransitionPath(rawPath: string): DomainTransitionPathClass {
  const normalizedPath = normalizeDomainTransitionPath(rawPath);
  if (!normalizedPath) return 'uncontrolled';
  if (TISHA_BAV_BROWSER_PATHS.has(normalizedPath)) return 'tisha_bav_archived';
  if (isPathAtOrBelow(normalizedPath, TISHA_BAV_API_ROOT)) return 'tisha_bav_archived';
  if (isPathAtOrBelow(normalizedPath, TISHA_BAV_ARCHIVED_ASSET_ROOT)) {
    return 'tisha_bav_archived_asset';
  }
  if (LEGACY_MUTATION_ROOTS.some((root) => isPathAtOrBelow(normalizedPath, root))) {
    return 'legacy_mutation_retired';
  }
  if (LEGACY_LOGIN_PATHS.has(normalizedPath)) return 'legacy_login';
  if (LEGACY_SIGNUP_PATHS.has(normalizedPath)) return 'legacy_signup';
  if (LEGACY_MARKETING_PATHS.has(normalizedPath)) return 'legacy_marketing';
  return 'uncontrolled';
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

function isPathAtOrBelow(normalizedPath: string, root: string): boolean {
  return normalizedPath === root || normalizedPath.startsWith(`${root}/`);
}
