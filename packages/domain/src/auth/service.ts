import { argon2Sync, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { roleDisplayLabel, type SessionUser, type UserRole } from '../../../contracts/src/index.ts';
import type { AppConfig } from '../../../config/src/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { normalizeEmail, stableKey } from '../lead/normalize.ts';

const ARGON2_MEMORY_KIB = 19_456;
const ARGON2_PASSES = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_TAG_LENGTH = 32;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

type LoginBucket = {
  failures: number;
  resetAt: number;
  lockedUntil: number;
};

const loginBuckets = new Map<string, LoginBucket>();

export type AuthenticatedSession = {
  session_key: string;
  user: SessionUser;
  expires_at: string;
};

export type CreatedSession = AuthenticatedSession & {
  session_token: string;
  csrf_token: string;
};

export type AuthFailureCode = 'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'MFA_REQUIRED' | 'DISABLED';

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; code: AuthFailureCode; retry_after_seconds?: number };

export function resetAuthRateLimitForTests() {
  loginBuckets.clear();
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
  email,
  password,
  ip,
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  email: string;
  password: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}): Promise<LoginResult> {
  const emailNormalized = normalizeEmail(email);
  const bucketKey = `${config.accountKey}:${config.productKey}:${emailNormalized}:${hashValue(
    ip ?? 'unknown',
  )}`;
  const rateLimit = checkLoginBucket(bucketKey);
  if (!rateLimit.allowed) {
    await insertAuthAudit(pool, config, {
      eventType: 'login_rate_limited',
      success: false,
      reason: 'RATE_LIMITED',
      ip,
      userAgent,
      metadata: { email_hash: stableKey('email', [emailNormalized]) },
    });
    return {
      ok: false,
      code: 'RATE_LIMITED',
      retry_after_seconds: Math.ceil((rateLimit.lockedUntil - Date.now()) / 1000),
    };
  }

  const result = await pool.query(
    `SELECT user_key, email_normalized, display_name, role, password_hash, mfa_capable, status
       FROM onetime.account_users
      WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3`,
    [config.accountKey, config.productKey, emailNormalized],
  );
  const row = result.rows[0];
  const valid = row ? verifyPassword(password, row.password_hash) : false;
  if (!valid) {
    recordFailedLogin(bucketKey);
    await insertAuthAudit(pool, config, {
      eventType: 'login_failed',
      success: false,
      reason: 'INVALID_CREDENTIALS',
      ip,
      userAgent,
      metadata: { email_hash: stableKey('email', [emailNormalized]) },
    });
    return { ok: false, code: 'INVALID_CREDENTIALS' };
  }

  if (row.status !== 'active') {
    recordFailedLogin(bucketKey);
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

  if (config.isProduction && ['owner', 'admin'].includes(row.role) && !row.mfa_capable) {
    await insertAuthAudit(pool, config, {
      eventType: 'login_blocked_mfa_required',
      userKey: row.user_key,
      success: false,
      reason: 'MFA_REQUIRED',
      ip,
      userAgent,
    });
    return { ok: false, code: 'MFA_REQUIRED' };
  }

  loginBuckets.delete(bucketKey);
  await insertAuthAudit(pool, config, {
    eventType: 'login_succeeded',
    userKey: row.user_key,
    success: true,
    ip,
    userAgent,
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
}: {
  pool: DbPool;
  config: AppConfig;
  user: SessionUser;
  ip?: string | undefined;
  userAgent?: string | undefined;
  rotatedFromSessionKey?: string | undefined;
}): Promise<CreatedSession> {
  const sessionToken = token();
  const csrfToken = token();
  const sessionKey = `sess_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query(
    `INSERT INTO onetime.user_sessions
     (session_key, account_key, product_key, user_key, token_hash, csrf_token_hash,
      user_agent_hash, ip_hash, expires_at, rotated_from_session_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
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
  };
}

export async function getSessionByToken({
  pool,
  config,
  sessionToken,
}: {
  pool: DbPool;
  config: AppConfig;
  sessionToken?: string | undefined;
}): Promise<AuthenticatedSession | null> {
  if (!sessionToken) return null;
  const result = await pool.query(
    `SELECT sessions.session_key, sessions.expires_at,
            users.user_key, users.email_normalized, users.display_name, users.role, users.mfa_capable
       FROM onetime.user_sessions AS sessions
       JOIN onetime.account_users AS users ON users.user_key = sessions.user_key
      WHERE sessions.account_key = $1
        AND sessions.product_key = $2
        AND sessions.token_hash = $3
        AND sessions.revoked_at IS NULL
        AND sessions.expires_at > now()
        AND users.status = 'active'`,
    [config.accountKey, config.productKey, hashValue(sessionToken)],
  );
  const row = result.rows[0];
  if (!row) return null;
  await pool.query('UPDATE onetime.user_sessions SET last_seen_at = now() WHERE session_key = $1', [
    row.session_key,
  ]);
  return {
    session_key: row.session_key,
    expires_at: toIso(row.expires_at),
    user: rowToSessionUser(row),
  };
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

export function canEditContacts(role: UserRole) {
  return role === 'owner' || role === 'admin' || role === 'crm_agent';
}

export function canAssignContacts(role: UserRole) {
  return role === 'owner' || role === 'admin';
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
  return {
    user_key: String(row.user_key),
    email: String(row.email_normalized),
    display_name: String(row.display_name),
    role,
    role_label: roleDisplayLabel[role],
    mfa_capable: Boolean(row.mfa_capable),
  };
}

function checkLoginBucket(key: string) {
  const now = Date.now();
  const bucket = loginBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    loginBuckets.set(key, { failures: 0, resetAt: now + LOGIN_WINDOW_MS, lockedUntil: 0 });
    return { allowed: true, lockedUntil: 0 };
  }
  return { allowed: bucket.lockedUntil <= now, lockedUntil: bucket.lockedUntil };
}

function recordFailedLogin(key: string) {
  const now = Date.now();
  const bucket = loginBuckets.get(key) ?? {
    failures: 0,
    resetAt: now + LOGIN_WINDOW_MS,
    lockedUntil: 0,
  };
  bucket.failures += 1;
  if (bucket.failures >= LOGIN_MAX_FAILURES) {
    bucket.lockedUntil = now + LOGIN_WINDOW_MS;
  }
  loginBuckets.set(key, bucket);
}

function token() {
  return randomBytes(32).toString('base64url');
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}
