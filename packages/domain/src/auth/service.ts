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
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp.ts';

const ARGON2_MEMORY_KIB = 19_456;
const ARGON2_PASSES = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_TAG_LENGTH = 32;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const PRE_AUTH_TTL_MS = 5 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const MFA_WINDOW_MS = 10 * 60 * 1000;
const MFA_MAX_FAILURES = 5;
const TOTP_CLOCK_WINDOW = 1;
const RECOVERY_CODE_COUNT = 10;
const DUMMY_PASSWORD_HASH =
  'argon2id$v=19$m=19456,t=2,p=1$b3QzNC1maXhlZC1kdW1teQ$1Ep2Bkj8FE5kylMcswO1FD0dA1Si-7_RzEr2CSHtM6E';

type LoginThrottleBucket = {
  failure_count: number;
  window_started_at: unknown;
  locked_until: unknown;
};

type MfaThrottleBucket = LoginThrottleBucket;

type AccountUserRow = {
  user_key: string;
  email_normalized: string;
  display_name: string;
  role: UserRole;
  password_hash: string;
  mfa_capable: boolean;
  status: string;
  credential_version: number;
  session_version: number;
  has_active_mfa?: boolean;
};

export type AuthenticatedSession = {
  session_key: string;
  user: SessionUser;
  expires_at: string;
};

export type CreatedSession = AuthenticatedSession & {
  session_token: string;
  csrf_cookie: string;
  csrf_token: string;
};

export type AuthFailureCode =
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'MFA_REQUIRED'
  | 'MFA_ENROLLMENT_REQUIRED'
  | 'MFA_CONFIG_REQUIRED'
  | 'MFA_INVALID'
  | 'MFA_EXPIRED'
  | 'DISABLED';

export type LoginResult =
  | { ok: true; user: SessionUser }
  | {
      ok: false;
      code: AuthFailureCode;
      retry_after_seconds?: number;
      pre_auth_token?: string;
      expires_at?: string;
      enrollment?: { otpauth_uri: string; manual_secret: string };
    };

export type MfaVerificationResult =
  | {
      ok: true;
      user: SessionUser;
      recovery_codes?: string[];
      recovery_code_used: boolean;
    }
  | { ok: false; code: AuthFailureCode; retry_after_seconds?: number };

export class MfaConfigurationError extends Error {
  constructor() {
    super('MFA encryption configuration is missing.');
  }
}

