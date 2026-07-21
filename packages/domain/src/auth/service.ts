import {
  argon2Sync,
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import {
  normalizeStudentUsername,
  roleDisplayLabel,
  type SessionUser,
  type UserRole,
} from '../../../contracts/src/index.ts';
import type { AppConfig } from '../../../config/src/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { normalizeEmail, stableKey } from '../lead/normalize.ts';
import { consumeRateLimitBudgets } from '../security/rate-limit.ts';

const ARGON2_MEMORY_KIB = 19_456;
const ARGON2_PASSES = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_TAG_LENGTH = 32;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = hashPassword('dummy-password-used-only-to-balance-login-timing');
const DUMMY_STUDENT_PASSWORD_HASH_REF = studentPasswordHashRefForTestsOnly(
  'dummy-password-used-only-to-balance-student-login-timing',
);
const RECOVERY_CODE_COUNT = 10;
const POST_ACTIVATION_MFA_HANDOFF_TTL_MS = 15 * 60 * 1000;
const EMAIL_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_ASSURANCE_MAX_AGE_MS = 10 * 60 * 1000;
const EMAIL_CHALLENGE_DELIVERY_KEY_VERSION = 1;
const EMAIL_CHALLENGE_DELIVERY_BATCH_SIZE = 10;
const EMAIL_CHALLENGE_DELIVERY_LEASE_MS = 120_000;
const TRANSACTIONAL_AUTH_EMAIL_SENDER = 'info@onetimeonetime.com';

type AssuranceMethod =
  'password' | 'totp' | 'recovery_code' | 'email_challenge' | 'email_link' | 'trusted_device';

export type AuthenticatedSession = {
  session_key: string;
  user: SessionUser;
  expires_at: string;
  assurance_method: AssuranceMethod;
  assurance_at: string | null;
};

export type CreatedSession = AuthenticatedSession & {
  session_token: string;
  csrf_token: string;
};

export type AuthFailureCode =
  'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'EMAIL_CHALLENGE_REQUIRED' | 'DISABLED';

export type LoginResult =
  | { ok: true; user: SessionUser; assuranceMethod?: AssuranceMethod }
  | {
      ok: false;
      code: AuthFailureCode;
      retry_after_seconds?: number;
      challenge_token?: string;
      challenge_expires_at?: string;
      delivery_state?: string;
    };

export type AuthEmailChallengeDeliveryBatchSummary = {
  claimed: number;
  sink_delivered: number;
  provider_delivered: number;
  expired: number;
  retried: number;
  dead_lettered: number;
  lease_lost: number;
  external_send_performed: boolean;
  raw_token_logged: false;
};

export function resetAuthRateLimitForTests() {
  // Durable rate-limit state is stored in the test database and resets with the pool.
}

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = argon2Sync('argon2id', {
    message: Buffer.from(password),
    nonce: salt,
    memory: ARGON2_MEMORY_KIB,
    passes: ARGON2_PASSES,
    parallelism: ARGON2_PARALLELISM,
    tagLength: ARGON2_TAG_LENGTH,
  });
  return [
    'argon2id',
    'v=19',
    `m=${ARGON2_MEMORY_KIB},t=${ARGON2_PASSES},p=${ARGON2_PARALLELISM}`,
    salt.toString('base64url'),
    hash.toString('base64url'),
  ].join('$');
}

