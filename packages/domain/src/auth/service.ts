import {
  argon2Sync,
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { roleDisplayLabel, type SessionUser, type UserRole } from '../../../contracts/src/index.ts';
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
const RECOVERY_CODE_COUNT = 10;

type AssuranceMethod = 'password' | 'totp' | 'recovery_code';

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
  | {
      ok: false;
      code: AuthFailureCode;
      retry_after_seconds?: number;
      challenge_token?: string;
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
  const emailHash = stableKey('email', [emailNormalized]);
  const rateLimit = await consumeRateLimitBudgets({
    pool,
    config,
    budgets: [
      {
        scope: 'login_identifier',
        subject: emailHash,
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
      metadata: { email_hash: emailHash, budget_scope: rateLimit.scope ?? null },
    });
    return rateLimit.retryAfterSeconds
      ? {
          ok: false,
          code: 'RATE_LIMITED',
          retry_after_seconds: rateLimit.retryAfterSeconds,
        }
      : { ok: false, code: 'RATE_LIMITED' };
  }

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
      metadata: { email_hash: stableKey('email', [emailNormalized]) },
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
    const challengeToken = await createMfaChallengeForUser({
      pool,
      config,
      userKey: row.user_key,
      ip,
      userAgent,
    });
    if (!challengeToken) {
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
    await insertAuthAudit(pool, config, {
      eventType: 'login_password_mfa_challenge',
      userKey: row.user_key,
      success: true,
      reason: 'MFA_REQUIRED',
      ip,
      userAgent,
    });
    return { ok: false, code: 'MFA_REQUIRED', challenge_token: challengeToken };
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
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())`,
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
      assuranceMethod ?? (['owner', 'admin'].includes(user.role) ? 'totp' : 'password'),
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
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  sessionToken?: string | undefined;
  userAgent?: string | undefined;
}): Promise<AuthenticatedSession | null> {
  if (!sessionToken) return null;
  const result = await pool.query(
    `SELECT sessions.session_key, sessions.expires_at,
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

function token() {
  return randomBytes(32).toString('base64url');
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

async function createMfaChallengeForUser({
  pool,
  config,
  userKey,
}: {
  pool: DbPool;
  config: AppConfig;
  userKey: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}) {
  const active = await pool.query(
    `SELECT 1
       FROM onetime.mfa_factors
      WHERE account_key = $1 AND product_key = $2 AND user_key = $3 AND status = 'active'
      LIMIT 1`,
    [config.accountKey, config.productKey, userKey],
  );
  if (!active.rowCount) return null;
  const challengeToken = token();
  await pool.query(
    `INSERT INTO onetime.mfa_challenges
     (challenge_key, account_key, product_key, user_key, challenge_hash, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      `mfach_${randomUUID()}`,
      config.accountKey,
      config.productKey,
      userKey,
      hashValue(challengeToken),
      new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    ],
  );
  return challengeToken;
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
