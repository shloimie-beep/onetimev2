import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../config/src/index.ts';
import {
  AUTH_RATE_LIMITS,
  AUTH_REQUEST_SECURITY,
  AUTH_SECURITY_INVARIANTS,
  AUTH_SESSION_COOKIE,
  AUTH_TOKEN_POLICIES,
  CROSS_DOMAIN_SECURITY_BOUNDARIES,
  GENERIC_AUTH_RESPONSES,
  isStudentPin,
  PASSWORD_POLICIES,
  SESSION_POLICIES,
  type SessionRecord,
} from '../../../contracts/src/identity/auth/index.ts';
import { createMemoryPool, runMigrations } from '../../../db/src/index.ts';
import {
  authReturnLocation,
  sessionCookieHeader,
} from '../../../../apps/web/src/server/features/auth/http-security.ts';
import {
  ARGON2ID_POLICY_VERSION,
  COMMON_AUTH_PASSWORDS,
  authPasswordHashNeedsUpgrade,
  evaluatePassword,
  hashAuthPassword,
  normalizeLegacyAuthRole,
  verifyAuthPasswordWithUpgrade,
} from './policy.ts';
import { evaluateAuthRateLimit } from './rate-limits.ts';
import {
  accountMayAuthenticate,
  authorizeStudentCredentialChange,
  evaluateSession,
  safeReturnTo,
  sessionDeadlines,
  sessionRevocationRequired,
} from './sessions.ts';
import { consumeAuthToken, issueAuthToken, supersedeAuthTokens } from './tokens.ts';
import { authenticateUser, createAccountUser } from './service.ts';

const now = new Date('2026-07-28T18:00:00.000Z');

