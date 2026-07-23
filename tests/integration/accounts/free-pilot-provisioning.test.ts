import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it } from 'vitest';

import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  applyHouseholdAccessState,
  readHouseholdAccess,
} from '../../../packages/domain/src/access/service.ts';
import {
  assertReviewedStagingRuntime,
  REVIEWED_STAGING_FREE_PILOT_AUTHORIZATION,
  runReviewedFreePilotCommand,
} from '../../../scripts/access/free-pilot.ts';

const NOW = new Date('2026-07-23T12:00:00.000Z');
const EXPIRES_AT = new Date('2026-08-22T12:00:00.000Z');
const ACCOUNT_KEY = 'account_alpha';
const PRODUCT_KEY = 'product_alpha';
const HOUSEHOLD_KEY = 'household_alpha';
const SOURCE_REFERENCE = 'operator_free_pilot_alpha';

let pool: DbPool;
let config: AppConfig;

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
  config = loadConfig({
    NODE_ENV: 'test',
    DELIVERY_ENVIRONMENT: 'test',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'test',
    ONE_TIME_ACCOUNT_KEY: ACCOUNT_KEY,
    ONE_TIME_PRODUCT_KEY: PRODUCT_KEY,
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
  await seedHousehold(HOUSEHOLD_KEY);
});

