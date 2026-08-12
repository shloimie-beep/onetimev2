import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAdminDirectoryRouter } from '../../../apps/web/src/server/features/admin-directory/router.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  createAccountUser,
  createAdminHousehold,
  createAdminLearner,
  type AuthenticatedSession,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let ownerUserKey: string;
let learnerKey: string;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    ONE_TIME_ACCOUNT_KEY: 'admin_setup_disabled_account',
    ONE_TIME_PRODUCT_KEY: 'admin_setup_disabled_product',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  ownerUserKey = await createAccountUser({
    pool,
    config,
    email: 'setup-disabled.owner@example.test',
    password: 'SetupDisabledOwner!234',
    displayName: 'Setup Disabled Owner',
    role: 'owner',
  });
  const actor = { userKey: ownerUserKey, role: 'owner' };
  const household = await createAdminHousehold({
    pool,
    config,
    actor,
    payload: {
      display_name: 'Setup Disabled Household',
      idempotency_key: 'setup-disabled-household-0001',
    },
  });
  const learner = await createAdminLearner({
    pool,
    config,
    actor,
    payload: {
      household_key: household.household_key,
      display_name: 'Setup Disabled Student',
      hebrew_name: null,
      grade_label: null,
      idempotency_key: 'setup-disabled-learner-0001',
    },
  });
  learnerKey = learner.learner_key;
});

afterEach(async () => {
  await pool.end();
});

describe('Admin Student setup launch boundary', () => {
  it('leaves the retired POST unmounted and creates no setup token or state mutation', async () => {
    const session: AuthenticatedSession = {
      session_key: 'setup-disabled-session',
      user: {
        user_key: ownerUserKey,
        email: 'setup-disabled.owner@example.test',
        display_name: 'Setup Disabled Owner',
        role: 'owner',
        role_label: 'Owner',
        mfa_capable: false,
      },
      expires_at: '2026-08-13T00:00:00.000Z',
      assurance_method: 'password',
      assurance_at: '2026-08-12T00:00:00.000Z',
    };
    let sessionLookups = 0;
    const app = express();
    app.use(express.json());
    app.use(
      '/api/v1/admin-directory',
      createAdminDirectoryRouter({
        pool,
        config,
        resolveSession: async () => {
          sessionLookups += 1;
          return session;
        },
        verifyCsrf: async () => true,
        verifyRecentAssurance: async () => true,
      }),
    );
    const server = await listenForTest(app);
    const before = await mutationSnapshot();
    try {
      const response = await fetch(
        `${server.baseUrl}/api/v1/admin-directory/learners/${encodeURIComponent(learnerKey)}/student-setup`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: 'adult@example.test',
            idempotency_key: 'retired-admin-student-setup-0001',
          }),
        },
      );
      expect(response.status).toBe(404);
      expect(sessionLookups).toBe(0);
      await expect(mutationSnapshot()).resolves.toEqual(before);
    } finally {
      await server.close();
    }
  });
});

async function mutationSnapshot() {
  const access = await pool.query(
    `SELECT status, last_operation_type, last_operation_at, version
       FROM onetime.portal_student_access_state
      WHERE account_key = $1 AND product_key = $2 AND learner_key = $3`,
    [config.accountKey, config.productKey, learnerKey],
  );
  const effects = await pool.query(
    `SELECT
       (SELECT count(*)::int
          FROM onetime.account_lifecycle_tokens
         WHERE account_key = $1 AND product_key = $2
           AND token_type = 'student_setup' AND learner_key = $3) AS token_count,
       (SELECT count(*)::int
          FROM onetime.account_lifecycle_delivery_intents AS intents
          JOIN onetime.account_lifecycle_tokens AS tokens
            ON tokens.account_key = intents.account_key
           AND tokens.product_key = intents.product_key
           AND tokens.token_key = intents.token_key
         WHERE tokens.account_key = $1 AND tokens.product_key = $2
           AND tokens.token_type = 'student_setup' AND tokens.learner_key = $3) AS intent_count,
       (SELECT count(*)::int
          FROM onetime.account_lifecycle_delivery_outbox AS outbox
          JOIN onetime.account_lifecycle_tokens AS tokens
            ON tokens.account_key = outbox.account_key
           AND tokens.product_key = outbox.product_key
           AND tokens.token_key = outbox.token_key
         WHERE tokens.account_key = $1 AND tokens.product_key = $2
           AND tokens.token_type = 'student_setup' AND tokens.learner_key = $3) AS outbox_count`,
    [config.accountKey, config.productKey, learnerKey],
  );
  const row = access.rows[0] as Record<string, unknown>;
  return {
    status: String(row.status),
    lastOperationType: row.last_operation_type ?? null,
    lastOperationAt: row.last_operation_at
      ? new Date(String(row.last_operation_at)).toISOString()
      : null,
    version: Number(row.version),
    tokenCount: Number(effects.rows[0]?.token_count),
    intentCount: Number(effects.rows[0]?.intent_count),
    outboxCount: Number(effects.rows[0]?.outbox_count),
  };
}

async function listenForTest(app: ReturnType<typeof express>) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