export function verifyPassword(password: string, storedHash: string) {
  const parts = storedHash.split('$');
  if (parts.length !== 5 || parts[0] !== 'argon2id' || parts[1] !== 'v=19') return false;
  const encodedParams = parts[2];
  const encodedSalt = parts[3];
  const encodedHash = parts[4];
  if (!encodedParams || !encodedSalt || !encodedHash) return false;
  const params = Object.fromEntries(
    encodedParams.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key, Number(value)];
    }),
  );
  if (!params.m || !params.t || !params.p) return false;
  const salt = Buffer.from(encodedSalt, 'base64url');
  const expected = Buffer.from(encodedHash, 'base64url');
  const actual = argon2Sync('argon2id', {
    message: Buffer.from(password),
    nonce: salt,
    memory: params.m,
    passes: params.t,
    parallelism: params.p,
    tagLength: expected.length,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createAccountUser({
  pool,
  config,
  email,
  password,
  displayName,
  role,
  mfaCapable = false,
}: {
  pool: DbPool;
  config: AppConfig;
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  mfaCapable?: boolean;
}) {
  const emailNormalized = normalizeEmail(email);
  const userKey = stableKey('user', [config.accountKey, config.productKey, emailNormalized]);
  await pool.query(
    `INSERT INTO onetime.account_users
     (user_key, account_key, product_key, email_normalized, display_name, role, password_hash, mfa_capable)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (account_key, product_key, email_normalized)
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       role = EXCLUDED.role,
       password_hash = EXCLUDED.password_hash,
       password_updated_at = now(),
       mfa_capable = EXCLUDED.mfa_capable,
       security_version = onetime.account_users.security_version + 1,
       security_policy_updated_at = now(),
       status = 'active',
       updated_at = now()`,
    [
      userKey,
      config.accountKey,
      config.productKey,
      emailNormalized,
      displayName.trim(),
      role,
      hashPassword(password),
      mfaCapable,
    ],
  );
  return userKey;
}

export async function authenticateUser({
  pool,
  config,
  identifier,
  email,
  password,
  ip,
  userAgent,
  trustedDeviceToken,
}: {
  pool: DbPool;
  config: AppConfig;
  identifier?: string | undefined;
  email?: string | undefined;
  password: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
  trustedDeviceToken?: string | undefined;
}): Promise<LoginResult> {
  const loginIdentifier = normalizeLoginIdentifier(identifier ?? email ?? '');
  const identifierHash = stableKey('login_identifier', [loginIdentifier]);
  const rateLimit = await consumeRateLimitBudgets({
    pool,
    config,
    budgets: [
      {
        scope: 'login_identifier',
        subject: identifierHash,
        limit: config.loginIdentifierRateLimitMax,
        windowMs: config.loginRateLimitWindowMs,
      },
      {
        scope: 'login_ip',
        subject: ip ?? 'unknown',
        limit: config.loginIpRateLimitMax,
        windowMs: config.loginRateLimitWindowMs,
      },
      {
        scope: 'login_account_product',
        subject: `${config.accountKey}:${config.productKey}`,
        limit: config.loginAccountRateLimitMax,
        windowMs: config.loginRateLimitWindowMs,
      },
      {
        scope: 'login_global',
        subject: 'all',
        limit: config.loginGlobalRateLimitMax,
        windowMs: config.loginRateLimitWindowMs,
      },
    ],
  });
  if (!rateLimit.allowed) {
    await insertAuthAudit(pool, config, {
      eventType: 'login_rate_limited',
      success: false,
      reason: 'RATE_LIMITED',
      ip,
      userAgent,
      metadata: { identifier_hash: identifierHash, budget_scope: rateLimit.scope ?? null },
    });
    return rateLimit.retryAfterSeconds
      ? {
          ok: false,
          code: 'RATE_LIMITED',
          retry_after_seconds: rateLimit.retryAfterSeconds,
        }
      : { ok: false, code: 'RATE_LIMITED' };
  }

  if (!looksLikeEmail(loginIdentifier)) {
    const studentLogin = await authenticateStudentByUsername({
      pool,
      config,
      username: loginIdentifier,
      password,
      ip,
      userAgent,
    });
    if (studentLogin) return studentLogin;
    await insertAuthAudit(pool, config, {
      eventType: 'login_failed',
      success: false,
      reason: 'INVALID_CREDENTIALS',
      ip,
      userAgent,
      metadata: { identifier_hash: identifierHash },
    });
    return { ok: false, code: 'INVALID_CREDENTIALS' };
  }

  const emailNormalized = normalizeEmail(loginIdentifier);
  const result = await pool.query(
    `SELECT user_key, email_normalized, display_name, role, password_hash, mfa_capable, status,
            security_version
       FROM onetime.account_users
      WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3`,
    [config.accountKey, config.productKey, emailNormalized],
  );
  const row = result.rows[0];
  const valid = verifyPassword(password, row?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!valid) {
    await insertAuthAudit(pool, config, {
      eventType: 'login_failed',
      success: false,
      reason: 'INVALID_CREDENTIALS',
      ip,
      userAgent,
      metadata: { identifier_hash: identifierHash },
    });
    return { ok: false, code: 'INVALID_CREDENTIALS' };
  }

  if (row.status !== 'active') {
    await insertAuthAudit(pool, config, {
      eventType: 'login_failed',
      userKey: row.user_key,
      success: false,
      reason: 'DISABLED',
      ip,
      userAgent,
    });
    return { ok: false, code: 'DISABLED' };
  }

  if (['owner', 'admin'].includes(row.role)) {
    if (
      trustedDeviceToken &&
      (await verifyTrustedDeviceForUser({
        pool,
        config,
        userKey: row.user_key,
        trustedDeviceToken,
        userAgent,
        ip,
      }))
    ) {
      await insertAuthAudit(pool, config, {
        eventType: 'login_succeeded_trusted_device',
        userKey: row.user_key,
        success: true,
        ip,
        userAgent,
      });
      return { ok: true, user: rowToSessionUser(row), assuranceMethod: 'trusted_device' };
    }

    const challenge = await createEmailChallengeForUser({
      pool,
      config,
      userKey: row.user_key,
      emailNormalized,
      role: String(row.role),
      securityVersion: Number(row.security_version ?? 1),
      ip,
      userAgent,
    });
    if (!challenge.ok) {
      await insertAuthAudit(pool, config, {
        eventType: 'login_email_challenge_rate_limited',
        userKey: row.user_key,
        success: false,
        reason: 'RATE_LIMITED',
        ip,
        userAgent,
        metadata: { budget_scope: challenge.scope ?? null },
      });
      return challenge.retryAfterSeconds
        ? { ok: false, code: 'RATE_LIMITED', retry_after_seconds: challenge.retryAfterSeconds }
        : { ok: false, code: 'RATE_LIMITED' };
    }
    await insertAuthAudit(pool, config, {
      eventType: 'login_password_email_challenge',
      userKey: row.user_key,
      success: true,
      reason: 'EMAIL_CHALLENGE_REQUIRED',
      ip,
      userAgent,
    });
    return {
      ok: false,
      code: 'EMAIL_CHALLENGE_REQUIRED',
      challenge_token: challenge.challengeToken,
      challenge_expires_at: challenge.expiresAt,
      delivery_state: challenge.deliveryState,
    };
  }

  await insertAuthAudit(pool, config, {
    eventType: 'login_succeeded',
    userKey: row.user_key,
    success: true,
    ip,
    userAgent,
  });
  return { ok: true, user: rowToSessionUser(row) };
}

async function authenticateStudentByUsername({
  pool,
  config,
  username,
  password,
  ip,
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  username: string;
  password: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}): Promise<LoginResult | null> {
  const normalizedUsername = normalizeStudentUsername(username);
  const result = await pool.query(
    `SELECT access.access_state_key, access.learner_key, access.household_key,
            access.status AS access_status, access.credential_status,
            access.password_hash_ref,
            learners.learner_status,
            users.user_key, users.email_normalized, users.display_name, users.role,
            users.password_hash, users.mfa_capable, users.status AS user_status,
            users.security_version
       FROM onetime.portal_student_access_state AS access
       JOIN onetime.portal_learners AS learners
         ON learners.account_key = access.account_key
        AND learners.product_key = access.product_key
        AND learners.learner_key = access.learner_key
       LEFT JOIN onetime.account_users AS users
         ON users.account_key = access.account_key
        AND users.product_key = access.product_key
        AND users.user_key = access.student_user_ref
      WHERE access.account_key = $1
        AND access.product_key = $2
        AND access.normalized_username = $3
      ORDER BY access.updated_at DESC
      LIMIT 1`,
    [config.accountKey, config.productKey, normalizedUsername],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  const passwordValid = verifyStudentPasswordHashRef(
    password,
    typeof row?.password_hash_ref === 'string'
      ? row.password_hash_ref
      : DUMMY_STUDENT_PASSWORD_HASH_REF,
  );
  if (!row) return null;
  if (!passwordValid) {
    await insertAuthAudit(pool, config, {
      eventType: 'student_login_failed',
      success: false,
      reason: 'INVALID_CREDENTIALS',
      ip,
      userAgent,
      metadata: { username_digest: hashValue(normalizedUsername) },
    });
    return { ok: false, code: 'INVALID_CREDENTIALS' };
  }
  if (
    row.access_status !== 'active' ||
    row.credential_status !== 'parent_managed' ||
    row.learner_status !== 'active' ||
    row.user_status !== 'active' ||
    row.role !== 'student' ||
    !row.user_key
  ) {
    await insertAuthAudit(pool, config, {
      eventType: 'student_login_failed',
      userKey: typeof row.user_key === 'string' ? row.user_key : undefined,
      success: false,
      reason: 'DISABLED',
      ip,
      userAgent,
      metadata: { username_digest: hashValue(normalizedUsername) },
    });
    return { ok: false, code: 'DISABLED' };
  }
  await insertAuthAudit(pool, config, {
    eventType: 'student_login_succeeded',
    userKey: String(row.user_key),
    success: true,
    ip,
    userAgent,
    metadata: { username_digest: hashValue(normalizedUsername) },
  });
  return { ok: true, user: rowToSessionUser(row) };
}

export async function createSession({
  pool,
  config,
  user,
  ip,
  userAgent,
  rotatedFromSessionKey,
  assuranceMethod,
}: {
  pool: DbPool;
  config: AppConfig;
  user: SessionUser;
  ip?: string | undefined;
  userAgent?: string | undefined;
  rotatedFromSessionKey?: string | undefined;
  assuranceMethod?: AssuranceMethod | undefined;
}): Promise<CreatedSession> {
  const sessionToken = token();
  const csrfToken = token();
  const sessionKey = `sess_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const assuranceAt = new Date();
  const resolvedAssuranceMethod = assuranceMethod ?? 'password';
  const userVersion = await pool.query(
    `SELECT security_version
       FROM onetime.account_users
      WHERE account_key = $1 AND product_key = $2 AND user_key = $3`,
    [config.accountKey, config.productKey, user.user_key],
  );
  const securityVersion = Number(userVersion.rows[0]?.security_version ?? 1);
  await pool.query(
    `INSERT INTO onetime.user_sessions
     (session_key, account_key, product_key, user_key, token_hash, csrf_token_hash,
      user_agent_hash, ip_hash, expires_at, rotated_from_session_key, security_version,
      assurance_method, assurance_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      sessionKey,
      config.accountKey,
      config.productKey,
      user.user_key,
      hashValue(sessionToken),
      hashValue(csrfToken),
      userAgent ? hashValue(userAgent) : null,
      ip ? hashValue(ip) : null,
      expiresAt.toISOString(),
      rotatedFromSessionKey ?? null,
      securityVersion,
      resolvedAssuranceMethod,
      assuranceAt.toISOString(),
    ],
  );
  await insertAuthAudit(pool, config, {
    eventType: 'session_created',
    userKey: user.user_key,
    success: true,
    ip,
    userAgent,
    metadata: { session_key: sessionKey, rotated_from_session_key: rotatedFromSessionKey ?? null },
  });
  return {
    session_key: sessionKey,
    session_token: sessionToken,
    csrf_token: csrfToken,
    user,
    expires_at: expiresAt.toISOString(),
    assurance_method: resolvedAssuranceMethod,
    assurance_at: assuranceAt.toISOString(),
  };
}

export async function getSessionByToken({
  pool,
  config,
  sessionToken,
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  sessionToken?: string | undefined;
  userAgent?: string | undefined;
}): Promise<AuthenticatedSession | null> {
  if (!sessionToken) return null;
  const result = await pool.query(
    `SELECT sessions.session_key, sessions.expires_at, sessions.assurance_method,
            sessions.assurance_at,
            sessions.last_seen_at,
            users.user_key, users.email_normalized, users.display_name, users.role,
            users.mfa_capable, users.security_version
       FROM onetime.user_sessions AS sessions
       JOIN onetime.account_users AS users ON users.user_key = sessions.user_key
      WHERE sessions.account_key = $1
        AND sessions.product_key = $2
        AND sessions.token_hash = $3
        AND sessions.revoked_at IS NULL
        AND sessions.expires_at > now()
        AND sessions.security_version = users.security_version
        AND (sessions.user_agent_hash IS NULL OR sessions.user_agent_hash = $4)
        AND users.status = 'active'`,
    [
      config.accountKey,
      config.productKey,
      hashValue(sessionToken),
      userAgent ? hashValue(userAgent) : null,
    ],
  );
  const row = result.rows[0];
  if (!row) return null;
  const lastSeenAt = new Date(String(row.last_seen_at));
  if (Date.now() - lastSeenAt.getTime() >= config.sessionLastSeenWriteIntervalMs) {
    await pool.query(
      'UPDATE onetime.user_sessions SET last_seen_at = now() WHERE session_key = $1',
      [row.session_key],
    );
  }
  return {
    session_key: row.session_key,
    expires_at: toIso(row.expires_at),
    assurance_method: String(row.assurance_method ?? 'password') as AssuranceMethod,
    assurance_at: row.assurance_at ? toIso(row.assurance_at) : null,
    user: rowToSessionUser(row),
  };
}

export async function getSessionUserByKey({
  pool,
  config,
  userKey,
}: {
  pool: DbPool;
  config: AppConfig;
  userKey: string;
}): Promise<SessionUser | null> {
  const result = await pool.query(
    `SELECT user_key, email_normalized, display_name, role, mfa_capable, security_version
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND status = 'active'
      LIMIT 1`,
    [config.accountKey, config.productKey, userKey],
  );
  const row = result.rows[0];
  return row ? rowToSessionUser(row) : null;
}

export async function verifySessionCsrf({
  pool,
  sessionKey,
  csrfToken,
}: {
  pool: DbPool;
  sessionKey: string;
  csrfToken?: string;
}) {
  if (!csrfToken) return false;
  const result = await pool.query(
    `SELECT csrf_token_hash FROM onetime.user_sessions
      WHERE session_key = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [sessionKey],
  );
  const expected = result.rows[0]?.csrf_token_hash;
  return typeof expected === 'string' && expected === hashValue(csrfToken);
}

export async function rotateSessionCsrf({
  pool,
  config,
  session,
}: {
  pool: DbPool;
  config: AppConfig;
  session: AuthenticatedSession;
}) {
  const csrfToken = token();
  await pool.query(
    `UPDATE onetime.user_sessions
        SET csrf_token_hash = $1, last_seen_at = now()
      WHERE session_key = $2 AND account_key = $3 AND product_key = $4`,
    [hashValue(csrfToken), session.session_key, config.accountKey, config.productKey],
  );
  return csrfToken;
}

export async function revokeSession({
  pool,
  config,
  sessionToken,
  reason,
  ip,
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  sessionToken?: string | undefined;
  reason: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}) {
  if (!sessionToken) return null;
  return inTransaction(pool, async (client) => {
    const existing = await client.query(
      `SELECT session_key, user_key
         FROM onetime.user_sessions
        WHERE account_key = $1 AND product_key = $2 AND token_hash = $3 AND revoked_at IS NULL`,
      [config.accountKey, config.productKey, hashValue(sessionToken)],
    );
    if (!existing.rowCount) return null;
    await client.query(
      'UPDATE onetime.user_sessions SET revoked_at = now() WHERE session_key = $1',
      [existing.rows[0].session_key],
    );
    await insertAuthAudit(client, config, {
      eventType: 'session_revoked',
      userKey: existing.rows[0].user_key,
      success: true,
      reason,
      ip,
      userAgent,
      metadata: { session_key: existing.rows[0].session_key },
    });
    return existing.rows[0].session_key as string;
  });
}

export async function revokeUserSessions({
  pool,
  config,
  userKey,
  reason,
}: {
  pool: DbPool;
  config: AppConfig;
  userKey: string;
  reason: string;
}) {
  await inTransaction(pool, async (client) => {
    await client.query(
      `UPDATE onetime.user_sessions
          SET revoked_at = COALESCE(revoked_at, now())
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3 AND revoked_at IS NULL`,
      [config.accountKey, config.productKey, userKey],
    );
    await insertAuthAudit(client, config, {
      eventType: 'user_sessions_revoked',
      userKey,
      success: true,
      reason,
    });
  });
}

export async function verifyEmailChallengeCode({
  pool,
  config,
  challengeToken,
  code,
  trustDevice,
  ip,
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  challengeToken: string;
  code: string;
  trustDevice?: boolean | undefined;
  ip?: string | undefined;
  userAgent?: string | undefined;
}): Promise<LoginResult & { trustedDeviceToken?: string; trustedDeviceExpiresAt?: string }> {
  return consumeAuthEmailChallenge({
    pool,
    config,
    hashColumn: 'challenge_token_hash',
    tokenValue: challengeToken,
    code,
    trustDevice,
    assuranceMethod: 'email_challenge',
    ip,
    userAgent,
  });
}

export async function verifyEmailChallengeLink({
  pool,
  config,
  linkToken,
  trustDevice,
  ip,
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  linkToken: string;
  trustDevice?: boolean | undefined;
  ip?: string | undefined;
  userAgent?: string | undefined;
}): Promise<LoginResult & { trustedDeviceToken?: string; trustedDeviceExpiresAt?: string }> {
  return consumeAuthEmailChallenge({
    pool,
    config,
    hashColumn: 'link_token_hash',
    tokenValue: linkToken,
    trustDevice,
    assuranceMethod: 'email_link',
    ip,
    userAgent,
  });
}

export async function resendEmailChallenge({
  pool,
  config,
  challengeToken,
  ip,
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  challengeToken: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}): Promise<
  | {
      ok: true;
      challengeToken: string;
      expiresAt: string;
      deliveryState: string;
    }
  | {
      ok: false;
      code: 'INVALID_CREDENTIALS' | 'RATE_LIMITED';
      retryAfterSeconds?: number;
    }
> {
  const current = await pool.query(
    `SELECT challenges.user_key, users.email_normalized, users.role, users.security_version
       FROM onetime.auth_email_challenges AS challenges
       JOIN onetime.account_users AS users
         ON users.user_key = challenges.user_key
        AND users.account_key = challenges.account_key
        AND users.product_key = challenges.product_key
      WHERE challenges.account_key = $1
        AND challenges.product_key = $2
        AND challenges.challenge_token_hash = $3
        AND challenges.consumed_at IS NULL
        AND challenges.superseded_at IS NULL
        AND challenges.expires_at > now()
        AND users.status = 'active'
        AND users.role IN ('owner', 'admin')
      LIMIT 1`,
    [config.accountKey, config.productKey, hashValue(challengeToken)],
  );
  const row = current.rows[0];
  if (!row) return { ok: false, code: 'INVALID_CREDENTIALS' };
  const issued = await createEmailChallengeForUser({
    pool,
    config,
    userKey: String(row.user_key),
    emailNormalized: String(row.email_normalized),
    role: String(row.role),
    securityVersion: Number(row.security_version ?? 1),
    ip,
    userAgent,
    reason: 'resend',
  });
  if (!issued.ok) {
    return issued.retryAfterSeconds
      ? { ok: false, code: 'RATE_LIMITED', retryAfterSeconds: issued.retryAfterSeconds }
      : { ok: false, code: 'RATE_LIMITED' };
  }
  return issued;
}

export async function revokeTrustedDevice({
  pool,
  config,
  trustedDeviceToken,
  userKey,
}: {
  pool: DbPool;
  config: AppConfig;
  trustedDeviceToken?: string | undefined;
  userKey?: string | undefined;
}) {
  if (!trustedDeviceToken) return false;
  const result = await pool.query(
    `UPDATE onetime.auth_trusted_devices
        SET revoked_at = COALESCE(revoked_at, now())
      WHERE account_key = $1
        AND product_key = $2
        AND token_hash = $3
        AND ($4::text IS NULL OR user_key = $4)
        AND revoked_at IS NULL
      RETURNING user_key`,
    [config.accountKey, config.productKey, hashValue(trustedDeviceToken), userKey ?? null],
  );
  const revokedUserKey = result.rows[0]?.user_key;
  if (revokedUserKey) {
    await insertAuthAudit(pool, config, {
      eventType: 'trusted_device_revoked',
      userKey: String(revokedUserKey),
      success: true,
    });
  }
  return Boolean(result.rowCount);
}

export async function verifyRecentEmailAssurance({
  pool,
  sessionKey,
  maxAgeMs = EMAIL_ASSURANCE_MAX_AGE_MS,
}: {
  pool: DbPool;
  sessionKey: string;
  maxAgeMs?: number | undefined;
}) {
  const result = await pool.query(
    `SELECT assurance_method, assurance_at
       FROM onetime.user_sessions
      WHERE session_key = $1
        AND revoked_at IS NULL
        AND expires_at > now()
      LIMIT 1`,
    [sessionKey],
  );
  const row = result.rows[0];
  if (!row?.assurance_at) return false;
  const method = String(row.assurance_method ?? '');
  if (method !== 'email_challenge' && method !== 'email_link') return false;
  const assuranceAt = new Date(String(row.assurance_at));
  return Date.now() - assuranceAt.getTime() <= maxAgeMs;
}

export async function runAuthEmailChallengeDeliveryOutboxBatch(input: {
  pool: DbPool;
  config: AppConfig;
  now?: Date;
  limit?: number;
  leaseMs?: number;
  workerId?: string;
}): Promise<AuthEmailChallengeDeliveryBatchSummary> {
  const now = input.now ?? new Date();
  const expired = await expireAuthEmailChallengeDeliveries(input.pool, input.config, now);
  const claims = await claimAuthEmailChallengeDeliveries(input.pool, input.config, {
    now,
    limit: input.limit ?? EMAIL_CHALLENGE_DELIVERY_BATCH_SIZE,
    leaseMs: input.leaseMs ?? EMAIL_CHALLENGE_DELIVERY_LEASE_MS,
    workerId: input.workerId ?? `auth-email-worker-${randomUUID()}`,
  });
  const summary: AuthEmailChallengeDeliveryBatchSummary = {
    claimed: claims.length,
    sink_delivered: 0,
    provider_delivered: 0,
    expired,
    retried: 0,
    dead_lettered: 0,
    lease_lost: 0,
    external_send_performed: false,
    raw_token_logged: false,
  };
  for (const claim of claims) {
    try {
      const payload = decryptEmailChallengeDeliveryPayload(input.config, claim);
      const providerMessageRefHash = await deliverAuthEmailChallengePayload(
        input.config,
        claim,
        payload,
      );
      const completed = await completeAuthEmailChallengeDelivery(input.pool, input.config, claim, {
        state: providerMessageRefHash ? 'provider_delivered' : 'sink_delivered',
        now,
        providerMessageRefHash:
          providerMessageRefHash ?? destinationReference(`sink:${claim.delivery_key}`),
      });
      if (!completed) summary.lease_lost += 1;
      else if (providerMessageRefHash) {
        summary.provider_delivered += 1;
        summary.external_send_performed = true;
      } else summary.sink_delivered += 1;
    } catch (error) {
      const terminal = claim.attempts >= claim.max_attempts;
      const completed = await failAuthEmailChallengeDelivery(input.pool, input.config, claim, {
        state: terminal ? 'dead_letter' : 'retry',
        now,
        errorCode: safeDeliveryErrorCode(error),
      });
      if (!completed) summary.lease_lost += 1;
      else if (terminal) summary.dead_lettered += 1;
      else summary.retried += 1;
    }
  }
  return summary;
}

export function decryptAuthEmailChallengeDeliveryPayloadForTests(
  config: AppConfig,
  row: {
    nonce: string;
    ciphertext: string;
    auth_tag: string;
  },
): Record<string, unknown> {
  return decryptEmailChallengeDeliveryPayload(config, row);
}

export async function provisionTotpEnrollment({
  pool,
  config,
  userKey,
}: {
  pool: DbPool;
  config: AppConfig;
  userKey: string;
}) {
  const secret = base32Encode(randomBytes(20));
  const encrypted = encryptSecret(config, secret);
  const factorKey = `mfa_${randomUUID()}`;
  const enrollmentToken = token();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await inTransaction(pool, async (client) => {
    await client.query(
      `UPDATE onetime.mfa_factors
          SET status = 'revoked', revoked_at = now(), updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3 AND status = 'pending'`,
      [config.accountKey, config.productKey, userKey],
    );
    await client.query(
      `INSERT INTO onetime.mfa_factors
       (factor_key, account_key, product_key, user_key, factor_type, secret_ciphertext, secret_iv, secret_tag)
       VALUES ($1,$2,$3,$4,'totp',$5,$6,$7)`,
      [
        factorKey,
        config.accountKey,
        config.productKey,
        userKey,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
      ],
    );
    await client.query(
      `INSERT INTO onetime.mfa_enrollment_tokens
       (token_key, account_key, product_key, user_key, token_hash, factor_key, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        `enroll_${randomUUID()}`,
        config.accountKey,
        config.productKey,
        userKey,
        hashValue(enrollmentToken),
        factorKey,
        expiresAt.toISOString(),
      ],
    );
  });
  return { enrollmentToken, secret, factorKey, expiresAt: expiresAt.toISOString() };
}

