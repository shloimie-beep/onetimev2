import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { hashPassword } from '../../../packages/domain/src/auth/service.ts';
import { normalizeEmail, stableKey } from '../../../packages/domain/src/lead/normalize.ts';
import { runW13ProductionIdentityActivation } from '../../../scripts/w13-102/identity/production-identity-activation.ts';

const RUNTIME_SHA = '466d8489bb8c7a3a57f7590929b58e7857420e86';
const AUTH_PHRASE = 'w13-102-test-authorization';
const NOW = new Date('2026-07-18T20:15:00.000Z');

let pool: DbPool;
let config: AppConfig;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: RUNTIME_SHA,
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_ACCOUNT_KEY: 'w13_102_identity_account',
    ONE_TIME_PRODUCT_KEY: 'w13_102_identity_product',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
});

describe('W13-102 production identity activation command', () => {
  it('reports missing private manifest fields without printing destinations', async () => {
    const report = await runW13ProductionIdentityActivation({
      pool,
      config,
      now: NOW,
      manifest: {
        schema_version: 'onetime.w13_102.identity_authorization.private.v1',
        run_id: 'W13-102',
        expected_runtime_source_sha: '',
        expires_at: '',
        recipients: {
          owner: {
            role: 'owner',
            destination: '',
            operator_controls_destination: false,
            send_now: false,
            max_message_count: 0,
          },
        },
      },
    });

    expect(report.status).toBe('dry_run_blocked');
    expect(report.missing_field_names_only).toContain('identity_authorization.expires_at');
    expect(report.missing_field_names_only).toContain(
      'identity_authorization.expected_runtime_source_sha',
    );
    expect(JSON.stringify(report)).not.toMatch(/@|token_for_local_proof|reset-password#token=/i);
  });

  it('plans an existing administrator reset in dry-run mode without mutating lifecycle tables', async () => {
    await seedUser('owner@example.test', 'Owner', 'owner');
    await seedUser('admin@example.test', 'Admin', 'admin');

    const report = await runW13ProductionIdentityActivation({
      pool,
      config,
      now: NOW,
      roles: ['administrator'],
      manifest: manifestForAdmin('admin@example.test'),
    });

    expect(report.status).toBe('dry_run_planned');
    expect(report.roles).toEqual([
      expect.objectContaining({
        role: 'administrator',
        operation: 'password_reset',
        status: 'planned',
        reason_code: null,
      }),
    ]);
    expect(await tableCount('account_lifecycle_tokens')).toBe(0);
    expect(await tableCount('account_lifecycle_delivery_outbox')).toBe(0);
    expect(JSON.stringify(report)).not.toContain('admin@example.test');
  });

  it('refuses apply without the ephemeral authorization phrase', async () => {
    await seedUser('owner@example.test', 'Owner', 'owner');
    await seedUser('admin@example.test', 'Admin', 'admin');

    const report = await runW13ProductionIdentityActivation({
      pool,
      config,
      now: NOW,
      apply: true,
      roles: ['administrator'],
      emailLaneStatus: 'proven',
      manifest: manifestForAdmin('admin@example.test'),
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('ephemeral_authorization_missing');
    expect(await tableCount('account_lifecycle_tokens')).toBe(0);
  });

  it('applies an existing administrator reset idempotently without returning raw token material', async () => {
    await seedUser('owner@example.test', 'Owner', 'owner');
    await seedUser('admin@example.test', 'Admin', 'admin');

    const first = await runW13ProductionIdentityActivation({
      pool,
      config,
      now: NOW,
      apply: true,
      roles: ['administrator'],
      emailLaneStatus: 'proven',
      authorizationPhrase: AUTH_PHRASE,
      manifest: manifestForAdmin('admin@example.test'),
    });

    expect(first.status).toBe('applied');
    expect(first.roles[0]).toEqual(
      expect.objectContaining({
        role: 'administrator',
        operation: 'password_reset',
        status: 'applied',
        external_send_performed: false,
      }),
    );
    expect(JSON.stringify(first)).not.toContain('admin@example.test');
    expect(JSON.stringify(first)).not.toMatch(/token_for_local_proof|reset-password#token=/i);
    expect(await tableCount('account_lifecycle_tokens')).toBe(1);
    expect(await tableCount('account_lifecycle_delivery_outbox')).toBe(1);

    const second = await runW13ProductionIdentityActivation({
      pool,
      config,
      now: new Date('2026-07-18T20:16:00.000Z'),
      apply: true,
      roles: ['administrator'],
      emailLaneStatus: 'proven',
      authorizationPhrase: AUTH_PHRASE,
      manifest: manifestForAdmin('admin@example.test'),
    });

    expect(second.status).toBe('applied');
    expect(second.roles[0]).toEqual(expect.objectContaining({ status: 'already_issued' }));
    expect(await tableCount('account_lifecycle_tokens')).toBe(1);
    expect(await tableCount('account_lifecycle_delivery_outbox')).toBe(1);
  });
});

function manifestForAdmin(destination: string) {
  return {
    schema_version: 'onetime.w13_102.identity_authorization.private.v1',
    run_id: 'W13-102',
    expires_at: '2026-07-18T21:00:00.000Z',
    expected_runtime_source_sha: RUNTIME_SHA,
    authorization_phrase_sha256: sha256(AUTH_PHRASE),
    recipients: {
      administrator: {
        role: 'administrator',
        destination,
        operator_controls_destination: true,
        send_now: true,
        max_message_count: 1,
      },
    },
  };
}

async function seedUser(email: string, displayName: string, role: 'owner' | 'admin') {
  const normalized = normalizeEmail(email);
  await pool.query(
    `INSERT INTO onetime.account_users
       (user_key, account_key, product_key, email_normalized, display_name, role,
        password_hash, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$8)`,
    [
      stableKey('test_user', [config.accountKey, config.productKey, normalized]),
      config.accountKey,
      config.productKey,
      normalized,
      displayName,
      role,
      await hashPassword('W13TestPass!234'),
      NOW,
    ],
  );
}

async function tableCount(tableName: string) {
  const result = await pool.query(`SELECT count(*)::int AS count FROM onetime.${tableName}`);
  return Number(result.rows[0]?.count ?? 0);
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