describe('reviewed free-pilot provisioning', () => {
  it('grants, reads back, replays, and revokes without payment history or raw scope output', async () => {
    const grant = await runReviewedFreePilotCommand({
      pool,
      config,
      operation: 'grant',
      expectedAccountKey: ACCOUNT_KEY,
      expectedProductKey: PRODUCT_KEY,
      householdKey: HOUSEHOLD_KEY,
      authorizationPhrase: REVIEWED_STAGING_FREE_PILOT_AUTHORIZATION,
      idempotencyKey: 'operator-free-pilot-grant-alpha',
      policyVersion: 'controlled-free-pilot-v1',
      expiresAt: EXPIRES_AT,
      opaqueSourceReference: SOURCE_REFERENCE,
      now: NOW,
    });

    expect(grant).toEqual(
      expect.objectContaining({
        operation: 'grant',
        result_state: 'applied',
        current_state: 'active',
        grants_access: true,
        source_kind: 'free_pilot',
        source_revision: 1,
        expires_at: EXPIRES_AT.toISOString(),
        payment_history_written: false,
        credentials_printed: false,
        external_effects: 0,
      }),
    );
    expect(JSON.stringify(grant)).not.toContain(HOUSEHOLD_KEY);
    expect(JSON.stringify(grant)).not.toContain(SOURCE_REFERENCE);

    const replay = await runReviewedFreePilotCommand({
      pool,
      config,
      operation: 'grant',
      expectedAccountKey: ACCOUNT_KEY,
      expectedProductKey: PRODUCT_KEY,
      householdKey: HOUSEHOLD_KEY,
      authorizationPhrase: REVIEWED_STAGING_FREE_PILOT_AUTHORIZATION,
      idempotencyKey: 'operator-free-pilot-grant-alpha',
      policyVersion: 'controlled-free-pilot-v1',
      expiresAt: EXPIRES_AT,
      opaqueSourceReference: SOURCE_REFERENCE,
      now: NOW,
    });
    expect(replay.result_state).toBe('replayed');
    expect(replay.access_version).toBe(grant.access_version);
    expect(replay.source_revision).toBe(1);

    const revoke = await runReviewedFreePilotCommand({
      pool,
      config,
      operation: 'revoke',
      expectedAccountKey: ACCOUNT_KEY,
      expectedProductKey: PRODUCT_KEY,
      householdKey: HOUSEHOLD_KEY,
      authorizationPhrase: REVIEWED_STAGING_FREE_PILOT_AUTHORIZATION,
      idempotencyKey: 'operator-free-pilot-revoke-alpha',
      policyVersion: 'controlled-free-pilot-v1',
      reason: 'controlled_pilot_ended',
      now: new Date('2026-07-24T12:00:00.000Z'),
    });
    expect(revoke).toEqual(
      expect.objectContaining({
        operation: 'revoke',
        result_state: 'applied',
        current_state: 'revoked',
        grants_access: false,
        source_kind: 'free_pilot',
        source_revision: 2,
        payment_history_written: false,
      }),
    );

    const events = await pool.query(
      `SELECT decision, actor_kind
         FROM onetime.account_access_events
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3
        ORDER BY created_at`,
      [ACCOUNT_KEY, PRODUCT_KEY, HOUSEHOLD_KEY],
    );
    expect(events.rows).toEqual([
      expect.objectContaining({ decision: 'applied', actor_kind: 'admin' }),
      expect.objectContaining({ decision: 'applied', actor_kind: 'admin' }),
    ]);
  });

  it('cannot overwrite a higher-precedence current source', async () => {
    await applyHouseholdAccessState({
      pool,
      accountKey: ACCOUNT_KEY,
      productKey: PRODUCT_KEY,
      sourceKind: 'admin_override',
      actorKind: 'admin',
      idempotencyKey: 'admin-override-alpha',
      command: {
        household_key: HOUSEHOLD_KEY,
        state: 'active',
        effective_at: NOW.toISOString(),
        expires_at: null,
        opaque_source_reference: 'admin_override_alpha',
        source_revision: 1,
        source_updated_at: NOW.toISOString(),
        policy_version: 'admin-override-v1',
        revocation_reason: null,
      },
      now: NOW,
    });

    await expect(
      runReviewedFreePilotCommand({
        pool,
        config,
        operation: 'grant',
        expectedAccountKey: ACCOUNT_KEY,
        expectedProductKey: PRODUCT_KEY,
        householdKey: HOUSEHOLD_KEY,
        authorizationPhrase: REVIEWED_STAGING_FREE_PILOT_AUTHORIZATION,
        idempotencyKey: 'operator-free-pilot-after-admin-override',
        policyVersion: 'controlled-free-pilot-v1',
        expiresAt: EXPIRES_AT,
        opaqueSourceReference: SOURCE_REFERENCE,
        now: NOW,
      }),
    ).rejects.toMatchObject({
      code: 'ACCESS_SOURCE_PRECEDENCE',
    });

    const readback = await readHouseholdAccess({
      db: pool,
      accountKey: ACCOUNT_KEY,
      productKey: PRODUCT_KEY,
      householdKey: HOUSEHOLD_KEY,
      now: NOW,
    });
    expect(readback).toEqual(
      expect.objectContaining({
        source_kind: 'admin_override',
        opaque_source_reference: 'admin_override_alpha',
        access_version: 1,
        grants_access: true,
      }),
    );
  });

  it('fails closed outside reviewed scope and seed scripts have no projection upsert bypass', async () => {
    await expect(
      runReviewedFreePilotCommand({
        pool,
        config: {
          ...config,
          deliveryEnvironment: 'production',
          oneTimeRuntimeEnvironment: 'production',
        },
        operation: 'grant',
        expectedAccountKey: ACCOUNT_KEY,
        expectedProductKey: PRODUCT_KEY,
        householdKey: HOUSEHOLD_KEY,
        authorizationPhrase: REVIEWED_STAGING_FREE_PILOT_AUTHORIZATION,
        idempotencyKey: 'operator-free-pilot-production-denied',
        policyVersion: 'controlled-free-pilot-v1',
        expiresAt: EXPIRES_AT,
        opaqueSourceReference: SOURCE_REFERENCE,
        now: NOW,
      }),
    ).rejects.toThrow('free_pilot_command_forbidden_outside_reviewed_staging');

    expect(() =>
      assertReviewedStagingRuntime({
        deliveryEnvironment: 'production',
        oneTimeRuntimeEnvironment: 'isolated_staging',
      }),
    ).toThrow('free_pilot_command_forbidden_outside_reviewed_staging');
    expect(() =>
      assertReviewedStagingRuntime({
        deliveryEnvironment: 'isolated_staging',
        oneTimeRuntimeEnvironment: 'production',
      }),
    ).toThrow('free_pilot_command_forbidden_outside_reviewed_staging');

    const [previewProvisioner, contentDemoSeed] = await Promise.all([
      readFile('scripts/full-app-staging-live/provision-preview.ts', 'utf8'),
      readFile('scripts/media/content-factory-demo-seed.ts', 'utf8'),
    ]);
    for (const source of [previewProvisioner, contentDemoSeed]) {
      expect(source).toContain('grantBoundedFreePilotAccess');
      expect(source).not.toMatch(/INSERT\s+INTO\s+onetime\.account_access_projections/iu);
      expect(source).not.toMatch(/UPDATE\s+onetime\.account_access_projections/iu);
    }
    expect(contentDemoSeed).toContain('assertReviewedStagingRuntime');
    expect(contentDemoSeed).toContain(
      'content_factory_demo_seed_forbidden_outside_reviewed_staging',
    );
  });
});

async function seedHousehold(householdKey: string) {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name, status, created_at, updated_at)
     VALUES ($1,$2,$3,'Controlled Pilot Household','active',$4,$4)`,
    [householdKey, ACCOUNT_KEY, PRODUCT_KEY, NOW],
  );
}
