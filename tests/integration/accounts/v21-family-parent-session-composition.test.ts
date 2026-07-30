import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { createV21AdultSessionRuntime } from '../../../apps/web/src/server/features/auth/v21-adult-session.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { ADULT_SESSION_POLICY } from '../../../packages/contracts/src/accounts/v21-household-identity.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import type {
  ResolvedV21ParentSession,
  V21AdultSessionRepository,
} from '../../../packages/db/src/accounts/v21-household-identity-repository.ts';
import {
  createAccountUser,
  createSession,
  getSessionUserByKey,
} from '../../../packages/domain/src/index.ts';

type SignupProjection = {
  adult_id: string;
  human_account_id: string;
  household_id: string;
  access_state: 'free' | 'inactive';
};

type SignupResult = {
  response: Response;
  body: Record<string, unknown>;
  hostCookie: string;
  browserToken: string;
  projection: SignupProjection;
};

let pool: DbPool;
let config: AppConfig;
let distDir: string;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;
let now: Date;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    AUTH_CSRF_SECRET: 'v21-family-parent-composition-test-secret',
  });
  const memoryPool = createMemoryPool();
  await runMigrations(memoryPool);
  pool = pgMemCompatiblePool(memoryPool);
  distDir = await mkdtemp(path.join(tmpdir(), 'v21-family-parent-composition-'));
  await mkdir(path.join(distDir, 'app'), { recursive: true });
  await writeFile(
    path.join(distDir, 'app', 'parent.html'),
    '<!doctype html><html><body>V21_PARENT_SHELL</body></html>',
    'utf8',
  );
  now = new Date('2026-09-13T16:23:59.000Z');
  const v21AdultSessionRuntime = createV21AdultSessionRuntime({
    repository: createDbBackedTestAdultSessionRepository(pool),
    hmacSecret: config.authCsrfSecret,
    clock: () => new Date(now),
  });
  const app = createApp({
    config,
    pool,
    distDir,
    clock: () => new Date(now),
    v21AdultSessionRuntime,
  });
  server = await new Promise<typeof server>((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', (error?: Error) => {
      if (error) reject(error);
      else resolve(listening);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (pool) await pool.end();
  if (distDir) await rm(distDir, { recursive: true, force: true });
});