export async function createPostActivationMfaHandoff({
  pool,
  config,
  userKey,
  enrollmentToken,
}: {
  pool: DbPool;
  config: AppConfig;
  userKey: string;
  enrollmentToken: string;
}) {
  const handoffToken = token();
  const expiresAt = new Date(Date.now() + POST_ACTIVATION_MFA_HANDOFF_TTL_MS);
  await pool.query(
    `INSERT INTO onetime.account_activation_mfa_handoffs
       (handoff_key, account_key, product_key, user_key, handoff_hash,
        mfa_enrollment_token_hash, expires_at, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [
      `handoff_${randomUUID()}`,
      config.accountKey,
      config.productKey,
      userKey,
      hashValue(handoffToken),
      hashValue(enrollmentToken),
      expiresAt.toISOString(),
      JSON.stringify({
        policy_version: 'ops03a-post-activation-mfa-v1',
        raw_token_included: false,
        recovery_codes_acknowledged: false,
      }),
    ],
  );
  await insertAuthAudit(pool, config, {
    eventType: 'post_activation_mfa_handoff_created',
    userKey,
    success: true,
    metadata: { expires_at: expiresAt.toISOString() },
  });
  return { handoffToken, expiresAt: expiresAt.toISOString() };
}

export async function consumePostActivationMfaHandoff({
  pool,
  config,
  handoffToken,
  ip,
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  handoffToken: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}): Promise<SessionUser | null> {
  return inTransaction(pool, async (client) => {
    const result = await client.query(
      `SELECT handoffs.handoff_key,
              users.user_key, users.email_normalized, users.display_name, users.role,
              users.mfa_capable, users.security_version
         FROM onetime.account_activation_mfa_handoffs AS handoffs
         JOIN onetime.account_users AS users
           ON users.user_key = handoffs.user_key
          AND users.account_key = handoffs.account_key
          AND users.product_key = handoffs.product_key
         JOIN onetime.mfa_factors AS factors
           ON factors.user_key = handoffs.user_key
          AND factors.account_key = handoffs.account_key
          AND factors.product_key = handoffs.product_key
          AND factors.status = 'active'
        WHERE handoffs.account_key = $1
          AND handoffs.product_key = $2
          AND handoffs.handoff_hash = $3
          AND handoffs.consumed_at IS NULL
          AND handoffs.expires_at > now()
          AND users.status = 'active'
          AND users.mfa_capable = true
        LIMIT 1
        FOR UPDATE`,
      [config.accountKey, config.productKey, hashValue(handoffToken)],
    );
    const row = result.rows[0];
    if (!row) return null;
    await client.query(
      `UPDATE onetime.account_activation_mfa_handoffs
          SET consumed_at = now(),
              metadata = $2::jsonb
        WHERE handoff_key = $1`,
      [
        row.handoff_key,
        JSON.stringify({
          policy_version: 'ops03a-post-activation-mfa-v1',
          recovery_codes_acknowledged: true,
        }),
      ],
    );
    await insertAuthAudit(client, config, {
      eventType: 'post_activation_mfa_handoff_consumed',
      userKey: row.user_key,
      success: true,
      ip,
      userAgent,
      metadata: { recovery_codes_acknowledged: true },
    });
    return rowToSessionUser(row);
  });
}

export async function activateTotpEnrollment({
  pool,
  config,
  enrollmentToken,
  code,
}: {
  pool: DbPool;
  config: AppConfig;
  enrollmentToken: string;
  code: string;
}): Promise<false | { recovery_codes: string[] }> {
  return inTransaction(pool, async (client) => {
    const result = await client.query(
      `SELECT tokens.token_key, tokens.user_key, factors.factor_key,
              factors.secret_ciphertext, factors.secret_iv, factors.secret_tag
         FROM onetime.mfa_enrollment_tokens AS tokens
         JOIN onetime.mfa_factors AS factors ON factors.factor_key = tokens.factor_key
        WHERE tokens.account_key = $1
          AND tokens.product_key = $2
          AND tokens.token_hash = $3
          AND tokens.used_at IS NULL
          AND tokens.expires_at > now()
          AND factors.status = 'pending'
        FOR UPDATE`,
      [config.accountKey, config.productKey, hashValue(enrollmentToken)],
    );
    const row = result.rows[0];
    if (!row) return false;
    const secret = decryptSecret(config, row);
    const verified = verifyTotpCode(secret, code);
    if (!verified.ok) return false;
    await client.query(
      `UPDATE onetime.mfa_factors
          SET status = 'active', activated_at = now(), updated_at = now(), last_used_step = NULL
        WHERE factor_key = $1`,
      [row.factor_key],
    );
    await client.query(
      'UPDATE onetime.mfa_enrollment_tokens SET used_at = now() WHERE token_key = $1',
      [row.token_key],
    );
    await client.query(
      `UPDATE onetime.account_users
          SET security_version = security_version + 1,
              mfa_capable = true,
              security_policy_updated_at = now(),
              updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3`,
      [config.accountKey, config.productKey, row.user_key],
    );
    await client.query(
      `UPDATE onetime.user_sessions
          SET revoked_at = COALESCE(revoked_at, now())
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3 AND revoked_at IS NULL`,
      [config.accountKey, config.productKey, row.user_key],
    );
    const recoveryCodes = await replaceRecoveryCodes(client, config, row.user_key);
    await insertAuthAudit(client, config, {
      eventType: 'mfa_totp_activated',
      userKey: row.user_key,
      success: true,
      metadata: { recovery_code_count: recoveryCodes.length },
    });
    return { recovery_codes: recoveryCodes };
  });
}

export async function verifyMfaChallenge({
  pool,
  config,
  challengeToken,
  code,
  ip,
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  challengeToken: string;
  code: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}): Promise<LoginResult> {
  return inTransaction(pool, async (client) => {
    const result = await client.query(
      `SELECT challenges.challenge_key, challenges.user_key, challenges.attempts,
              users.email_normalized, users.display_name, users.role, users.mfa_capable, users.status,
              users.security_version,
              factors.factor_key, factors.secret_ciphertext, factors.secret_iv, factors.secret_tag,
              factors.last_used_step
         FROM onetime.mfa_challenges AS challenges
         JOIN onetime.account_users AS users ON users.user_key = challenges.user_key
         JOIN onetime.mfa_factors AS factors
           ON factors.user_key = users.user_key
          AND factors.account_key = challenges.account_key
          AND factors.product_key = challenges.product_key
          AND factors.status = 'active'
        WHERE challenges.account_key = $1
          AND challenges.product_key = $2
          AND challenges.challenge_hash = $3
          AND challenges.consumed_at IS NULL
          AND challenges.expires_at > now()
          AND users.status = 'active'
        FOR UPDATE`,
      [config.accountKey, config.productKey, hashValue(challengeToken)],
    );
    const row = result.rows[0];
    if (!row) return { ok: false, code: 'INVALID_CREDENTIALS' };
    if (Number(row.attempts) >= 5) return { ok: false, code: 'RATE_LIMITED' };
    const secret = decryptSecret(config, row);
    const verified = verifyTotpCode(secret, code);
    if (
      !verified.ok ||
      (row.last_used_step !== null && verified.step <= Number(row.last_used_step))
    ) {
      await client.query(
        'UPDATE onetime.mfa_challenges SET attempts = attempts + 1 WHERE challenge_key = $1',
        [row.challenge_key],
      );
      await insertAuthAudit(client, config, {
        eventType: 'mfa_challenge_failed',
        userKey: row.user_key,
        success: false,
        reason: 'INVALID_CREDENTIALS',
        ip,
        userAgent,
      });
      return { ok: false, code: 'INVALID_CREDENTIALS' };
    }
    await client.query(
      'UPDATE onetime.mfa_challenges SET consumed_at = now() WHERE challenge_key = $1',
      [row.challenge_key],
    );
    await client.query(
      'UPDATE onetime.mfa_factors SET last_used_step = $2, updated_at = now() WHERE factor_key = $1',
      [row.factor_key, verified.step],
    );
    await insertAuthAudit(client, config, {
      eventType: 'mfa_challenge_succeeded',
      userKey: row.user_key,
      success: true,
      ip,
      userAgent,
    });
    return { ok: true, user: rowToSessionUser(row) };
  });
}

export async function verifyMfaRecoveryChallenge({
  pool,
  config,
  challengeToken,
  recoveryCode,
  ip,
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  challengeToken: string;
  recoveryCode: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}): Promise<LoginResult> {
  return inTransaction(pool, async (client) => {
    const result = await client.query(
      `SELECT challenges.challenge_key, challenges.user_key, challenges.attempts,
              users.email_normalized, users.display_name, users.role, users.mfa_capable, users.status,
              users.security_version
         FROM onetime.mfa_challenges AS challenges
         JOIN onetime.account_users AS users ON users.user_key = challenges.user_key
         JOIN onetime.mfa_factors AS factors
           ON factors.user_key = users.user_key
          AND factors.account_key = challenges.account_key
          AND factors.product_key = challenges.product_key
          AND factors.status = 'active'
        WHERE challenges.account_key = $1
          AND challenges.product_key = $2
          AND challenges.challenge_hash = $3
          AND challenges.consumed_at IS NULL
          AND challenges.expires_at > now()
          AND users.status = 'active'
        FOR UPDATE`,
      [config.accountKey, config.productKey, hashValue(challengeToken)],
    );
    const row = result.rows[0];
    if (!row) return { ok: false, code: 'INVALID_CREDENTIALS' };
    if (Number(row.attempts) >= 5) return { ok: false, code: 'RATE_LIMITED' };

    const recovery = await client.query(
      `SELECT code_key
         FROM onetime.mfa_recovery_codes
        WHERE account_key = $1
          AND product_key = $2
          AND user_key = $3
          AND code_hash = $4
          AND used_at IS NULL
        FOR UPDATE`,
      [
        config.accountKey,
        config.productKey,
        row.user_key,
        recoveryCodeHash(config, row.user_key, recoveryCode),
      ],
    );
    const codeKey = recovery.rows[0]?.code_key as string | undefined;
    if (!codeKey) {
      await client.query(
        'UPDATE onetime.mfa_challenges SET attempts = attempts + 1 WHERE challenge_key = $1',
        [row.challenge_key],
      );
      await insertAuthAudit(client, config, {
        eventType: 'mfa_recovery_failed',
        userKey: row.user_key,
        success: false,
        reason: 'INVALID_CREDENTIALS',
        ip,
        userAgent,
      });
      return { ok: false, code: 'INVALID_CREDENTIALS' };
    }

    await client.query(
      'UPDATE onetime.mfa_recovery_codes SET used_at = now() WHERE code_key = $1',
      [codeKey],
    );
    await client.query(
      'UPDATE onetime.mfa_challenges SET consumed_at = now() WHERE challenge_key = $1',
      [row.challenge_key],
    );
    await insertAuthAudit(client, config, {
      eventType: 'mfa_recovery_succeeded',
      userKey: row.user_key,
      success: true,
      ip,
      userAgent,
    });
    return { ok: true, user: rowToSessionUser(row) };
  });
}

export async function replaceMfaRecoveryCodes({
  pool,
  config,
  userKey,
}: {
  pool: DbPool;
  config: AppConfig;
  userKey: string;
}) {
  return inTransaction(pool, async (client) => {
    const recoveryCodes = await replaceRecoveryCodes(client, config, userKey);
    await client.query(
      `UPDATE onetime.account_users
          SET security_version = security_version + 1,
              security_policy_updated_at = now(),
              updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3`,
      [config.accountKey, config.productKey, userKey],
    );
    await client.query(
      `UPDATE onetime.user_sessions
          SET revoked_at = COALESCE(revoked_at, now())
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3 AND revoked_at IS NULL`,
      [config.accountKey, config.productKey, userKey],
    );
    await insertAuthAudit(client, config, {
      eventType: 'mfa_recovery_replaced',
      userKey,
      success: true,
      metadata: { recovery_code_count: recoveryCodes.length },
    });
    return recoveryCodes;
  });
}

export async function revokeMfaFactors({
  pool,
  config,
  userKey,
}: {
  pool: DbPool;
  config: AppConfig;
  userKey: string;
}) {
  await inTransaction(pool, async (client) => {
    await client.query(
      `UPDATE onetime.mfa_factors
          SET status = 'revoked', revoked_at = COALESCE(revoked_at, now()), updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3 AND status <> 'revoked'`,
      [config.accountKey, config.productKey, userKey],
    );
    await client.query(
      `UPDATE onetime.mfa_recovery_codes
          SET used_at = COALESCE(used_at, now())
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3 AND used_at IS NULL`,
      [config.accountKey, config.productKey, userKey],
    );
    await client.query(
      `UPDATE onetime.account_users
          SET security_version = security_version + 1,
              mfa_capable = false,
              security_policy_updated_at = now(),
              updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3`,
      [config.accountKey, config.productKey, userKey],
    );
    await client.query(
      `UPDATE onetime.user_sessions
          SET revoked_at = COALESCE(revoked_at, now())
        WHERE account_key = $1 AND product_key = $2 AND user_key = $3 AND revoked_at IS NULL`,
      [config.accountKey, config.productKey, userKey],
    );
    await insertAuthAudit(client, config, {
      eventType: 'mfa_revoked',
      userKey,
      success: true,
    });
  });
}

export function canEditContacts(role: UserRole) {
  return role === 'owner' || role === 'admin' || role === 'crm_agent';
}

export function canAssignContacts(role: UserRole) {
  return role === 'owner' || role === 'admin';
}

export function createLoginCsrf(config: AppConfig) {
  const csrfCookie = token();
  return { csrf_cookie: csrfCookie, csrf_token: csrfProof(config, 'login', csrfCookie) };
}

export function verifyLoginCsrf(
  config: AppConfig,
  csrfCookie?: string | undefined,
  submitted?: string | undefined,
) {
  return Boolean(
    csrfCookie && submitted && verifyCsrfProof(config, 'login', csrfCookie, submitted),
  );
}

export function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function insertAuthAudit(
  target: DbPool | Queryable,
  config: AppConfig,
  event: {
    eventType: string;
    userKey?: string | undefined;
    success: boolean;
    reason?: string | undefined;
    ip?: string | undefined;
    userAgent?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  },
) {
  await target.query(
    `INSERT INTO onetime.auth_audit_events
     (event_key, account_key, product_key, user_key, event_type, success, reason,
      ip_hash, user_agent_hash, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [
      stableKey('auth_audit', [
        config.accountKey,
        config.productKey,
        event.eventType,
        event.userKey ?? 'anonymous',
        randomUUID(),
      ]),
      config.accountKey,
      config.productKey,
      event.userKey ?? null,
      event.eventType,
      event.success,
      event.reason ?? null,
      event.ip ? hashValue(event.ip) : null,
      event.userAgent ? hashValue(event.userAgent) : null,
      JSON.stringify(event.metadata ?? {}),
    ],
  );
}

function rowToSessionUser(row: Record<string, unknown>): SessionUser {
  const role = row.role as UserRole;
  const emailNormalized = String(row.email_normalized);
  return {
    user_key: String(row.user_key),
    email: emailNormalized.startsWith('student:')
      ? emailNormalized.slice('student:'.length)
      : emailNormalized,
    display_name: String(row.display_name),
    role,
    role_label: roleDisplayLabel[role],
    mfa_capable: Boolean(row.mfa_capable),
  };
}

function normalizeLoginIdentifier(value: string) {
  return value.trim().toLowerCase();
}

function looksLikeEmail(value: string) {
  return value.includes('@');
}

function verifyStudentPasswordHashRef(password: string, storedHashRef: string) {
  const parts = storedHashRef.split(':');
  if (parts.length !== 4 || parts[0] !== 'scrypt' || parts[1] !== 'v1') {
    scryptSync(password, 'invalid-student-password-ref', 32);
    return false;
  }
  const [, , salt, encodedHash] = parts;
  if (!salt || !encodedHash) {
    scryptSync(password, 'invalid-student-password-ref', 32);
    return false;
  }
  const expected = Buffer.from(encodedHash, 'base64url');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function studentPasswordHashRefForTestsOnly(password: string) {
  const salt = 'dummy-student-password-salt-v1';
  const derived = scryptSync(password, salt, 32).toString('base64url');
  return `scrypt:v1:${salt}:${derived}`;
}

function token() {
  return randomBytes(32).toString('base64url');
}

function csrfProof(config: AppConfig, scope: string, csrfCookie: string) {
  const nonce = token();
  const signature = createHmac('sha256', config.authCsrfSecret)
    .update([scope, csrfCookie, nonce].join('\0'))
    .digest('base64url');
  return `${nonce}.${signature}`;
}

function verifyCsrfProof(config: AppConfig, scope: string, csrfCookie: string, submitted: string) {
  const [nonce, signature, extra] = submitted.split('.');
  if (!nonce || !signature || extra !== undefined) return false;
  const expected = createHmac('sha256', config.authCsrfSecret)
    .update([scope, csrfCookie, nonce].join('\0'))
    .digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

async function replaceRecoveryCodes(client: Queryable, config: AppConfig, userKey: string) {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => recoveryCode());
  await client.query(
    `UPDATE onetime.mfa_recovery_codes
        SET used_at = COALESCE(used_at, now())
      WHERE account_key = $1 AND product_key = $2 AND user_key = $3 AND used_at IS NULL`,
    [config.accountKey, config.productKey, userKey],
  );
  for (const code of codes) {
    await client.query(
      `INSERT INTO onetime.mfa_recovery_codes
       (code_key, account_key, product_key, user_key, code_hash)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        `mfarec_${randomUUID()}`,
        config.accountKey,
        config.productKey,
        userKey,
        recoveryCodeHash(config, userKey, code),
      ],
    );
  }
  return codes;
}

function recoveryCode() {
  let value = '';
  while (value.length < 12) {
    value += randomBytes(10)
      .toString('base64url')
      .replace(/[^a-zA-Z0-9]/g, '');
  }
  return value.slice(0, 12).toUpperCase();
}

function recoveryCodeHash(config: AppConfig, userKey: unknown, code: string) {
  return createHash('sha256')
    .update(
      [config.accountKey, config.productKey, String(userKey), code.trim().toUpperCase()].join(':'),
    )
    .digest('hex');
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

type EmailChallengeIssueResult =
  | {
      ok: true;
      challengeToken: string;
      expiresAt: string;
      deliveryState: string;
    }
  | {
      ok: false;
      retryAfterSeconds?: number;
      scope?: string;
    };

type AuthEmailChallengeDeliveryClaim = {
  id: string;
  delivery_key: string;
  challenge_key: string;
  purpose: string;
  destination_email: string;
  nonce: string;
  ciphertext: string;
  auth_tag: string;
  attempts: number;
  max_attempts: number;
  lease_expires_at: Date;
  encrypted_payload_expires_at: Date;
};

async function createEmailChallengeForUser({
  pool,
  config,
  userKey,
  emailNormalized,
  role,
  securityVersion,
  ip,
  userAgent,
  reason = 'login',
}: {
  pool: DbPool;
  config: AppConfig;
  userKey: string;
  emailNormalized: string;
  role: string;
  securityVersion: number;
  ip?: string | undefined;
  userAgent?: string | undefined;
  reason?: 'login' | 'resend';
}): Promise<EmailChallengeIssueResult> {
  const emailHash = stableKey('email', [emailNormalized]);
  const rateLimit = await consumeRateLimitBudgets({
    pool,
    config,
    budgets: [
      {
        scope: 'login_email_challenge_user',
        subject: userKey,
        limit: config.loginIdentifierRateLimitMax,
        windowMs: config.loginRateLimitWindowMs,
      },
      {
        scope: 'login_email_challenge_identifier',
        subject: emailHash,
        limit: config.loginIdentifierRateLimitMax,
        windowMs: config.loginRateLimitWindowMs,
      },
      {
        scope: 'login_email_challenge_ip',
        subject: ip ?? 'unknown',
        limit: config.loginIpRateLimitMax,
        windowMs: config.loginRateLimitWindowMs,
      },
      {
        scope: 'login_email_challenge_account_product',
        subject: `${config.accountKey}:${config.productKey}`,
        limit: config.loginAccountRateLimitMax,
        windowMs: config.loginRateLimitWindowMs,
      },
    ],
  });
  if (!rateLimit.allowed) {
    return {
      ok: false,
      ...(rateLimit.retryAfterSeconds ? { retryAfterSeconds: rateLimit.retryAfterSeconds } : {}),
      ...(rateLimit.scope ? { scope: rateLimit.scope } : {}),
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_CHALLENGE_TTL_MS);
  const challengeToken = token();
  const linkToken = token();
  const code = emailChallengeCode();
  const challengeKey = `email_challenge_${randomUUID()}`;
  const destinationRef = destinationReference(emailNormalized);

  return inTransaction(pool, async (client) => {
    const superseded = await client.query(
      `UPDATE onetime.auth_email_challenges
          SET superseded_at = $5
        WHERE account_key = $1
          AND product_key = $2
          AND user_key = $3
          AND challenge_key <> $4
          AND consumed_at IS NULL
          AND superseded_at IS NULL
        RETURNING challenge_key`,
      [config.accountKey, config.productKey, userKey, challengeKey, now],
    );
    for (const row of superseded.rows) {
      await client.query(
        `UPDATE onetime.auth_email_challenge_delivery_outbox
            SET state = 'superseded',
                nonce = NULL,
                ciphertext = NULL,
                auth_tag = NULL,
                cleared_at = $4,
                updated_at = $4
          WHERE account_key = $1
            AND product_key = $2
            AND challenge_key = $3
            AND state IN ('queued', 'leased', 'retry', 'provider_off')`,
        [config.accountKey, config.productKey, String(row.challenge_key), now],
      );
    }
    await client.query(
      `INSERT INTO onetime.auth_email_challenges
         (challenge_key, account_key, product_key, user_key, challenge_token_hash,
          link_token_hash, code_hash, destination_ref, security_version, expires_at,
          ip_hash, user_agent_hash, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
      [
        challengeKey,
        config.accountKey,
        config.productKey,
        userKey,
        hashValue(challengeToken),
        hashValue(linkToken),
        emailCodeHash(config, userKey, code),
        destinationRef,
        securityVersion,
        expiresAt,
        ip ? hashValue(ip) : null,
        userAgent ? hashValue(userAgent) : null,
        JSON.stringify({
          policy_version: 'ops03b-email-step-up-v1',
          reason,
          target_role: role,
          raw_code_included: false,
          raw_token_included: false,
        }),
      ],
    );
    const delivery = await createAuthEmailChallengeDeliveryOutbox(client, config, {
      challengeKey,
      code,
      linkToken,
      recipientEmail: emailNormalized,
      targetRole: role,
      destinationRef,
      expiresAt,
      now,
    });
    await insertAuthAudit(client, config, {
      eventType: 'auth_email_challenge_created',
      userKey,
      success: true,
      ip,
      userAgent,
      metadata: {
        delivery_state: delivery.state,
        expires_at: expiresAt.toISOString(),
        raw_code_included: false,
        raw_token_included: false,
      },
    });
    return {
      ok: true,
      challengeToken,
      expiresAt: expiresAt.toISOString(),
      deliveryState: delivery.state,
    };
  });
}

async function consumeAuthEmailChallenge({
  pool,
  config,
  hashColumn,
  tokenValue,
  code,
  trustDevice,
  assuranceMethod,
  ip,
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  hashColumn: 'challenge_token_hash' | 'link_token_hash';
  tokenValue: string;
  code?: string | undefined;
  trustDevice?: boolean | undefined;
  assuranceMethod: 'email_challenge' | 'email_link';
  ip?: string | undefined;
  userAgent?: string | undefined;
}): Promise<LoginResult & { trustedDeviceToken?: string; trustedDeviceExpiresAt?: string }> {
  return inTransaction(pool, async (client) => {
    const result = await client.query(
      `SELECT challenges.challenge_key, challenges.user_key, challenges.code_hash,
              challenges.attempts, challenges.max_attempts, challenges.security_version,
              users.email_normalized, users.display_name, users.role, users.mfa_capable,
              users.status, users.security_version AS user_security_version
         FROM onetime.auth_email_challenges AS challenges
         JOIN onetime.account_users AS users
           ON users.user_key = challenges.user_key
          AND users.account_key = challenges.account_key
          AND users.product_key = challenges.product_key
        WHERE challenges.account_key = $1
          AND challenges.product_key = $2
          AND challenges.${hashColumn} = $3
          AND challenges.consumed_at IS NULL
          AND challenges.superseded_at IS NULL
          AND challenges.expires_at > now()
          AND users.status = 'active'
          AND users.role IN ('owner', 'admin')
          AND users.security_version = challenges.security_version
        LIMIT 1
        FOR UPDATE`,
      [config.accountKey, config.productKey, hashValue(tokenValue)],
    );
    const row = result.rows[0];
    if (!row) return { ok: false, code: 'INVALID_CREDENTIALS' };
    const attempts = Number(row.attempts ?? 0);
    const maxAttempts = Number(row.max_attempts ?? 5);
    if (attempts >= maxAttempts) return { ok: false, code: 'RATE_LIMITED' };
    if (hashColumn === 'challenge_token_hash') {
      const submitted = String(code ?? '').trim();
      if (
        !/^\d{6}$/.test(submitted) ||
        emailCodeHash(config, row.user_key, submitted) !== row.code_hash
      ) {
        await client.query(
          'UPDATE onetime.auth_email_challenges SET attempts = attempts + 1 WHERE challenge_key = $1',
          [row.challenge_key],
        );
        await insertAuthAudit(client, config, {
          eventType: 'auth_email_challenge_failed',
          userKey: row.user_key,
          success: false,
          reason: 'INVALID_CREDENTIALS',
          ip,
          userAgent,
        });
        return attempts + 1 >= maxAttempts
          ? { ok: false, code: 'RATE_LIMITED' }
          : { ok: false, code: 'INVALID_CREDENTIALS' };
      }
    }

    await client.query(
      'UPDATE onetime.auth_email_challenges SET consumed_at = now() WHERE challenge_key = $1',
      [row.challenge_key],
    );
    let trustedDevice: { token: string; expiresAt: string } | null = null;
    if (trustDevice) {
      trustedDevice = await createTrustedDeviceForUser(client, config, {
        userKey: String(row.user_key),
        securityVersion: Number(row.user_security_version ?? row.security_version ?? 1),
        ip,
        userAgent,
      });
    }
    await insertAuthAudit(client, config, {
      eventType:
        assuranceMethod === 'email_link'
          ? 'auth_email_link_succeeded'
          : 'auth_email_challenge_succeeded',
      userKey: row.user_key,
      success: true,
      ip,
      userAgent,
      metadata: { trusted_device_created: Boolean(trustedDevice) },
    });
    return {
      ok: true,
      user: rowToSessionUser(row),
      assuranceMethod,
      ...(trustedDevice
        ? {
            trustedDeviceToken: trustedDevice.token,
            trustedDeviceExpiresAt: trustedDevice.expiresAt,
          }
        : {}),
    };
  });
}

async function verifyTrustedDeviceForUser({
  pool,
  config,
  userKey,
  trustedDeviceToken,
  userAgent,
  ip,
}: {
  pool: DbPool;
  config: AppConfig;
  userKey: string;
  trustedDeviceToken: string;
  userAgent?: string | undefined;
  ip?: string | undefined;
}) {
  const result = await pool.query(
    `SELECT devices.device_key
       FROM onetime.auth_trusted_devices AS devices
       JOIN onetime.account_users AS users
         ON users.user_key = devices.user_key
        AND users.account_key = devices.account_key
        AND users.product_key = devices.product_key
      WHERE devices.account_key = $1
        AND devices.product_key = $2
        AND devices.user_key = $3
        AND devices.token_hash = $4
        AND devices.revoked_at IS NULL
        AND devices.trusted_until > now()
        AND devices.security_version = users.security_version
        AND users.status = 'active'
        AND users.role IN ('owner', 'admin')
        AND (devices.user_agent_hash IS NULL OR devices.user_agent_hash = $5)
      LIMIT 1`,
    [
      config.accountKey,
      config.productKey,
      userKey,
      hashValue(trustedDeviceToken),
      userAgent ? hashValue(userAgent) : null,
    ],
  );
  const deviceKey = result.rows[0]?.device_key;
  if (!deviceKey) return false;
  await pool.query(
    `UPDATE onetime.auth_trusted_devices
        SET last_used_at = now()
      WHERE device_key = $1`,
    [deviceKey],
  );
  await insertAuthAudit(pool, config, {
    eventType: 'trusted_device_accepted',
    userKey,
    success: true,
    ip,
    userAgent,
  });
  return true;
}

async function createTrustedDeviceForUser(
  client: Queryable,
  config: AppConfig,
  input: {
    userKey: string;
    securityVersion: number;
    ip?: string | undefined;
    userAgent?: string | undefined;
  },
) {
  const deviceToken = token();
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_MS);
  await client.query(
    `INSERT INTO onetime.auth_trusted_devices
       (device_key, account_key, product_key, user_key, token_hash, user_agent_hash,
        ip_hash, security_version, trusted_until, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [
      `trusted_device_${randomUUID()}`,
      config.accountKey,
      config.productKey,
      input.userKey,
      hashValue(deviceToken),
      input.userAgent ? hashValue(input.userAgent) : null,
      input.ip ? hashValue(input.ip) : null,
      input.securityVersion,
      expiresAt,
      JSON.stringify({
        policy_version: 'ops03b-trusted-device-v1',
        raw_token_included: false,
      }),
    ],
  );
  return { token: deviceToken, expiresAt: expiresAt.toISOString() };
}

async function createAuthEmailChallengeDeliveryOutbox(
  client: Queryable,
  config: AppConfig,
  input: {
    challengeKey: string;
    code: string;
    linkToken: string;
    recipientEmail: string;
    targetRole: string;
    destinationRef: string;
    expiresAt: Date;
    now: Date;
  },
) {
  const deliveryKey = stableKey('auth_email_challenge_delivery_outbox', [
    config.accountKey,
    config.productKey,
    input.challengeKey,
  ]);
  const encrypted = encryptEmailChallengeDeliveryPayload(config, {
    schema_version: 1,
    purpose: 'owner_admin_login_step_up',
    challenge_key: input.challengeKey,
    code: input.code,
    login_url: emailChallengeUrl(config, input.linkToken),
    fragment_parameter: 'email_challenge_token',
    target_role: input.targetRole,
    issued_at: input.now.toISOString(),
    expires_at: input.expiresAt.toISOString(),
  });
  await client.query(
    `INSERT INTO onetime.auth_email_challenge_delivery_outbox
       (delivery_key, account_key, product_key, challenge_key, purpose, channel,
        transport_mode, destination_ref, key_id, key_version, nonce, ciphertext, auth_tag,
        encrypted_payload_expires_at, state, attempts, max_attempts, next_attempt_at,
        idempotency_key, metadata, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'owner_admin_login_step_up','email','sink',$5,$6,$7,$8,$9,$10,$11,
        'queued',0,5,$12,$13,$14::jsonb,$15,$15)`,
    [
      deliveryKey,
      config.accountKey,
      config.productKey,
      input.challengeKey,
      input.destinationRef,
      config.lifecycleDeliveryKeyId,
      EMAIL_CHALLENGE_DELIVERY_KEY_VERSION,
      encrypted.nonce,
      encrypted.ciphertext,
      encrypted.authTag,
      input.expiresAt,
      input.now,
      input.challengeKey,
      JSON.stringify({
        policy_version: 'ops03b-auth-email-challenge-delivery-v1',
        raw_code_included: false,
        raw_token_included: false,
        raw_url_included: false,
        destination_ref: input.destinationRef,
      }),
      input.now,
    ],
  );
  return { deliveryKey, state: 'queued' };
}

function encryptEmailChallengeDeliveryPayload(config: AppConfig, payload: Record<string, unknown>) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', emailChallengeDeliveryKey(config), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return {
    nonce: nonce.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    authTag: cipher.getAuthTag().toString('base64url'),
  };
}

function decryptEmailChallengeDeliveryPayload(
  config: AppConfig,
  row: { nonce: string; ciphertext: string; auth_tag: string },
): Record<string, unknown> {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    emailChallengeDeliveryKey(config),
    Buffer.from(row.nonce, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64url'));
  const text = Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Auth email challenge payload did not decrypt to an object.');
  }
  return parsed as Record<string, unknown>;
}

function emailChallengeDeliveryKey(config: AppConfig) {
  if (!config.lifecycleDeliveryKey) {
    throw new Error(
      'ONE_TIME_LIFECYCLE_DELIVERY_KEY is required for auth email challenge delivery.',
    );
  }
  return createHash('sha256').update(config.lifecycleDeliveryKey).digest();
}

async function deliverAuthEmailChallengePayload(
  config: AppConfig,
  claim: AuthEmailChallengeDeliveryClaim,
  payload: Record<string, unknown>,
): Promise<string | null> {
  if (!config.deliveryProviderTransportEnabled && !config.resendTransportEnabled) return null;
  if (!config.deliveryProviderTransportEnabled || !config.resendTransportEnabled) {
    throw new Error('auth_email_resend_transport_not_fully_enabled');
  }
  if (!config.resendApiKey) throw new Error('auth_email_resend_api_key_missing');
  if (!config.emailFrom) throw new Error('auth_email_from_missing');
  if (config.lifecycleEmailMode === 'canary') {
    const canary = config.deliveryTestCanaryEmail;
    if (!canary) throw new Error('auth_email_canary_email_missing');
    if (claim.destination_email.toLowerCase() !== canary) {
      throw new Error('auth_email_canary_destination_not_authorized');
    }
  } else if (config.lifecycleEmailMode === 'transactional') {
    assertTransactionalAuthEmailReady(config);
  } else {
    return null;
  }
  const code = requiredPayloadString(payload, 'code');
  const loginUrl = requiredPayloadString(payload, 'login_url');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `${claim.delivery_key}:${claim.attempts}`,
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [claim.destination_email],
      ...(config.emailReplyTo ? { reply_to: [config.emailReplyTo] } : {}),
      subject: 'Your One Time login code',
      text: authEmailChallengeText(code, loginUrl),
      html: authEmailChallengeHtml(code, loginUrl),
      tags: [
        { name: 'message_key', value: 'account_owner_admin_login_step_up' },
        { name: 'purpose', value: 'owner_admin_login_step_up' },
      ],
    }),
  });
  if (!response.ok) throw new Error(`auth_email_resend_http_${response.status}`);
  const body = (await response.json().catch(() => ({}))) as { id?: unknown };
  const messageId = typeof body.id === 'string' && body.id ? body.id : `status_${response.status}`;
  return destinationReference(`resend:${messageId}`);
}

function assertTransactionalAuthEmailReady(config: AppConfig) {
  if (config.oneTimeRuntimeEnvironment !== 'production') {
    throw new Error('auth_email_transactional_requires_production_runtime');
  }
  if (!config.deliveryProviderAuthorizationId) {
    throw new Error('auth_email_transactional_authorization_missing');
  }
  if (!config.lifecycleDeliveryKeyConfigured) {
    throw new Error('auth_email_transactional_key_missing');
  }
  if (!config.resendWebhookEnabled || !config.resendWebhookSecretConfigured) {
    throw new Error('auth_email_transactional_webhook_missing');
  }
  if (!config.emailReplyTo) throw new Error('auth_email_transactional_reply_to_missing');
  if (normalizedAddress(config.emailFrom) !== TRANSACTIONAL_AUTH_EMAIL_SENDER) {
    throw new Error('auth_email_transactional_sender_mismatch');
  }
  if (config.deliveryProviderPerRunBudget <= 0 || config.deliveryProviderPerProviderBudget <= 0) {
    throw new Error('auth_email_transactional_budget_missing');
  }
}

function authEmailChallengeText(code: string, loginUrl: string) {
  return [
    'Hello,',
    '',
    `Your One Time login code is ${code}.`,
    '',
    'You can also finish login with this secure link:',
    loginUrl,
    '',
    'This code expires in 10 minutes. If you did not request it, ignore this email.',
    '',
    '- One Time Mishnayos',
  ].join('\n');
}

function authEmailChallengeHtml(code: string, loginUrl: string) {
  const safeUrl = escapeHtml(loginUrl);
  return [
    '<p>Hello,</p>',
    `<p>Your One Time login code is <strong>${escapeHtml(code)}</strong>.</p>`,
    `<p>You can also <a href="${safeUrl}">finish login with this secure link</a>.</p>`,
    '<p>This code expires in 10 minutes. If you did not request it, ignore this email.</p>',
    '<p>- One Time Mishnayos</p>',
  ].join('');
}

function normalizedAddress(value?: string) {
  const trimmed = value?.trim().toLowerCase() ?? '';
  return trimmed.match(/<([^<>]+)>/)?.[1]?.trim() ?? trimmed;
}

async function expireAuthEmailChallengeDeliveries(pool: DbPool, config: AppConfig, now: Date) {
  const result = await pool.query(
    `UPDATE onetime.auth_email_challenge_delivery_outbox
        SET state = 'expired',
            nonce = NULL,
            ciphertext = NULL,
            auth_tag = NULL,
            cleared_at = $3,
            updated_at = $3
      WHERE account_key = $1
        AND product_key = $2
        AND state IN ('queued', 'leased', 'retry', 'provider_off')
        AND encrypted_payload_expires_at <= $3
      RETURNING delivery_key`,
    [config.accountKey, config.productKey, now],
  );
  return result.rowCount ?? 0;
}

async function claimAuthEmailChallengeDeliveries(
  pool: DbPool,
  config: AppConfig,
  input: { now: Date; limit: number; leaseMs: number; workerId: string },
) {
  return inTransaction(pool, async (client) => {
    const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);
    const lockClause = isMemoryPool(pool) ? '' : 'FOR UPDATE SKIP LOCKED';
    const selected = await client.query(
      `SELECT outbox.id, users.email_normalized AS destination_email
         FROM onetime.auth_email_challenge_delivery_outbox AS outbox
         JOIN onetime.auth_email_challenges AS challenges
           ON challenges.account_key = outbox.account_key
          AND challenges.product_key = outbox.product_key
          AND challenges.challenge_key = outbox.challenge_key
         JOIN onetime.account_users AS users
           ON users.user_key = challenges.user_key
          AND users.account_key = challenges.account_key
          AND users.product_key = challenges.product_key
        WHERE outbox.account_key = $1
          AND outbox.product_key = $2
          AND outbox.transport_mode = 'sink'
          AND outbox.encrypted_payload_expires_at > $3::timestamptz
          AND (
            (outbox.state IN ('queued', 'retry') AND outbox.next_attempt_at <= $3::timestamptz)
            OR (outbox.state = 'leased' AND outbox.lease_expires_at <= $3::timestamptz)
          )
        ORDER BY outbox.next_attempt_at ASC, outbox.created_at ASC, outbox.id ASC
        LIMIT $4
        ${lockClause}`,
      [config.accountKey, config.productKey, input.now, input.limit],
    );
    const claims: AuthEmailChallengeDeliveryClaim[] = [];
    for (const row of selected.rows) {
      const updated = await client.query(
        `UPDATE onetime.auth_email_challenge_delivery_outbox
            SET state = 'leased',
                attempts = attempts + 1,
                lease_owner = $5,
                lease_expires_at = $6::timestamptz,
                updated_at = $4::timestamptz
          WHERE id = $1
            AND account_key = $2
            AND product_key = $3
          RETURNING id, delivery_key, challenge_key, purpose, nonce, ciphertext, auth_tag,
                    attempts, max_attempts, lease_expires_at, encrypted_payload_expires_at`,
        [row.id, config.accountKey, config.productKey, input.now, input.workerId, leaseExpiresAt],
      );
      if (updated.rows[0]) {
        claims.push(
          mapAuthEmailChallengeClaim({
            ...updated.rows[0],
            destination_email: row.destination_email,
          }),
        );
      }
    }
    return claims;
  });
}

async function completeAuthEmailChallengeDelivery(
  pool: DbPool,
  config: AppConfig,
  claim: AuthEmailChallengeDeliveryClaim,
  input: {
    state: 'sink_delivered' | 'provider_delivered';
    now: Date;
    providerMessageRefHash: string;
  },
) {
  const result = await pool.query(
    `UPDATE onetime.auth_email_challenge_delivery_outbox
        SET state = $4,
            nonce = NULL,
            ciphertext = NULL,
            auth_tag = NULL,
            provider_message_ref_hash = $5,
            delivered_at = $6,
            cleared_at = $6,
            updated_at = $6
      WHERE id = $1
        AND account_key = $2
        AND product_key = $3
        AND state = 'leased'
        AND lease_expires_at = $7
      RETURNING delivery_key`,
    [
      claim.id,
      config.accountKey,
      config.productKey,
      input.state,
      input.providerMessageRefHash,
      input.now,
      claim.lease_expires_at,
    ],
  );
  return Boolean(result.rowCount);
}

async function failAuthEmailChallengeDelivery(
  pool: DbPool,
  config: AppConfig,
  claim: AuthEmailChallengeDeliveryClaim,
  input: { state: 'retry' | 'dead_letter'; now: Date; errorCode: string },
) {
  const nextAttemptAt =
    input.state === 'retry'
      ? new Date(input.now.getTime() + Math.min(60_000 * Math.max(1, claim.attempts), 300_000))
      : input.now;
  const result = await pool.query(
    `UPDATE onetime.auth_email_challenge_delivery_outbox
        SET state = $4,
            next_attempt_at = $5,
            last_error_code = $6,
            dead_lettered_at = CASE WHEN $4 = 'dead_letter' THEN $7::timestamptz ELSE dead_lettered_at END,
            nonce = CASE WHEN $4 = 'dead_letter' THEN NULL ELSE nonce END,
            ciphertext = CASE WHEN $4 = 'dead_letter' THEN NULL ELSE ciphertext END,
            auth_tag = CASE WHEN $4 = 'dead_letter' THEN NULL ELSE auth_tag END,
            cleared_at = CASE WHEN $4 = 'dead_letter' THEN $7::timestamptz ELSE cleared_at END,
            updated_at = $7
      WHERE id = $1
        AND account_key = $2
        AND product_key = $3
        AND state = 'leased'
        AND lease_expires_at = $8
      RETURNING delivery_key`,
    [
      claim.id,
      config.accountKey,
      config.productKey,
      input.state,
      nextAttemptAt,
      input.errorCode,
      input.now,
      claim.lease_expires_at,
    ],
  );
  return Boolean(result.rowCount);
}

function mapAuthEmailChallengeClaim(row: Record<string, unknown>): AuthEmailChallengeDeliveryClaim {
  return {
    id: stringValue(row.id),
    delivery_key: stringValue(row.delivery_key),
    challenge_key: stringValue(row.challenge_key),
    purpose: stringValue(row.purpose),
    destination_email: stringValue(row.destination_email),
    nonce: stringValue(row.nonce),
    ciphertext: stringValue(row.ciphertext),
    auth_tag: stringValue(row.auth_tag),
    attempts: Number(row.attempts ?? 0),
    max_attempts: Number(row.max_attempts ?? 5),
    lease_expires_at: dateValue(row.lease_expires_at),
    encrypted_payload_expires_at: dateValue(row.encrypted_payload_expires_at),
  };
}

function emailChallengeCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function emailCodeHash(config: AppConfig, userKey: unknown, code: string) {
  return createHash('sha256')
    .update([config.accountKey, config.productKey, String(userKey), code.trim()].join(':'))
    .digest('hex');
}

function emailChallengeUrl(config: AppConfig, linkToken: string) {
  return `${config.publicBaseUrl.replace(/\/+$/, '')}/login#email_challenge_token=${encodeURIComponent(
    linkToken,
  )}`;
}

function requiredPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value !== 'string' || !value) throw new Error(`auth_email_payload_${key}_missing`);
  return value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function destinationReference(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function isMemoryPool(pool: DbPool) {
  return Boolean((pool as DbPool & { __memory?: boolean }).__memory);
}

function stringValue(value: unknown) {
  if (typeof value === 'string') return value;
  return String(value ?? '');
}

function dateValue(value: unknown) {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid auth email delivery timestamp.');
  }
  return parsed;
}

function safeDeliveryErrorCode(error: unknown) {
  const value = error instanceof Error ? error.message : String(error);
  return value.replace(/[^a-z0-9_.:-]/gi, '_').slice(0, 120) || 'unknown_auth_email_error';
}

function encryptionKey(config: AppConfig) {
  return createHash('sha256').update(config.mfaSecretEncryptionKey).digest();
}

function encryptSecret(config: AppConfig, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(config), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
  };
}

function decryptSecret(config: AppConfig, row: Record<string, unknown>) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(config),
    Buffer.from(String(row.secret_iv), 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(String(row.secret_tag), 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(String(row.secret_ciphertext), 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function verifyTotpCode(secret: string, code: string, at = Date.now()) {
  const currentStep = Math.floor(at / 30_000);
  for (const step of [currentStep - 1, currentStep, currentStep + 1]) {
    if (totpCode(secret, step) === code) return { ok: true as const, step };
  }
  return { ok: false as const, step: currentStep };
}

export function totpCode(secret: string, step = Math.floor(Date.now() / 30_000)) {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0xf;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

function base32Encode(input: Buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of input.replaceAll('=', '').toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
