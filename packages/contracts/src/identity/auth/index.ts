export const AUTH_CONTRACT_VERSION = '1.0.0' as const;

export const AUTH_ROLES = ['admin', 'parent', 'student'] as const;
export type AuthRole = (typeof AUTH_ROLES)[number];

export const ADULT_AUTH_ROLES = ['admin', 'parent'] as const;
export type AdultAuthRole = (typeof ADULT_AUTH_ROLES)[number];

export const HUMAN_ACCOUNT_STATES = ['invited', 'active', 'disabled', 'archived'] as const;
export type HumanAccountState = (typeof HUMAN_ACCOUNT_STATES)[number];

export type AuthCredentialKind = 'adult_email_password' | 'student_username_password';

export type PasswordPolicy = {
  minimum_code_points: number;
  maximum_code_points: number;
  composition_rule: 'none';
  reject_common: true;
  reject_compromised: true;
  reject_identity_equivalent: true;
  storage: 'versioned_argon2id';
};

export const PASSWORD_POLICIES = {
  adult: {
    minimum_code_points: 12,
    maximum_code_points: 128,
    composition_rule: 'none',
    reject_common: true,
    reject_compromised: true,
    reject_identity_equivalent: true,
    storage: 'versioned_argon2id',
  },
  student: {
    minimum_code_points: 8,
    maximum_code_points: 64,
    composition_rule: 'none',
    reject_common: true,
    reject_compromised: true,
    reject_identity_equivalent: true,
    storage: 'versioned_argon2id',
  },
} as const satisfies Record<'adult' | 'student', PasswordPolicy>;

export type SessionPolicy = {
  idle_timeout_ms: number;
  absolute_lifetime_ms: number;
  sliding_absolute_expiry: false;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const SESSION_POLICIES = {
  admin: {
    idle_timeout_ms: 30 * MINUTE,
    absolute_lifetime_ms: 12 * HOUR,
    sliding_absolute_expiry: false,
  },
  parent: {
    idle_timeout_ms: 24 * HOUR,
    absolute_lifetime_ms: 30 * DAY,
    sliding_absolute_expiry: false,
  },
  student: {
    idle_timeout_ms: 7 * DAY,
    absolute_lifetime_ms: 30 * DAY,
    sliding_absolute_expiry: false,
  },
} as const satisfies Record<AuthRole, SessionPolicy>;

export const AUTH_TOKEN_PURPOSES = ['account_setup', 'password_reset'] as const;
export type AuthTokenPurpose = (typeof AUTH_TOKEN_PURPOSES)[number];

export const AUTH_TOKEN_POLICIES = {
  account_setup: {
    ttl_ms: 7 * DAY,
    single_use: true,
    replacement_supersedes_unused: true,
  },
  password_reset: {
    ttl_ms: 60 * MINUTE,
    single_use: true,
    replacement_supersedes_unused: true,
  },
} as const satisfies Record<
  AuthTokenPurpose,
  {
    ttl_ms: number;
    single_use: true;
    replacement_supersedes_unused: true;
  }
>;

export const AUTH_RATE_LIMITS = {
  login_account_ip: {
    maximum_failures: 5,
    window_ms: 15 * MINUTE,
  },
  login_ip: {
    maximum_failures: 50,
    window_ms: 15 * MINUTE,
  },
  password_reset_account: {
    maximum_requests: 5,
    window_ms: HOUR,
  },
  password_reset_ip: {
    maximum_requests: 20,
    window_ms: HOUR,
  },
  setup_resend_account: {
    maximum_requests: 3,
    window_ms: HOUR,
  },
} as const;

export const GENERIC_AUTH_RESPONSES = {
  login_denied: 'The email, username, or password is not correct.',
  reset_requested: 'If an eligible account matches, password reset instructions will be sent.',
  setup_requested: 'If setup is available, new setup instructions will be sent.',
  token_denied: 'This link is invalid or has expired. Request a new link.',
} as const;

export const AUTH_SECURITY_INVARIANTS = {
  mfa_supported: false,
  email_challenge_supported: false,
  recovery_codes_supported: false,
  permanent_lockout_supported: false,
  student_email_required: false,
  student_highlevel_contact_allowed: false,
  existing_password_display_allowed: false,
  server_clock_authoritative: true,
} as const;

export const CROSS_DOMAIN_SECURITY_BOUNDARIES = {
  class_bootstrap_ttl_ms: 60_000,
  playback_grant_ttl_ms: 5 * MINUTE,
  oauth_state_ttl_ms: 10 * MINUTE,
  classroom_heartbeat_interval_ms: 30_000,
  classroom_lease_ms: 90_000,
  webhook_max_bytes: 2 * 1024 * 1024,
  webhook_timestamp_tolerance_ms: 5 * MINUTE,
  worker_lease_ms: 5 * MINUTE,
  worker_heartbeat_interval_ms: 60_000,
  worker_max_attempts: 8,
  worker_initial_backoff_ms: 30_000,
  worker_max_backoff_ms: 30 * MINUTE,
  worker_backoff: 'full_jitter_exponential',
  governed_reprocess_preserves_idempotency: true,
} as const;

export const AUTH_REQUEST_SECURITY = {
  state_changing_same_origin_requires_csrf: true,
  rotate_session_on_login: true,
  rotate_or_revoke_on_privilege_or_credential_change: true,
  token_route_removes_token_from_history: true,
  token_route_allows_third_party_assets: false,
} as const;

export const AUTH_SESSION_COOKIE = {
  name: '__Host-onetime-session',
  path: '/',
  http_only: true,
  secure: true,
  same_site: 'lax',
  domain: null,
} as const;

export type LoginCommand =
  | {
      credential_kind: 'adult_email_password';
      email: string;
      password: string;
      return_to?: string;
    }
  | {
      credential_kind: 'student_username_password';
      username: string;
      password: string;
      return_to?: string;
    };

export type AuthenticatedPrincipal = {
  human_account_id: string;
  role: AuthRole;
  household_id: string | null;
  student_id: string | null;
  credential_version: number;
};

export type LoginDecision =
  | {
      ok: true;
      principal: AuthenticatedPrincipal;
      assurance_method: 'password';
      rotate_session: true;
    }
  | {
      ok: false;
      code: 'GENERIC_DENIAL' | 'RATE_LIMITED';
      public_message: string;
      permanent_lockout: false;
    };

export type AuthTokenRecord = {
  token_id: string;
  subject_id: string;
  purpose: AuthTokenPurpose;
  token_hash: string;
  issued_at: string;
  expires_at: string;
  consumed_at: string | null;
  superseded_at: string | null;
};

export type SessionRecord = {
  session_id: string;
  role: AuthRole;
  issued_at: string;
  last_seen_at: string;
  absolute_expires_at: string;
  credential_version: number;
  revoked_at: string | null;
};

export type SessionValidity =
  | { valid: true; next_idle_deadline: string }
  | {
      valid: false;
      reason: 'revoked' | 'credential_changed' | 'idle_expired' | 'absolute_expired';
    };

export type StudentCredentialActor = {
  role: AuthRole;
  household_ids: readonly string[];
};

export type StudentCredentialTarget = {
  student_id: string;
  household_id: string;
  account_state: Extract<HumanAccountState, 'active' | 'disabled' | 'archived'>;
};