describe('I36 central Family-signup and Parent-session composition', () => {
  it('binds real P08 signup to one fail-closed v2.1 Parent middleware runtime', async () => {
    const preExpiry = await submitFamily('pre-expiry-parent@example.test', 'Pre', 'Expiry');

    expect(preExpiry.response.status).toBe(201);
    expect(preExpiry.body).toMatchObject({
      success: true,
      code: 'FAMILY_SIGNUP_COMPLETE',
      local_access_state: 'free',
      session_established: true,
      next_action: 'parent_overview',
      continue_to: '/app/parent',
      provider_effects_completed_inline: 0,
    });
    expect(preExpiry.projection.access_state).toBe('free');
    await expectParentShell(preExpiry.hostCookie, '/app/parent', 200);
    await expectParentShell(preExpiry.hostCookie, '/select-household', 200);
    await expectDigestOnlySessionPersistence(preExpiry);

    now = new Date('2026-09-13T16:24:00.000Z');
    const cutoff = await submitFamily('cutoff-parent@example.test', 'At', 'Cutoff');

    expect(cutoff.response.status).toBe(202);
    expect(cutoff.body).toMatchObject({
      success: true,
      code: 'SIGNUP_COMMITTED_CHECKOUT_HANDOFF_QUEUED',
      local_access_state: 'inactive',
      session_established: true,
      next_action: 'checkout_handoff_queued',
      checkout_provider: 'highlevel',
      financial_provider: 'stripe',
      direct_stripe_mutation_by_one_time: false,
      provider_effects_completed_inline: 0,
    });
    expect(cutoff.projection.access_state).toBe('inactive');
    await expectParentShell(cutoff.hostCookie, '/app/parent/account', 200);
    await expectParentShell(cutoff.hostCookie, '/select-household', 200);
    await expectParentShell(cutoff.hostCookie, '/app/parent/students', 403);
    await expectDigestOnlySessionPersistence(cutoff);

    const cutoffSession = await sessionRow(cutoff.projection.human_account_id);
    const originalIdleExpiry = cutoffSession.idle_expires_at;

    await pool.query(
      `UPDATE onetime.v21_adult_sessions
          SET active_household_id = $1
        WHERE session_id = $2`,
      [preExpiry.projection.household_id, cutoffSession.session_id],
    );
    await expectParentShell(cutoff.hostCookie, '/app/parent/account', 403);
    await pool.query(
      `UPDATE onetime.v21_adult_sessions
          SET active_household_id = $1
        WHERE session_id = $2`,
      [cutoff.projection.household_id, cutoffSession.session_id],
    );

    await pool.query(
      `UPDATE onetime.v21_human_accounts
          SET security_version = security_version + 1
        WHERE human_account_id = $1`,
      [cutoff.projection.human_account_id],
    );
    await expectParentShell(cutoff.hostCookie, '/app/parent/account', 403);
    await pool.query(
      `UPDATE onetime.v21_human_accounts
          SET security_version = 1
        WHERE human_account_id = $1`,
      [cutoff.projection.human_account_id],
    );

    await pool.query(
      `UPDATE onetime.v21_adult_sessions
          SET idle_expires_at = $1
        WHERE session_id = $2`,
      [now, cutoffSession.session_id],
    );
    await expectParentShell(cutoff.hostCookie, '/app/parent/account', 403);
    await pool.query(
      `UPDATE onetime.v21_adult_sessions
          SET idle_expires_at = $1
        WHERE session_id = $2`,
      [originalIdleExpiry, cutoffSession.session_id],
    );

    await pool.query(
      `UPDATE onetime.v21_adult_sessions
          SET revoked_at = $1,
              revoke_reason = 'explicit_revocation'
        WHERE session_id = $2`,
      [now, cutoffSession.session_id],
    );
    await expectParentShell(cutoff.hostCookie, '/app/parent/account', 403);

    const legacyUserKey = await createAccountUser({
      pool,
      config,
      email: 'legacy-parent@example.test',
      password: 'LegacyParentPassword!234',
      displayName: 'Legacy Parent',
      role: 'parent',
    });
    const legacyUser = await getSessionUserByKey({ pool, config, userKey: legacyUserKey });
    if (!legacyUser) throw new Error('missing legacy Parent fixture');
    await pool.query(
      `INSERT INTO onetime.portal_households
         (household_key, account_key, product_key, display_name)
       VALUES ('legacy_composition_household', $1, $2, 'Legacy composition household')`,
      [config.accountKey, config.productKey],
    );
    await pool.query(
      `INSERT INTO onetime.portal_guardian_relationships
         (relationship_key, account_key, product_key, household_key, guardian_user_ref,
          relationship_label, authority)
       VALUES ('legacy_composition_relationship', $1, $2, 'legacy_composition_household', $3,
         'Parent', 'primary_guardian')`,
      [config.accountKey, config.productKey, legacyUserKey],
    );
    const legacySession = await createSession({
      pool,
      config,
      user: legacyUser,
      assuranceMethod: 'password',
    });
    const legacyCookie = `otcrm_session=${encodeURIComponent(legacySession.session_token)}`;
    await expectParentShell(legacyCookie, '/app/parent', 200);
    await expectParentShell(
      `__Host-onetime-session=malformed; ${legacyCookie}`,
      '/app/parent',
      403,
    );
  });
});