export function resetAuthRateLimitForTests() {
  // Durable throttling is stored in the test database; fresh memory pools isolate tests.
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
  await inTransaction(pool, async (client) => {
    const existing = await client.query(
      `SELECT user_key
         FROM onetime.account_users
        WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3
        FOR UPDATE`,
      [config.accountKey, config.productKey, emailNormalized],
    );
    await client.query(
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
         credential_version = onetime.account_users.credential_version + 1,
         session_version = onetime.account_users.session_version + 1,
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
    if (existing.rowCount) {
      await revokeUserSessions(client, config, userKey, 'password_changed');
    }
  });
  return userKey;
}

export async function authenticateUser({
  pool,
  config,
  email,
  password,
  ip,
  userAgent,
  testHooks,
}: {
  pool: DbPool;
  config: AppConfig;
  email: string;
  password: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
  testHooks?: { passwordVerificationPath?: (path: 'account' | 'dummy') => void } | undefined;
}): Promise<LoginResult> {
  const emailNormalized = normalizeEmail(email);
  const emailBucketHash = hashValue(emailNormalized);
  const ipBucketHash = hashValue(ip ?? 'unknown');

  return inTransaction(pool, async (client) => {
    const bucket = await lockLoginThrottleBucket(client, config, emailBucketHash, ipBucketHash);
    const lockedUntil = asTime(bucket.locked_until);
    if (lockedUntil && lockedUntil > Date.now()) {
      await insertAuthAudit(client, config, {
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
        retry_after_seconds: Math.ceil((lockedUntil - Date.now()) / 1000),
      };
    }

    const result = await client.query(
      `SELECT users.user_key, users.email_normalized, users.display_name, users.role,
              users.password_hash, users.mfa_capable, users.status,
              users.credential_version, users.session_version
         FROM onetime.account_users AS users
        WHERE users.account_key = $1 AND users.product_key = $2 AND users.email_normalized = $3`,
      [config.accountKey, config.productKey, emailNormalized],
    );
    const row = result.rows[0] as AccountUserRow | undefined;
    const passwordHash =
      typeof row?.password_hash === 'string' ? String(row.password_hash) : DUMMY_PASSWORD_HASH;
    const passwordVerified = verifyPassword(password, passwordHash);
    testHooks?.passwordVerificationPath?.(row ? 'account' : 'dummy');
    const valid = Boolean(row && passwordVerified);
    if (!valid) {
      await recordFailedLogin(client, config, emailBucketHash, ipBucketHash);
      await insertAuthAudit(client, config, {
        eventType: 'login_failed',
        success: false,
        reason: 'INVALID_CREDENTIALS',
        ip,
        userAgent,
        metadata: { email_hash: stableKey('email', [emailNormalized]) },
      });
      return { ok: false, code: 'INVALID_CREDENTIALS' };
    }

    const account = row;
    if (!account) throw new Error('Password validation lost account row.');

    if (account.status !== 'active') {
      await recordFailedLogin(client, config, emailBucketHash, ipBucketHash);
      await insertAuthAudit(client, config, {
        eventType: 'login_failed',
        userKey: account.user_key,
        success: false,
        reason: 'DISABLED',
        ip,
        userAgent,
      });
      return { ok: false, code: 'DISABLED' };
    }

    await clearLoginThrottle(client, config, emailBucketHash, ipBucketHash);
    if (isPrivilegedRole(account.role)) {
      const factor = await client.query(
        `SELECT 1
           FROM onetime.user_mfa_factors
          WHERE account_key = $1
            AND product_key = $2
            AND user_key = $3
            AND status = 'active'
          LIMIT 1`,
        [config.accountKey, config.productKey, account.user_key],
      );
      account.has_active_mfa = Boolean(factor.rowCount);
      try {
        const preAuth = await createMfaPreAuth(client, config, account, ip, userAgent);
        await insertAuthAudit(client, config, {
          eventType: preAuth.enrollment
            ? 'login_password_accepted_mfa_enrollment'
            : 'login_password_accepted_mfa_required',
          userKey: account.user_key,
          success: true,
          ip,
          userAgent,
          metadata: {
            auth_assurance: 'pre_auth_only',
            mfa_verified: false,
            transaction_key: preAuth.transactionKey,
          },
        });
        const response: LoginResult = {
          ok: false,
          code: preAuth.enrollment ? 'MFA_ENROLLMENT_REQUIRED' : 'MFA_REQUIRED',
          pre_auth_token: preAuth.token,
          expires_at: preAuth.expiresAt.toISOString(),
        };
        if (preAuth.enrollment) response.enrollment = preAuth.enrollment;
        return response;
      } catch (error) {
        if (error instanceof MfaConfigurationError) {
          await insertAuthAudit(client, config, {
            eventType: 'login_mfa_configuration_missing',
            userKey: account.user_key,
            success: false,
            reason: 'MFA_CONFIG_REQUIRED',
            ip,
            userAgent,
          });
          return { ok: false, code: 'MFA_CONFIG_REQUIRED' };
        }
        throw error;
      }
    }

    await insertAuthAudit(client, config, {
      eventType: 'login_succeeded',
      userKey: account.user_key,
      success: true,
      ip,
      userAgent,
      metadata: { auth_assurance: 'password_only', mfa_verified: false },
    });
    return { ok: true, user: rowToSessionUser(account, false, 'password_only') };
  });
}

export async function completeMfaChallenge({
  pool,
  config,
  preAuthToken,
  totpCode,
  recoveryCode,
  ip,
  userAgent,
}: {
  pool: DbPool;
  config: AppConfig;
  preAuthToken: string;
  totpCode?: string | undefined;
  recoveryCode?: string | undefined;
  ip?: string | undefined;
  userAgent?: string | undefined;
}): Promise<MfaVerificationResult> {
  return inTransaction(pool, async (client) => {
    const preAuth = await client.query(
      `SELECT tx.*, users.email_normalized, users.display_name, users.role, users.mfa_capable,
              users.status, users.credential_version, users.session_version
         FROM onetime.auth_pre_auth_transactions AS tx
         JOIN onetime.account_users AS users ON users.user_key = tx.user_key
        WHERE tx.account_key = $1
          AND tx.product_key = $2
          AND tx.token_hash = $3
          AND tx.used_at IS NULL
          AND tx.expires_at > now()
        FOR UPDATE`,
      [config.accountKey, config.productKey, hashValue(preAuthToken)],
    );
    const row = preAuth.rows[0] as
      | (AccountUserRow & {
          transaction_key: string;
          purpose: 'mfa_challenge' | 'mfa_enrollment';
          pending_secret_ciphertext: string | null;
          pending_secret_key_version: string | null;
        })
      | undefined;
    if (!row) return { ok: false, code: 'MFA_EXPIRED' };
    if (row.status !== 'active') return { ok: false, code: 'DISABLED' };

    const throttle = await lockMfaThrottleBucket(
      client,
      config,
      hashValue(row.user_key),
      hashValue(ip ?? 'unknown'),
    );
    const lockedUntil = asTime(throttle.locked_until);
    if (lockedUntil && lockedUntil > Date.now()) {
      return {
        ok: false,
        code: 'RATE_LIMITED',
        retry_after_seconds: Math.ceil((lockedUntil - Date.now()) / 1000),
      };
    }

    if (row.purpose === 'mfa_enrollment') {
      if (!row.pending_secret_ciphertext || !row.pending_secret_key_version || !totpCode) {
        await recordFailedMfa(client, config, hashValue(row.user_key), hashValue(ip ?? 'unknown'));
        return { ok: false, code: 'MFA_INVALID' };
      }
      const secret = decryptSecret(
        config,
        row.pending_secret_key_version,
        row.pending_secret_ciphertext,
      );
      const verified = verifyTotp({
        secret,
        code: totpCode,
        window: TOTP_CLOCK_WINDOW,
        lastAcceptedCounter: null,
      });
      if (!verified.ok) {
        await recordFailedMfa(client, config, hashValue(row.user_key), hashValue(ip ?? 'unknown'));
        await auditMfaFailure(client, config, row.user_key, ip, userAgent);
        return { ok: false, code: 'MFA_INVALID' };
      }
      const factorKey = `mfa_${randomUUID()}`;
      await client.query(
        `INSERT INTO onetime.user_mfa_factors
         (factor_key, account_key, product_key, user_key, factor_type, secret_ciphertext,
          secret_key_version, label, last_accepted_counter)
         VALUES ($1,$2,$3,$4,'totp',$5,$6,$7,$8)`,
        [
          factorKey,
          config.accountKey,
          config.productKey,
          row.user_key,
          row.pending_secret_ciphertext,
          row.pending_secret_key_version,
          'Authenticator app',
          verified.counter,
        ],
      );
      const recoveryCodes = await replaceRecoveryCodes(client, config, row.user_key);
      await consumePreAuth(client, row.transaction_key);
      await clearMfaThrottle(client, config, hashValue(row.user_key), hashValue(ip ?? 'unknown'));
      await bumpUserSessionVersion(client, config, row.user_key);
      await revokeUserSessions(client, config, row.user_key, 'mfa_factor_enrolled');
      await insertAuthAudit(client, config, {
        eventType: 'mfa_enrollment_completed',
        userKey: row.user_key,
        success: true,
        ip,
        userAgent,
        metadata: { factor_key: factorKey, clock_window_steps: TOTP_CLOCK_WINDOW },
      });
      return {
        ok: true,
        user: rowToSessionUser(row, true, 'mfa'),
        recovery_codes: recoveryCodes,
        recovery_code_used: false,
      };
    }

    const factor = await client.query(
      `SELECT factor_key, secret_ciphertext, secret_key_version, last_accepted_counter
         FROM onetime.user_mfa_factors
        WHERE account_key = $1
          AND product_key = $2
          AND user_key = $3
          AND status = 'active'
        FOR UPDATE`,
      [config.accountKey, config.productKey, row.user_key],
    );
    const activeFactor = factor.rows[0] as
      | {
          factor_key: string;
          secret_ciphertext: string;
          secret_key_version: string;
          last_accepted_counter: string | number | null;
        }
      | undefined;
    let recoveryCodeUsed = false;
    if (totpCode && activeFactor) {
      const secret = decryptSecret(
        config,
        activeFactor.secret_key_version,
        activeFactor.secret_ciphertext,
      );
      const verified = verifyTotp({
        secret,
        code: totpCode,
        window: TOTP_CLOCK_WINDOW,
        lastAcceptedCounter:
          activeFactor.last_accepted_counter === null
            ? null
            : Number(activeFactor.last_accepted_counter),
      });
      if (verified.ok) {
        await client.query(
          `UPDATE onetime.user_mfa_factors
              SET last_accepted_counter = $1
            WHERE factor_key = $2`,
          [verified.counter, activeFactor.factor_key],
        );
      } else {
        await recordFailedMfa(client, config, hashValue(row.user_key), hashValue(ip ?? 'unknown'));
        await auditMfaFailure(client, config, row.user_key, ip, userAgent);
        return { ok: false, code: 'MFA_INVALID' };
      }
    } else if (recoveryCode) {
      const consumed = await consumeRecoveryCode(client, config, row.user_key, recoveryCode);
      if (!consumed) {
        await recordFailedMfa(client, config, hashValue(row.user_key), hashValue(ip ?? 'unknown'));
        await auditMfaFailure(client, config, row.user_key, ip, userAgent);
        return { ok: false, code: 'MFA_INVALID' };
      }
      recoveryCodeUsed = true;
      await bumpUserSessionVersion(client, config, row.user_key);
      await revokeUserSessions(client, config, row.user_key, 'mfa_recovery_code_used');
    } else {
      await recordFailedMfa(client, config, hashValue(row.user_key), hashValue(ip ?? 'unknown'));
      return { ok: false, code: 'MFA_INVALID' };
    }

    await consumePreAuth(client, row.transaction_key);
    await clearMfaThrottle(client, config, hashValue(row.user_key), hashValue(ip ?? 'unknown'));
    await insertAuthAudit(client, config, {
      eventType: recoveryCodeUsed ? 'mfa_recovery_code_used' : 'mfa_challenge_succeeded',
      userKey: row.user_key,
      success: true,
      ip,
      userAgent,
      metadata: { recovery_code_used: recoveryCodeUsed, clock_window_steps: TOTP_CLOCK_WINDOW },
    });
    return {
      ok: true,
      user: rowToSessionUser(row, true, 'mfa'),
      recovery_code_used: recoveryCodeUsed,
    };
  });
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
  return insertSession(pool, config, user, ip, userAgent, rotatedFromSessionKey);
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
    `SELECT sessions.session_key, sessions.expires_at, sessions.mfa_verified,
            sessions.auth_assurance, sessions.last_seen_at,
            sessions.credential_version AS session_credential_version,
            sessions.session_version AS stored_session_version,
            users.user_key, users.email_normalized, users.display_name, users.role,
            users.mfa_capable, users.credential_version, users.session_version
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
  if (
    Number(row.session_credential_version) !== Number(row.credential_version) ||
    Number(row.stored_session_version) !== Number(row.session_version)
  ) {
    await pool.query('UPDATE onetime.user_sessions SET revoked_at = now() WHERE session_key = $1', [
      row.session_key,
    ]);
    return null;
  }
  if (isPrivilegedRole(row.role as UserRole) && row.auth_assurance !== 'mfa') {
    await pool.query('UPDATE onetime.user_sessions SET revoked_at = now() WHERE session_key = $1', [
      row.session_key,
    ]);
    return null;
  }
  const lastSeenAt = asTime(row.last_seen_at) ?? 0;
  if (Date.now() - lastSeenAt >= config.sessionLastSeenRefreshMs) {
    await pool.query(
      'UPDATE onetime.user_sessions SET last_seen_at = now() WHERE session_key = $1',
      [row.session_key],
    );
  }
  return {
    session_key: row.session_key,
    expires_at: toIso(row.expires_at),
    user: rowToSessionUser(row, Boolean(row.mfa_verified), row.auth_assurance),
  };
}

export async function verifySessionCsrf({
  pool,
  config,
  sessionKey,
  csrfCookie,
  csrfToken,
}: {
  pool: DbPool;
  config: AppConfig;
  sessionKey: string;
  csrfCookie?: string | undefined;
  csrfToken?: string | undefined;
}) {
  if (!csrfCookie || !csrfToken) return false;
  const result = await pool.query(
    `SELECT csrf_token_hash FROM onetime.user_sessions
      WHERE session_key = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [sessionKey],
  );
  const expected = result.rows[0]?.csrf_token_hash;
  return (
    typeof expected === 'string' &&
    expected === hashValue(csrfCookie) &&
    verifyCsrfProof(config, sessionKey, csrfCookie, csrfToken)
  );
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
  const csrfCookie = token();
  const csrfToken = csrfProof(config, session.session_key, csrfCookie);
  await pool.query(
    `UPDATE onetime.user_sessions
        SET csrf_token_hash = $1, last_seen_at = now()
      WHERE session_key = $2 AND account_key = $3 AND product_key = $4`,
    [hashValue(csrfCookie), session.session_key, config.accountKey, config.productKey],
  );
  return { csrf_cookie: csrfCookie, csrf_token: csrfToken };
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

async function createMfaPreAuth(
  client: Queryable,
  config: AppConfig,
  row: AccountUserRow,
  ip?: string,
  userAgent?: string,
) {
  const expiresAt = new Date(Date.now() + PRE_AUTH_TTL_MS);
  const preAuthToken = token();
  const transactionKey = `preauth_${randomUUID()}`;
  const hasActiveMfa = Boolean(row.has_active_mfa);
  let enrollment:
    | {
        otpauth_uri: string;
        manual_secret: string;
      }
    | undefined;
  let encryptedSecret:
    | {
        ciphertext: string;
        keyVersion: string;
      }
    | undefined;
  if (!hasActiveMfa) {
    const secret = generateTotpSecret();
    encryptedSecret = encryptSecret(config, secret);
    enrollment = {
      otpauth_uri: otpauthUri({
        issuer: 'One Time Mishnayos',
        accountName: row.email_normalized,
        secret,
      }),
      manual_secret: secret.toString('base64url'),
    };
  }
  await client.query(
    `INSERT INTO onetime.auth_pre_auth_transactions
     (transaction_key, account_key, product_key, user_key, token_hash, purpose,
      pending_secret_ciphertext, pending_secret_key_version, expires_at, user_agent_hash, ip_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      transactionKey,
      config.accountKey,
      config.productKey,
      row.user_key,
      hashValue(preAuthToken),
      enrollment ? 'mfa_enrollment' : 'mfa_challenge',
      encryptedSecret?.ciphertext ?? null,
      encryptedSecret?.keyVersion ?? null,
      expiresAt.toISOString(),
      userAgent ? hashValue(userAgent) : null,
      ip ? hashValue(ip) : null,
    ],
  );
  return {
    token: preAuthToken,
    transactionKey,
    expiresAt,
    enrollment,
  };
}

async function insertSession(
  target: DbPool | Queryable,
  config: AppConfig,
  user: SessionUser,
  ip?: string,
  userAgent?: string,
  rotatedFromSessionKey?: string,
): Promise<CreatedSession> {
  const version = await target.query(
    `SELECT credential_version, session_version
       FROM onetime.account_users
      WHERE account_key = $1 AND product_key = $2 AND user_key = $3 AND status = 'active'`,
    [config.accountKey, config.productKey, user.user_key],
  );
  const versionRow = version.rows[0];
  if (!versionRow) throw new Error('Cannot create a session for an inactive user.');
  const sessionToken = token();
  const csrfCookie = token();
  const sessionKey = `sess_${randomUUID()}`;
  const csrfToken = csrfProof(config, sessionKey, csrfCookie);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await target.query(
    `INSERT INTO onetime.user_sessions
     (session_key, account_key, product_key, user_key, token_hash, csrf_token_hash,
      user_agent_hash, ip_hash, expires_at, rotated_from_session_key,
      credential_version, session_version, mfa_verified, auth_assurance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      sessionKey,
      config.accountKey,
      config.productKey,
      user.user_key,
      hashValue(sessionToken),
      hashValue(csrfCookie),
      userAgent ? hashValue(userAgent) : null,
      ip ? hashValue(ip) : null,
      expiresAt.toISOString(),
      rotatedFromSessionKey ?? null,
      Number(versionRow.credential_version),
      Number(versionRow.session_version),
      user.mfa_verified,
      user.auth_assurance,
    ],
  );
  await insertAuthAudit(target, config, {
    eventType: 'session_created',
    userKey: user.user_key,
    success: true,
    ip,
    userAgent,
    metadata: {
      session_key: sessionKey,
      rotated_from_session_key: rotatedFromSessionKey ?? null,
      auth_assurance: user.auth_assurance,
      mfa_verified: user.mfa_verified,
    },
  });
  return {
    session_key: sessionKey,
    session_token: sessionToken,
    csrf_cookie: csrfCookie,
    csrf_token: csrfToken,
    user,
    expires_at: expiresAt.toISOString(),
  };
}

async function replaceRecoveryCodes(client: Queryable, config: AppConfig, userKey: string) {
  await client.query(
    `UPDATE onetime.user_mfa_recovery_codes
        SET status = 'revoked', revoked_at = now()
      WHERE account_key = $1 AND product_key = $2 AND user_key = $3 AND status = 'active'`,
    [config.accountKey, config.productKey, userKey],
  );
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => recoveryCode());
  for (const code of codes) {
    await client.query(
      `INSERT INTO onetime.user_mfa_recovery_codes
       (recovery_code_key, account_key, product_key, user_key, code_hash)
       VALUES ($1,$2,$3,$4,$5)`,
      [`recovery_${randomUUID()}`, config.accountKey, config.productKey, userKey, hashValue(code)],
    );
  }
  return codes;
}

async function consumeRecoveryCode(
  client: Queryable,
  config: AppConfig,
  userKey: string,
  recoveryCodeValue: string,
) {
  const result = await client.query(
    `UPDATE onetime.user_mfa_recovery_codes
        SET status = 'used', used_at = now()
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND code_hash = $4
        AND status = 'active'
      RETURNING recovery_code_key`,
    [config.accountKey, config.productKey, userKey, hashValue(recoveryCodeValue.trim())],
  );
  return Boolean(result.rowCount);
}

async function consumePreAuth(client: Queryable, transactionKey: string) {
  await client.query(
    `UPDATE onetime.auth_pre_auth_transactions
        SET used_at = now()
      WHERE transaction_key = $1`,
    [transactionKey],
  );
}

async function bumpUserSessionVersion(client: Queryable, config: AppConfig, userKey: string) {
  await client.query(
    `UPDATE onetime.account_users
        SET session_version = session_version + 1,
            updated_at = now()
      WHERE account_key = $1 AND product_key = $2 AND user_key = $3`,
    [config.accountKey, config.productKey, userKey],
  );
}

async function revokeUserSessions(
  client: Queryable,
  config: AppConfig,
  userKey: string,
  reason: string,
) {
  await client.query(
    `UPDATE onetime.user_sessions
        SET revoked_at = COALESCE(revoked_at, now())
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND revoked_at IS NULL`,
    [config.accountKey, config.productKey, userKey],
  );
  await insertAuthAudit(client, config, {
    eventType: 'session_family_revoked',
    userKey,
    success: true,
    reason,
    metadata: { reason },
  });
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

function rowToSessionUser(
  row: Record<string, unknown>,
  mfaVerified: boolean,
  authAssurance: 'password_only' | 'mfa',
): SessionUser {
  const role = row.role as UserRole;
  return {
    user_key: String(row.user_key),
    email: String(row.email_normalized),
    display_name: String(row.display_name),
    role,
    role_label: roleDisplayLabel[role],
    mfa_capable: Boolean(row.mfa_capable),
    mfa_verified: mfaVerified,
    auth_assurance: authAssurance,
  };
}

async function lockLoginThrottleBucket(
  client: Queryable,
  config: AppConfig,
  emailBucketHash: string,
  ipBucketHash: string,
): Promise<LoginThrottleBucket> {
  await client.query(
    `INSERT INTO onetime.login_throttle_buckets
     (account_key, product_key, email_bucket_hash, ip_bucket_hash)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (account_key, product_key, email_bucket_hash, ip_bucket_hash) DO NOTHING`,
    [config.accountKey, config.productKey, emailBucketHash, ipBucketHash],
  );
  const result = await client.query(
    `SELECT failure_count, window_started_at, locked_until
       FROM onetime.login_throttle_buckets
      WHERE account_key = $1
        AND product_key = $2
        AND email_bucket_hash = $3
        AND ip_bucket_hash = $4
      FOR UPDATE`,
    [config.accountKey, config.productKey, emailBucketHash, ipBucketHash],
  );
  return result.rows[0] as LoginThrottleBucket;
}

async function recordFailedLogin(
  client: Queryable,
  config: AppConfig,
  emailBucketHash: string,
  ipBucketHash: string,
) {
  await recordFailureWindow(
    client,
    'login_throttle_buckets',
    config,
    emailBucketHash,
    ipBucketHash,
    LOGIN_WINDOW_MS,
    LOGIN_MAX_FAILURES,
  );
}

async function clearLoginThrottle(
  client: Queryable,
  config: AppConfig,
  emailBucketHash: string,
  ipBucketHash: string,
) {
  await client.query(
    `DELETE FROM onetime.login_throttle_buckets
      WHERE account_key = $1
        AND product_key = $2
        AND email_bucket_hash = $3
        AND ip_bucket_hash = $4`,
    [config.accountKey, config.productKey, emailBucketHash, ipBucketHash],
  );
}

async function lockMfaThrottleBucket(
  client: Queryable,
  config: AppConfig,
  userBucketHash: string,
  ipBucketHash: string,
): Promise<MfaThrottleBucket> {
  await client.query(
    `INSERT INTO onetime.mfa_throttle_buckets
     (account_key, product_key, user_bucket_hash, ip_bucket_hash)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (account_key, product_key, user_bucket_hash, ip_bucket_hash) DO NOTHING`,
    [config.accountKey, config.productKey, userBucketHash, ipBucketHash],
  );
  const result = await client.query(
    `SELECT failure_count, window_started_at, locked_until
       FROM onetime.mfa_throttle_buckets
      WHERE account_key = $1
        AND product_key = $2
        AND user_bucket_hash = $3
        AND ip_bucket_hash = $4
      FOR UPDATE`,
    [config.accountKey, config.productKey, userBucketHash, ipBucketHash],
  );
  return result.rows[0] as MfaThrottleBucket;
}

async function recordFailedMfa(
  client: Queryable,
  config: AppConfig,
  userBucketHash: string,
  ipBucketHash: string,
) {
  await recordFailureWindow(
    client,
    'mfa_throttle_buckets',
    config,
    userBucketHash,
    ipBucketHash,
    MFA_WINDOW_MS,
    MFA_MAX_FAILURES,
  );
}

async function clearMfaThrottle(
  client: Queryable,
  config: AppConfig,
  userBucketHash: string,
  ipBucketHash: string,
) {
  await client.query(
    `DELETE FROM onetime.mfa_throttle_buckets
      WHERE account_key = $1
        AND product_key = $2
        AND user_bucket_hash = $3
        AND ip_bucket_hash = $4`,
    [config.accountKey, config.productKey, userBucketHash, ipBucketHash],
  );
}

async function recordFailureWindow(
  client: Queryable,
  table: 'login_throttle_buckets' | 'mfa_throttle_buckets',
  config: AppConfig,
  firstBucketHash: string,
  ipBucketHash: string,
  windowMs: number,
  maxFailures: number,
) {
  const firstColumn = table === 'login_throttle_buckets' ? 'email_bucket_hash' : 'user_bucket_hash';
  const now = Date.now();
  const windowCutoff = new Date(now - windowMs).toISOString();
  const nextWindowStartedAt = new Date(now).toISOString();
  const nextLockedUntil = new Date(now + windowMs).toISOString();
  await client.query(
    `UPDATE onetime.${table}
        SET failure_count = CASE
              WHEN window_started_at < $5 THEN 1
              ELSE failure_count + 1
            END,
            window_started_at = CASE
              WHEN window_started_at < $5 THEN $6
              ELSE window_started_at
            END,
            locked_until = CASE
              WHEN (CASE WHEN window_started_at < $5 THEN 1 ELSE failure_count + 1 END) >= $7
              THEN $8
              ELSE NULL
            END,
            updated_at = now()
      WHERE account_key = $1
        AND product_key = $2
        AND ${firstColumn} = $3
        AND ip_bucket_hash = $4`,
    [
      config.accountKey,
      config.productKey,
      firstBucketHash,
      ipBucketHash,
      windowCutoff,
      nextWindowStartedAt,
      maxFailures,
      nextLockedUntil,
    ],
  );
}

async function auditMfaFailure(
  client: Queryable,
  config: AppConfig,
  userKey: string,
  ip?: string,
  userAgent?: string,
) {
  await insertAuthAudit(client, config, {
    eventType: 'mfa_challenge_failed',
    userKey,
    success: false,
    reason: 'MFA_INVALID',
    ip,
    userAgent,
  });
}

function encryptSecret(config: AppConfig, plaintext: Buffer) {
  const keyVersion = config.mfaActiveKeyVersion;
  const key = keyVersion ? config.mfaEncryptionKeys[keyVersion] : undefined;
  if (!keyVersion || !key) throw new MfaConfigurationError();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    keyVersion,
    ciphertext: [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.'),
  };
}

function decryptSecret(config: AppConfig, keyVersion: string, encoded: string) {
  const key = config.mfaEncryptionKeys[keyVersion];
  if (!key) throw new MfaConfigurationError();
  const [ivEncoded, tagEncoded, ciphertextEncoded, extra] = encoded.split('.');
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded || extra !== undefined) {
    throw new Error('Invalid encrypted MFA secret.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final(),
  ]);
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
  return safeSignatureEquals(signature, expected);
}

function safeSignatureEquals(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function recoveryCode() {
  const raw = randomBytes(10)
    .toString('base64url')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 16);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

function isPrivilegedRole(role: UserRole) {
  return role === 'owner' || role === 'admin';
}

function asTime(value: unknown) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : null;
}

function token() {
  return randomBytes(32).toString('base64url');
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}
