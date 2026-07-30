import {
  GENERIC_AUTH_RESPONSES,
  SESSION_POLICIES,
  type AuthRole,
  type HumanAccountState,
  type SessionRecord,
  type SessionValidity,
  type StudentCredentialActor,
  type StudentCredentialTarget,
} from '../../../contracts/src/identity/auth/index.ts';

export function sessionDeadlines(role: AuthRole, issuedAt: Date) {
  const policy = SESSION_POLICIES[role];
  return {
    idle_timeout_ms: policy.idle_timeout_ms,
    absolute_expires_at: new Date(issuedAt.getTime() + policy.absolute_lifetime_ms).toISOString(),
  };
}

export function evaluateSession(input: {
  session: SessionRecord;
  current_credential_version: number;
  now: Date;
}): SessionValidity {
  if (input.session.revoked_at !== null) return { valid: false, reason: 'revoked' };
  if (input.session.credential_version !== input.current_credential_version) {
    return { valid: false, reason: 'credential_changed' };
  }
  const now = input.now.getTime();
  if (now >= new Date(input.session.absolute_expires_at).getTime()) {
    return { valid: false, reason: 'absolute_expired' };
  }
  const policy = SESSION_POLICIES[input.session.role];
  const nextIdleDeadline = new Date(
    new Date(input.session.last_seen_at).getTime() + policy.idle_timeout_ms,
  );
  if (now >= nextIdleDeadline.getTime()) return { valid: false, reason: 'idle_expired' };
  return { valid: true, next_idle_deadline: nextIdleDeadline.toISOString() };
}

export function accountMayAuthenticate(state: HumanAccountState): boolean {
  return state === 'active';
}

export function sessionRevocationRequired(event: {
  kind:
    | 'credential_changed'
    | 'role_changed'
    | 'ownership_transferred'
    | 'account_disabled'
    | 'account_archived'
    | 'explicit_revocation'
    | 'account_reactivated';
}): boolean {
  return event.kind !== 'account_reactivated';
}

export type StudentCredentialAuthorization =
  | { allowed: true; revoke_student_sessions: true; disclose_existing_password: false }
  | { allowed: false; code: 'GENERIC_DENIAL'; public_message: string };

export function authorizeStudentCredentialChange(input: {
  actor: StudentCredentialActor;
  target: StudentCredentialTarget;
}): StudentCredentialAuthorization {
  const actorMayManage =
    input.actor.role === 'admin' ||
    (input.actor.role === 'parent' &&
      input.actor.household_ids.includes(input.target.household_id));
  if (!actorMayManage || input.target.account_state !== 'active') {
    return {
      allowed: false,
      code: 'GENERIC_DENIAL',
      public_message: GENERIC_AUTH_RESPONSES.login_denied,
    };
  }
  return {
    allowed: true,
    revoke_student_sessions: true,
    disclose_existing_password: false,
  };
}

export function defaultRouteForRole(role: AuthRole): string {
  if (role === 'admin') return '/app/admin';
  if (role === 'parent') return '/app/parent';
  return '/app/student';
}

export function safeReturnTo(input: {
  requested_path: string | null | undefined;
  role: AuthRole;
  allowed_path_prefixes: readonly string[];
}): string {
  const fallback = defaultRouteForRole(input.role);
  const requested = input.requested_path?.trim();
  if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(requested, 'https://onetime.invalid');
  } catch {
    return fallback;
  }
  if (
    parsed.origin !== 'https://onetime.invalid' ||
    parsed.username ||
    parsed.password ||
    !input.allowed_path_prefixes.some(
      (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`),
    )
  ) {
    return fallback;
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