async function submitFamily(
  email: string,
  firstName: string,
  lastName: string,
): Promise<SignupResult> {
  const bootstrapResponse = await fetch(`${baseUrl}/api/v1/signup/family/bootstrap`);
  expect(bootstrapResponse.status).toBe(200);
  const bootstrap = (await bootstrapResponse.json()) as {
    idempotency_key: string;
    csrf_token: string;
    writes_allowed: boolean;
  };
  expect(bootstrap.writes_allowed).toBe(true);
  const csrfCookie = bootstrapResponse.headers
    .getSetCookie()
    .find((value) => value.startsWith('ot_family_signup_csrf='))
    ?.split(';')[0];
  if (!csrfCookie) throw new Error('missing Family-signup CSRF cookie');

  const response = await fetch(`${baseUrl}/api/v1/signup/family`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: csrfCookie,
      origin: config.publicBaseUrl,
      'x-csrf-token': bootstrap.csrf_token,
    },
    body: JSON.stringify({
      classification: 'family',
      idempotency_key: bootstrap.idempotency_key,
      first_name: firstName,
      last_name: lastName,
      email,
      password: 'correct horse battery staple',
      password_confirmation: 'correct horse battery staple',
      timezone: 'Asia/Jerusalem',
      terms_accepted: true,
      privacy_accepted: true,
      general_marketing_consent: false,
      parent_newsletter_consent: true,
    }),
  });
  const body = (await response.json()) as Record<string, unknown>;
  expect(JSON.stringify(body)).not.toContain(email);
  const hostCookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('__Host-onetime-session='))
    ?.split(';')[0];
  if (!hostCookie) throw new Error(`missing v2.1 Parent session cookie: ${JSON.stringify(body)}`);
  const browserToken = decodeURIComponent(hostCookie.slice(hostCookie.indexOf('=') + 1));
  const projection = await signupProjection(email);
  return { response, body, hostCookie, browserToken, projection };
}

