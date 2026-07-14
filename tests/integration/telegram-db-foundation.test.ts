import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../packages/config/src/index.ts';
import {
  asBotKey,
  asCanonicalUserKey,
  asChatRef,
  asProviderUserRef,
  type NormalizedBotUpdate,
} from '../../packages/contracts/src/telegram/types.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  TelegramSqlConfirmationRepository,
  TelegramSqlConsumerLeaseRepository,
  TelegramSqlInboxRepository,
  TelegramSqlIdentityMappingRepository,
} from '../../packages/db/src/telegram/repositories.ts';
import { createAccountUser } from '../../packages/domain/src/index.ts';
import { DeterministicTestPayloadCodec } from '../../packages/domain/src/telegram/crypto.ts';

let pool: DbPool;

const botKey = asBotKey('one_time_internal_ops');
const providerUserRef = asProviderUserRef('telegram_user_fixture');
const chatRef = asChatRef('telegram_chat_fixture');

beforeEach(async () => {
  pool = createMemoryPool();
});

afterEach(async () => {
  await pool.end();
});

describe('OT-51P durable PostgreSQL contract through pg-mem', () => {
  it('applies all migrations and documents pg-mem no-op rerun limitation', async () => {
    const first = await runMigrations(pool);
    expect(first.at(-1)?.id).toBe('1600_ot51_telegram_bot_foundation');
    const applied = await pool.query(
      "SELECT checksum FROM onetime.schema_migrations WHERE id = '1600_ot51_telegram_bot_foundation'",
    );
    expect(applied.rowCount).toBe(1);
    await expect(runMigrations(pool)).rejects.toThrow(/not supported/i);
  });

  it('enforces mapping, inbox, confirmation, lease, generation, and dead-letter rules', async () => {
    await runMigrations(pool);
    const config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    });
    const userKey = await createAccountUser({
      pool,
      config,
      email: 'owner@example.test',
      password: 'Password!234',
      displayName: 'Owner',
      role: 'owner',
      mfaCapable: true,
    });
    await pool.query(
      `INSERT INTO onetime.telegram_bot_registry
       (bot_key, environment, account_key, product_key, token_fingerprint_hash, status)
       VALUES ($1,'local',$2,$3,$4,'active')`,
      [botKey, config.accountKey, config.productKey, 'token_fp_fixture'],
    );

    const mappings = new TelegramSqlIdentityMappingRepository(pool);
    await mappings.upsertProtectedMapping({
      mappingKey: 'mapping_1',
      botKey,
      environment: 'local',
      providerUserRef,
      canonicalUserKey: asCanonicalUserKey(userKey),
      accountKey: config.accountKey,
      productKey: config.productKey,
      membershipKey: 'membership_owner',
      securityVersion: 1,
      status: 'active',
    });
    await expect(
      mappings.upsertProtectedMapping({
        mappingKey: 'mapping_2',
        botKey,
        environment: 'local',
        providerUserRef,
        canonicalUserKey: asCanonicalUserKey(userKey),
        accountKey: config.accountKey,
        productKey: config.productKey,
        membershipKey: 'membership_owner',
        securityVersion: 1,
        status: 'active',
      }),
    ).rejects.toThrow();
    expect(
      await mappings.findActiveMapping({ botKey, environment: 'local', providerUserRef }),
    ).toMatchObject({
      mappingKey: 'mapping_1',
      accountKey: config.accountKey,
    });

    const codec = new DeterministicTestPayloadCodec();
    const inbox = new TelegramSqlInboxRepository(pool);
    const update = updateFixture('700');
    const payloadRef = await codec.encrypt(update, {
      botKey,
      environment: 'local',
      classification: 'normalized_update',
    });
    const first = await inbox.enqueue(update, payloadRef);
    const duplicate = await inbox.enqueue(update, payloadRef);
    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);

    const claimed = await inbox.claimNext(new Date('2026-07-15T10:00:00Z'), 'worker-a', 50);
    expect(claimed?.leaseGeneration).toBe(1);
    expect(await inbox.complete(first.inboxKey, 999)).toBe(false);
    expect(await inbox.complete(first.inboxKey, 1)).toBe(true);

    const retryUpdate = updateFixture('701');
    const retryPayload = await codec.encrypt(retryUpdate, {
      botKey,
      environment: 'local',
      classification: 'normalized_update',
    });
    const retry = await inbox.enqueue(retryUpdate, retryPayload);
    const retryClaim = await inbox.claimNext(new Date('2026-07-15T10:00:00Z'), 'worker-a', 50);
    expect(retryClaim?.inboxKey).toBe(retry.inboxKey);
    expect(
      await inbox.deadLetter(retry.inboxKey, retryClaim?.leaseGeneration ?? 0, 'fixture_error'),
    ).toBe(true);
    const deadLetters = await pool.query(
      'SELECT count(*)::int AS count FROM onetime.telegram_dead_letters',
    );
    expect(Number(deadLetters.rows[0].count)).toBe(1);

    const confirmations = new TelegramSqlConfirmationRepository(pool);
    await confirmations.create({
      confirmationKey: 'confirm_1',
      botKey,
      environment: 'local',
      providerUserRef,
      chatRef,
      actorUserKey: asCanonicalUserKey(userKey),
      accountKey: config.accountKey,
      productKey: config.productKey,
      capability: 'task_create',
      actionDigest: 'action_digest',
      securityVersion: 1,
      idempotencyKey: 'idem_1',
      payloadRef: {
        ciphertext: 'ciphertext',
        digest: 'digest',
        classification: 'confirmation_payload',
      },
      expiresAt: '2026-07-14T10:05:00Z',
    });
    expect(await confirmations.consume('confirm_1', new Date('2026-07-14T10:00:00Z'))).toBe(
      'consumed',
    );
    expect(await confirmations.consume('confirm_1', new Date('2026-07-14T10:00:01Z'))).toBe(
      'already_consumed',
    );

    const leases = new TelegramSqlConsumerLeaseRepository(pool);
    const acquired = await leases.acquire({
      botKey,
      environment: 'local',
      tokenFingerprint: 'token_fp_fixture',
      ownerId: 'owner-a',
      leaseMs: 50,
      now: new Date('2026-07-14T10:00:00Z'),
    });
    expect(acquired).toMatchObject({ acquired: true, generation: 1 });
    const denied = await leases.acquire({
      botKey,
      environment: 'local',
      tokenFingerprint: 'token_fp_fixture',
      ownerId: 'owner-b',
      leaseMs: 50,
      now: new Date('2026-07-14T10:00:01Z'),
    });
    expect(denied).toMatchObject({ acquired: true, generation: 2 });
    const blocked = await leases.acquire({
      botKey,
      environment: 'local',
      tokenFingerprint: 'token_fp_fixture',
      ownerId: 'owner-c',
      leaseMs: 50,
      now: new Date('2026-07-14T10:00:01.010Z'),
    });
    expect(blocked).toMatchObject({ acquired: false, reason: 'already_owned' });
  });
});

function updateFixture(updateId: string): NormalizedBotUpdate {
  return {
    updateId,
    kind: 'message',
    botKey,
    environment: 'local',
    providerUserRef,
    chatRef,
    chatContext: 'private',
    text: 'status',
    isForwarded: false,
    isEdited: false,
    isAnonymousAdmin: false,
    receivedAt: '2026-07-14T10:00:00Z',
  };
}