describe('One Time v2.1 authentication contract', () => {
  it('OTV2-AUTH-007-AC01 uses adult email and password with legacy Admin normalization', () => {
    expect(normalizeLegacyAuthRole('owner')).toBe('admin');
    expect(normalizeLegacyAuthRole('rabbi')).toBe('admin');
    expect(normalizeLegacyAuthRole('parent')).toBe('parent');
  });

  it('uses a six-character minimum for adult passwords without imposing the Student PIN format', () => {
    expect(PASSWORD_POLICIES.adult).toMatchObject({
      minimum_code_points: 6,
      maximum_code_points: 128,
      composition_rule: 'none',
      reject_common: true,
      reject_compromised: true,
      reject_identity_equivalent: true,
    });
    expect(evaluatePassword({ role: 'parent', password: 'Abcdef' })).toEqual({ accepted: true });
    expect(evaluatePassword({ role: 'parent', password: 'Abcde' })).toEqual({
      accepted: false,
      reason: 'too_short',
    });
    expect(
      evaluatePassword({
        role: 'parent',
        password: 'Abcdef',
        common_passwords: new Set(['abcdef']),
      }),
    ).toEqual({ accepted: false, reason: 'common' });
    expect(
      evaluatePassword({ role: 'parent', password: 'Abcdef', is_compromised: () => true }),
    ).toEqual({ accepted: false, reason: 'compromised' });
    expect(evaluatePassword({ role: 'parent', password: 'Abcdef', names: ['abcdef'] })).toEqual({
      accepted: false,
      reason: 'identity_equivalent',
    });
    expect(
      evaluatePassword({
        role: 'parent',
        password: 'qwerty',
        common_passwords: COMMON_AUTH_PASSWORDS,
      }),
    ).toEqual({ accepted: false, reason: 'common' });
  });

  it('OTV2-AUTH-248-STUDENT-PIN defines an exactly six-digit Student PIN without email', () => {
    expect(PASSWORD_POLICIES.student.minimum_code_points).toBe(6);
    expect(PASSWORD_POLICIES.student.maximum_code_points).toBe(6);
    expect(PASSWORD_POLICIES.student.composition_rule).toBe('exact_six_ascii_digits');
    expect(isStudentPin('000123')).toBe(true);
    expect(isStudentPin('12345')).toBe(false);
    expect(isStudentPin('1234567')).toBe(false);
    expect(isStudentPin('12a456')).toBe(false);
    expect(AUTH_SECURITY_INVARIANTS.student_email_required).toBe(false);
    expect(AUTH_SECURITY_INVARIANTS.student_highlevel_contact_allowed).toBe(false);
  });

  it('enforces the Student PIN format in the shared password policy', () => {
    expect(
      evaluatePassword({
        role: 'student',
        password: '000123',
        common_passwords: new Set(['000123']),
        is_compromised: () => true,
        username: '000123',
      }),
    ).toEqual({ accepted: true });
    expect(
      evaluatePassword({
        role: 'parent',
        password: 'ParentPass!234',
        common_passwords: new Set(['ParentPass!234']),
      }),
    ).toEqual({ accepted: false, reason: 'common' });
    expect(evaluatePassword({ role: 'student', password: '12a456' })).toEqual({
      accepted: false,
      reason: 'invalid_format',
    });
  });

  it('OTV2-AUTH-009-AC01 has no routine email challenge', () => {
    expect(AUTH_SECURITY_INVARIANTS.email_challenge_supported).toBe(false);
  });

  it('OTV2-AUTH-010-AC01 has no MFA enrollment, challenge, or recovery state', () => {
    expect(AUTH_SECURITY_INVARIANTS).toMatchObject({
      mfa_supported: false,
      recovery_codes_supported: false,
    });
  });

  it('OTV2-AUTH-011-AC01 uses a seven-day single-use Admin setup token', () => {
    expect(AUTH_TOKEN_POLICIES.account_setup).toEqual({
      ttl_ms: 7 * 24 * 60 * 60 * 1000,
      single_use: true,
      replacement_supersedes_unused: true,
    });
  });

  it('OTV2-AUTH-012-AC01 uses the same setup contract for Parent', () => {
    const issued = issueAuthToken({
      subject_id: 'parent-1',
      purpose: 'account_setup',
      now,
      prior_records: [],
      random_token: () => 'parent-setup-token',
    });
    expect(issued.record.expires_at).toBe('2026-08-04T18:00:00.000Z');
  });

  it('OTV2-AUTH-013-SINGLE-USE-TTL denies reset expiry and replay', () => {
    const issued = issueAuthToken({
      subject_id: 'adult-1',
      purpose: 'password_reset',
      now,
      prior_records: [],
      random_token: () => 'reset-token',
    });
    expect(
      consumeAuthToken({
        record: issued.record,
        raw_token: issued.raw_token,
        now: new Date(now.getTime() + 60 * 60 * 1000 - 1),
      }),
    ).toMatchObject({ consumed: true });
    expect(
      consumeAuthToken({
        record: issued.record,
        raw_token: issued.raw_token,
        now: new Date(now.getTime() + 60 * 60 * 1000),
      }),
    ).toEqual({ consumed: false, reason: 'expired' });
    const used = { ...issued.record, consumed_at: now.toISOString() };
    expect(consumeAuthToken({ record: used, raw_token: issued.raw_token, now })).toEqual({
      consumed: false,
      reason: 'used',
    });
  });

  it('OTV2-AUTH-013-RENEWAL supersedes every earlier unused reset token', () => {
    const first = issueAuthToken({
      subject_id: 'adult-1',
      purpose: 'password_reset',
      now,
      prior_records: [],
      random_token: () => 'first-token',
    });
    const second = issueAuthToken({
      subject_id: 'adult-1',
      purpose: 'password_reset',
      now: new Date(now.getTime() + 1),
      prior_records: [first.record],
      random_token: () => 'second-token',
    });
    const records = supersedeAuthTokens(
      [first.record, second.record],
      new Set(second.superseded_token_ids),
      new Date(now.getTime() + 1),
    );
    expect(records[0]?.superseded_at).not.toBeNull();
    expect(
      consumeAuthToken({ record: records[0] ?? null, raw_token: first.raw_token, now }),
    ).toEqual({ consumed: false, reason: 'superseded' });
  });

  it('OTV2-AUTH-014-AC01 allows owned Parent/Admin Student username changes', () => {
    expect(
      authorizeStudentCredentialChange({
        actor: { role: 'parent', household_ids: ['household-1'] },
        target: {
          student_id: 'student-1',
          household_id: 'household-1',
          account_state: 'active',
        },
      }),
    ).toMatchObject({ allowed: true });
  });

  it('OTV2-AUTH-015-AC01 resets Student credentials and requires session revocation', () => {
    expect(
      authorizeStudentCredentialChange({
        actor: { role: 'admin', household_ids: [] },
        target: {
          student_id: 'student-1',
          household_id: 'household-1',
          account_state: 'active',
        },
      }),
    ).toEqual({
      allowed: true,
      revoke_student_sessions: true,
      disclose_existing_password: false,
    });
  });

  it('OTV2-AUTH-016-AC01 never discloses an existing password', () => {
    expect(AUTH_SECURITY_INVARIANTS.existing_password_display_allowed).toBe(false);
  });

  it('OTV2-AUTH-017-AC01 revokes sessions on credential changes', () => {
    expect(sessionRevocationRequired({ kind: 'credential_changed' })).toBe(true);
  });

  it('OTV2-AUTH-018-AC01 blocks disabled/archived accounts and permits reactivation', () => {
    expect(accountMayAuthenticate('disabled')).toBe(false);
    expect(accountMayAuthenticate('archived')).toBe(false);
    expect(accountMayAuthenticate('active')).toBe(true);
  });

  it('OTV2-AUTH-019-AC01 accepts only role-safe same-origin return paths', () => {
    expect(
      safeReturnTo({
        requested_path: 'https://evil.invalid/steal',
        role: 'parent',
        allowed_path_prefixes: ['/app/parent'],
      }),
    ).toBe('/app/parent');
    expect(authReturnLocation({ return_to: '/app/parent/students', role: 'parent' })).toBe(
      '/app/parent/students',
    );
  });

  it('OTV2-AUTH-020-CSRF requires proof on same-origin state changes', () => {
    expect(AUTH_REQUEST_SECURITY.state_changing_same_origin_requires_csrf).toBe(true);
  });

  it('OTV2-AUTH-020-RATE applies exact recoverable throttles', () => {
    expect(AUTH_RATE_LIMITS.login_account_ip.maximum_failures).toBe(5);
    expect(AUTH_RATE_LIMITS.login_ip.maximum_failures).toBe(50);
    const events = Array.from({ length: 5 }, (_, index) => new Date(now.getTime() - index));
    expect(
      evaluateAuthRateLimit({ kind: 'login_account_ip', event_times: events, now }),
    ).toMatchObject({
      allowed: false,
    });
    expect(
      evaluateAuthRateLimit({
        kind: 'login_account_ip',
        event_times: events,
        now: new Date(now.getTime() + 15 * 60 * 1000 + 1),
      }),
    ).toEqual({ allowed: true });
  });

  it('OTV2-AUTH-020-COOKIE emits an origin-isolated secure host cookie', () => {
    expect(AUTH_SESSION_COOKIE.domain).toBeNull();
    expect(sessionCookieHeader({ token: 'opaque', max_age_seconds: 60 })).toBe(
      '__Host-onetime-session=opaque; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60',
    );
  });

  it('OTV2-AUTH-020-ROTATE rotates login and revokes privilege/credential changes', () => {
    expect(AUTH_REQUEST_SECURITY.rotate_session_on_login).toBe(true);
    expect(AUTH_REQUEST_SECURITY.rotate_or_revoke_on_privilege_or_credential_change).toBe(true);
  });

  it('OTV2-AUTH-180-AC01 renews and supersedes seven-day claim links', () => {
    expect(AUTH_TOKEN_POLICIES.account_setup.replacement_supersedes_unused).toBe(true);
    expect(AUTH_TOKEN_POLICIES.account_setup.ttl_ms).toBe(604_800_000);
  });

  it('OTV2-AUTH-227-PASSWORDS-RATE-LIMITS enforces code-point bounds and versioned Argon2id', () => {
    expect(
      evaluatePassword({ role: 'admin', password: 'abcdefghijkl', names: ['Someone Else'] }),
    ).toEqual({ accepted: true });
    expect(evaluatePassword({ role: 'student', password: '000123' })).toEqual({
      accepted: true,
    });
    expect(evaluatePassword({ role: 'student', password: 'מיכאל123' })).toEqual({
      accepted: false,
      reason: 'too_long',
    });
    expect(
      evaluatePassword({
        role: 'parent',
        password: 'PARENT@EXAMPLE.COM',
        email: 'parent@example.com',
      }),
    ).toEqual({ accepted: false, reason: 'identity_equivalent' });
    const hash = hashAuthPassword('abcdefghijkl');
    expect(hash.startsWith(`${ARGON2ID_POLICY_VERSION}$`)).toBe(true);
    expect(verifyAuthPasswordWithUpgrade('abcdefghijkl', hash)).toEqual({
      valid: true,
      replacement_hash: null,
    });
    expect(authPasswordHashNeedsUpgrade(hash)).toBe(false);
  });

  it('OTV2-AUTH-227-SESSIONS-TOKENS-LEASES applies exact role boundaries', () => {
    expect(SESSION_POLICIES.admin).toMatchObject({
      idle_timeout_ms: 1_800_000,
      absolute_lifetime_ms: 43_200_000,
    });
    expect(sessionDeadlines('student', now).absolute_expires_at).toBe('2026-08-27T18:00:00.000Z');
    const session: SessionRecord = {
      session_id: 'session-1',
      role: 'admin',
      issued_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      absolute_expires_at: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      credential_version: 1,
      revoked_at: null,
    };
    expect(
      evaluateSession({
        session,
        current_credential_version: 1,
        now: new Date(now.getTime() + 30 * 60 * 1000),
      }),
    ).toEqual({ valid: false, reason: 'idle_expired' });
  });

  it('OTV2-AUTH-227-WEBHOOK-WORKER publishes exact bounded envelope and worker policy', () => {
    expect(CROSS_DOMAIN_SECURITY_BOUNDARIES).toMatchObject({
      webhook_max_bytes: 2_097_152,
      webhook_timestamp_tolerance_ms: 300_000,
      worker_lease_ms: 300_000,
      worker_heartbeat_interval_ms: 60_000,
      worker_max_attempts: 8,
      worker_initial_backoff_ms: 30_000,
      worker_max_backoff_ms: 1_800_000,
      governed_reprocess_preserves_idempotency: true,
    });
    expect(GENERIC_AUTH_RESPONSES.reset_requested).not.toContain('exists');
  });

  it('applies F01-retired-auth-001 without creating a challenge or trusted-device artifact', async () => {
    const pool = createMemoryPool();
    try {
      const config = loadConfig({
        NODE_ENV: 'test',
        PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
        APP_VERSION: 'f03-contract-test',
        COMMIT_SHA: 'f03-contract-test',
        OUTBOX_TRANSPORT_MODE: 'sink',
        ONE_TIME_ACCOUNT_KEY: 'f03_auth_contract',
        ONE_TIME_PRODUCT_KEY: 'one_time_mishnayos',
      });
      await runMigrations(pool);
      await createAccountUser({
        pool,
        config,
        email: 'admin@example.test',
        password: 'AdminPassword123',
        displayName: 'Admin Example',
        role: 'owner',
      });

      const result = await authenticateUser({
        pool,
        config,
        identifier: 'admin@example.test',
        password: 'AdminPassword123',
        trustedDeviceToken: 'ignored-by-v2.1-password-only-login',
      });
      expect(result).toMatchObject({
        ok: true,
        user: { role: 'admin', mfa_capable: false },
      });
      const challenges = await pool.query(
        'SELECT count(*) AS count FROM onetime.auth_email_challenges',
      );
      const trustedDevices = await pool.query(
        'SELECT count(*) AS count FROM onetime.auth_trusted_devices',
      );
      expect(Number(challenges.rows[0]?.count)).toBe(0);
      expect(Number(trustedDevices.rows[0]?.count)).toBe(0);
    } finally {
      await pool.end();
    }
  });
});