async function signupProjection(normalizedEmail: string): Promise<SignupProjection> {
  const result = await pool.query(
    `SELECT adult.adult_id,
            account.human_account_id,
            household.household_id,
            access.current_state AS access_state
       FROM onetime.v21_adult_identities AS adult
       JOIN onetime.v21_human_accounts AS account
         ON account.adult_id = adult.adult_id
       JOIN onetime.v21_households AS household
         ON household.owner_adult_id = adult.adult_id
        AND household.owner_human_account_id = account.human_account_id
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = 'access'
        AND access.aggregate_key = household.household_id
      WHERE adult.normalized_email = $1`,
    [normalizedEmail],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error(`missing signup projection for ${normalizedEmail}`);
  return {
    adult_id: String(row.adult_id),
    human_account_id: String(row.human_account_id),
    household_id: String(row.household_id),
    access_state: String(row.access_state) as SignupProjection['access_state'],
  };
}

async function sessionRow(humanAccountId: string) {
  const result = await pool.query(
    `SELECT session_id,
            active_household_id,
            access_token_digest,
            refresh_token_digest,
            idle_expires_at,
            absolute_expires_at,
            revoked_at
       FROM onetime.v21_adult_sessions
      WHERE human_account_id = $1`,
    [humanAccountId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error(`missing v2.1 session for ${humanAccountId}`);
  return row;
}

async function expectDigestOnlySessionPersistence(signup: SignupResult) {
  const row = await sessionRow(signup.projection.human_account_id);
  expect(String(row.access_token_digest)).toMatch(/^[a-f0-9]{64}$/u);
  expect(String(row.refresh_token_digest)).toMatch(/^[a-f0-9]{64}$/u);
  expect(row.access_token_digest).not.toBe(row.refresh_token_digest);

  const payloadSegment = signup.browserToken.split('.')[1];
  if (!payloadSegment) throw new Error('missing signed Parent-session payload');
  const claims = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as {
    access_material: string;
    refresh_material: string;
  };
  const persisted = JSON.stringify(row);
  expect(persisted).not.toContain(signup.browserToken);
  expect(persisted).not.toContain(claims.access_material);
  expect(persisted).not.toContain(claims.refresh_material);
}

async function expectParentShell(cookie: string, route: string, expectedStatus: number) {
  const response = await fetch(`${baseUrl}${route}`, { headers: { cookie } });
  const body = await response.text();
  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get('cache-control')).toContain('no-store');
  if (expectedStatus === 200) expect(body).toContain('V21_PARENT_SHELL');
  else expect(body).not.toContain('V21_PARENT_SHELL');
}

function pgMemCompatiblePool(memoryPool: DbPool): DbPool {
  const wrapQuery = <T extends DbPool['query']>(query: T, receiver: object): T => {
    const invoke = query.bind(receiver) as unknown as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) => {
      const [statement, ...rest] = args;
      const rewritten =
        typeof statement === 'string'
          ? rewritePgMemLockClause(statement)
          : statement &&
              typeof statement === 'object' &&
              'text' in statement &&
              typeof statement.text === 'string'
            ? { ...statement, text: rewritePgMemLockClause(statement.text) }
            : statement;
      const result = invoke(rewritten, ...rest);
      if (result && typeof result === 'object' && 'catch' in result) {
        return result;
      }
      return result;
    }) as T;
  };

  return {
    query: wrapQuery(memoryPool.query, memoryPool),
    connect: (async () => {
      const client = await memoryPool.connect();
      return new Proxy(client, {
        get(target, property, receiver) {
          if (property === 'query') return wrapQuery(target.query, target);
          const value = Reflect.get(target, property, receiver) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    }) as DbPool['connect'],
    end: memoryPool.end.bind(memoryPool) as DbPool['end'],
  };
}

function rewritePgMemLockClause(statement: string): string {
  return statement
    .replace('FOR SHARE OF request, receipt', 'FOR SHARE')
    .replace('FOR UPDATE OF household', 'FOR UPDATE');
}

function createDbBackedTestAdultSessionRepository(db: DbPool): V21AdultSessionRepository {
  return {
    create: async (input) => {
      const identity = await readExactParentIdentity(db, input);
      if (!identity) throw new Error('Parent-session identity binding is not eligible');
      const idleExpiresAt = new Date(
        input.issuedAt.getTime() + ADULT_SESSION_POLICY.parent.idleMilliseconds,
      );
      const absoluteExpiresAt = new Date(
        input.issuedAt.getTime() + ADULT_SESSION_POLICY.parent.absoluteMilliseconds,
      );
      const inserted = await db.query(
        `INSERT INTO onetime.v21_adult_sessions
           (session_id, human_account_id, active_role, active_household_id,
            access_token_digest, refresh_token_digest, security_version, version,
            idle_expires_at, absolute_expires_at, product_key, runtime_tier,
            verification_environment_id, created_at, updated_at)
         VALUES ($1,$2,'parent',$3,$4,$5,$6::bigint,1,$7::timestamptz,$8::timestamptz,
                 'one_time_mishnayos',$9,$10,$11::timestamptz,$11::timestamptz)
         RETURNING *`,
        [
          input.sessionId,
          input.humanAccountId,
          input.householdId,
          input.accessTokenDigest,
          input.refreshTokenDigest,
          input.securityVersion,
          idleExpiresAt,
          absoluteExpiresAt,
          input.runtimeTier,
          input.verificationEnvironmentId,
          input.issuedAt,
        ],
      );
      const session = inserted.rows[0] as Record<string, unknown> | undefined;
      if (inserted.rowCount !== 1 || !session) throw new Error('Parent session was not inserted');
      return resolvedParentSession(input.adultId, identity, session);
    },
    resolve: async (input) => {
      const digestColumn =
        input.tokenKind === 'access' ? 'access_token_digest' : 'refresh_token_digest';
      const result = await db.query(
        `SELECT *
           FROM onetime.v21_adult_sessions
          WHERE session_id = $1
            AND human_account_id = $2
            AND active_role = 'parent'
            AND active_household_id = $3
            AND product_key = 'one_time_mishnayos'
            AND runtime_tier = $4
            AND verification_environment_id = $5
            AND security_version = $6::bigint
            AND ${digestColumn} = $7
            AND revoked_at IS NULL
            AND idle_expires_at > $8::timestamptz
            AND absolute_expires_at > $8::timestamptz`,
        [
          input.sessionId,
          input.humanAccountId,
          input.householdId,
          input.runtimeTier,
          input.verificationEnvironmentId,
          input.securityVersion,
          input.tokenDigest,
          input.now,
        ],
      );
      const session = result.rows[0] as Record<string, unknown> | undefined;
      if (result.rowCount !== 1 || !session) return null;
      const identity = await readExactParentIdentity(db, input);
      return identity ? resolvedParentSession(input.adultId, identity, session) : null;
    },
    revoke: async (input) => {
      const digestColumn =
        input.tokenKind === 'access' ? 'access_token_digest' : 'refresh_token_digest';
      const result = await db.query(
        `UPDATE onetime.v21_adult_sessions
            SET revoked_at = $8::timestamptz,
                revoke_reason = $9,
                version = version + 1,
                updated_at = $8::timestamptz
          WHERE session_id = $1
            AND human_account_id = $2
            AND active_household_id = $3
            AND runtime_tier = $4
            AND verification_environment_id = $5
            AND security_version = $6::bigint
            AND ${digestColumn} = $7
            AND revoked_at IS NULL
          RETURNING session_id`,
        [
          input.sessionId,
          input.humanAccountId,
          input.householdId,
          input.runtimeTier,
          input.verificationEnvironmentId,
          input.securityVersion,
          input.tokenDigest,
          input.now,
          input.reason,
        ],
      );
      return result.rowCount === 1;
    },
  };
}

type ExactParentIdentity = {
  normalizedEmail: string;
  ownerDisplayName: string;
  classification: 'family' | 'school';
  accessState: 'free' | 'active' | 'grace' | 'inactive';
};

async function readExactParentIdentity(
  db: DbPool,
  input: {
    adultId: string;
    humanAccountId: string;
    householdId: string;
    runtimeTier: 'isolated_staging' | 'production';
    verificationEnvironmentId:
      | 'ci'
      | 'provider_sandbox'
      | 'persistent_staging'
      | 'production_read_only'
      | 'production_operator_canary'
      | 'production_broad';
    securityVersion: number;
  },
): Promise<ExactParentIdentity | null> {
  const scope = [input.runtimeTier, input.verificationEnvironmentId] as const;
  const account = await db.query(
    `SELECT human_account_id
       FROM onetime.v21_human_accounts
      WHERE human_account_id = $1
        AND adult_id = $2
        AND state = 'active'
        AND security_version = $3::bigint
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $4
        AND verification_environment_id = $5`,
    [input.humanAccountId, input.adultId, input.securityVersion, ...scope],
  );
  const adult = await db.query(
    `SELECT normalized_email, display_name
       FROM onetime.v21_adult_identities
      WHERE adult_id = $1
        AND state = 'active'
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $2
        AND verification_environment_id = $3`,
    [input.adultId, ...scope],
  );
  const membership = await db.query(
    `SELECT membership_id
       FROM onetime.v21_human_account_role_memberships
      WHERE human_account_id = $1
        AND role = 'parent'
        AND revoked_at IS NULL
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $2
        AND verification_environment_id = $3`,
    [input.humanAccountId, ...scope],
  );
  const household = await db.query(
    `SELECT classification
       FROM onetime.v21_households
      WHERE household_id = $1
        AND owner_adult_id = $2
        AND owner_human_account_id = $3
        AND state = 'active'
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $4
        AND verification_environment_id = $5`,
    [input.householdId, input.adultId, input.humanAccountId, ...scope],
  );
  let access = await db.query(
    `SELECT current_state
       FROM onetime.canonical_aggregate_states
      WHERE aggregate_kind = 'access'
        AND aggregate_key = $1
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $2
        AND verification_environment_id = $3
        AND current_state IN ('free','active','grace','inactive')
        AND archived_at IS NULL`,
    [input.householdId, ...scope],
  );
  if (access.rowCount === 0) {
    await materializePgMemAccessState(db, input.householdId, ...scope);
    access = await db.query(
      `SELECT current_state
         FROM onetime.canonical_aggregate_states
        WHERE aggregate_kind = 'access'
          AND aggregate_key = $1
          AND product_key = 'one_time_mishnayos'
          AND runtime_tier = $2
          AND verification_environment_id = $3
          AND current_state IN ('free','active','grace','inactive')
          AND archived_at IS NULL`,
      [input.householdId, ...scope],
    );
  }
  if (
    account.rowCount !== 1 ||
    adult.rowCount !== 1 ||
    membership.rowCount !== 1 ||
    household.rowCount !== 1 ||
    access.rowCount !== 1
  ) {
    return null;
  }
  const adultRow = adult.rows[0] as Record<string, unknown>;
  const householdRow = household.rows[0] as Record<string, unknown>;
  const accessRow = access.rows[0] as Record<string, unknown>;
  const classification = String(householdRow.classification);
  const accessState = String(accessRow.current_state);
  if (
    (classification !== 'family' && classification !== 'school') ||
    !['free', 'active', 'grace', 'inactive'].includes(accessState)
  ) {
    return null;
  }
  return {
    normalizedEmail: String(adultRow.normalized_email),
    ownerDisplayName: String(adultRow.display_name).trim(),
    classification,
    accessState: accessState as ExactParentIdentity['accessState'],
  };
}

async function materializePgMemAccessState(
  db: DbPool,
  householdId: string,
  runtimeTier: 'isolated_staging' | 'production',
  verificationEnvironmentId: ExactParentIdentityScope['verificationEnvironmentId'],
) {
  const transition = await db.query(
    `SELECT transition_key, aggregate_kind, aggregate_key, next_state, resulting_version,
            product_key, runtime_tier, verification_environment_id,
            actor_kind, actor_key, created_at
       FROM onetime.canonical_state_transition_events
      WHERE aggregate_kind = 'access'
        AND aggregate_key = $1
        AND previous_state IS NULL
        AND expected_version = 0
        AND resulting_version = 1
        AND product_key = 'one_time_mishnayos'
        AND runtime_tier = $2
        AND verification_environment_id = $3`,
    [householdId, runtimeTier, verificationEnvironmentId],
  );
  const event = transition.rows[0] as Record<string, unknown> | undefined;
  if (transition.rowCount !== 1 || !event) return;
  await db.query(
    `INSERT INTO onetime.canonical_aggregate_states
       (aggregate_kind, aggregate_key, current_state, version, product_key,
        runtime_tier, verification_environment_id, last_transition_key,
        created_by_actor_kind, created_by_actor_key, last_mutated_by_actor_kind,
        last_mutated_by_actor_key, archived_at, created_at, updated_at)
     VALUES ('access',$1,$2,$3::bigint,'one_time_mishnayos',$4,$5,$6,$7,$8,$7,$8,
             NULL,$9::timestamptz,$9::timestamptz)
     ON CONFLICT (aggregate_kind, aggregate_key) DO NOTHING`,
    [
      householdId,
      event.next_state,
      event.resulting_version,
      runtimeTier,
      verificationEnvironmentId,
      event.transition_key,
      event.actor_kind,
      event.actor_key,
      event.created_at,
    ],
  );
}

type ExactParentIdentityScope = Parameters<typeof readExactParentIdentity>[1];

function resolvedParentSession(
  adultId: string,
  identity: ExactParentIdentity,
  session: Record<string, unknown>,
): ResolvedV21ParentSession {
  return {
    adultId,
    normalizedEmail: identity.normalizedEmail,
    ownerDisplayName: identity.ownerDisplayName,
    session: {
      sessionId: String(session.session_id),
      product: 'one_time_mishnayos',
      runtimeTier: String(session.runtime_tier) as 'isolated_staging' | 'production',
      verificationEnvironmentId: String(
        session.verification_environment_id,
      ) as ResolvedV21ParentSession['session']['verificationEnvironmentId'],
      humanAccountId: String(session.human_account_id),
      activeRole: 'parent',
      activeHouseholdId: String(session.active_household_id),
      securityVersion: Number(session.security_version),
      version: Number(session.version),
      idleExpiresAt: instant(session.idle_expires_at),
      absoluteExpiresAt: instant(session.absolute_expires_at),
      revokedAt: session.revoked_at ? instant(session.revoked_at) : null,
      revocationReason: session.revoke_reason ? String(session.revoke_reason) : null,
      createdAt: instant(session.created_at),
      updatedAt: instant(session.updated_at),
    },
    household: {
      householdId: String(session.active_household_id),
      displayName: `${identity.ownerDisplayName} ${
        identity.classification === 'family' ? 'household' : 'school'
      }`,
      classification: identity.classification,
      accessState: identity.accessState,
      ownerRelationship: 'account_owner',
    },
  };
}

function instant(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
