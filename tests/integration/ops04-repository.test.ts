import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  createPostgresOps04Repository,
  Ops04BatchConflictError,
} from '../../packages/db/src/ops04/repository.ts';
import {
  createOps04ApplyReceipt,
  createOps04DryRun,
  createSyntheticOps04Fixture,
} from '../../packages/domain/src/ops04/service.ts';

const actor = {
  accountKey: 'acct_ops04_synthetic',
  productKey: 'prod_ops04_synthetic',
  userKey: 'ops04_test_operator',
};

let pool: DbPool;
let repository: ReturnType<typeof createPostgresOps04Repository>;

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
  repository = createPostgresOps04Repository(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('OPS-04 PostgreSQL rehearsal repository', () => {
  it('records a dry run, applies synthetic ledger actions, replays, verifies, and rolls back', async () => {
    const request = createSyntheticOps04Fixture();
    const report = createOps04DryRun(request);
    const receipt = createOps04ApplyReceipt({ report, actor: actor.userKey });

    const recorded = await repository.recordDryRun({ actor, report });
    const replayedRecord = await repository.recordDryRun({ actor, report });
    const applied = await repository.applySyntheticBatch({ actor, report, receipt });
    const replayedApply = await repository.replaySyntheticBatch({ actor, report, receipt });
    const verified = await repository.verifyBatch(actor, report.batch_key);
    const rollback = await repository.rollbackBatch({
      actor,
      batchKey: report.batch_key,
      idempotencyKey: 'ops04-rollback-test-001',
      reason: 'test rollback',
    });
    const rollbackReplay = await repository.rollbackBatch({
      actor,
      batchKey: report.batch_key,
      idempotencyKey: 'ops04-rollback-test-001',
      reason: 'test rollback',
    });

    expect(recorded.replayed).toBe(false);
    expect(replayedRecord.replayed).toBe(true);
    expect(applied.replayed).toBe(false);
    expect(replayedApply.replayed).toBe(true);
    expect(applied.no_send_diff.zero_diff).toBe(true);
    expect(verified.no_send_diff.zero_diff).toBe(true);
    expect(rollback.no_send_diff.zero_diff).toBe(true);
    expect(rollback.rolled_back_actions).toBeGreaterThan(0);
    expect(rollbackReplay.replayed).toBe(true);

    await expectScalar(
      "SELECT count(*) FROM onetime.schema_migrations WHERE id = '2100_ops04_legacy_audience_migration'",
      '1',
    );
    await expectScalar('SELECT count(*) FROM onetime.contacts', '0');
    await expectScalar('SELECT count(*) FROM onetime.outbox_events', '0');
    await expectScalar('SELECT count(*) FROM onetime.whatsapp_outbox_messages', '0');
    await expectScalar('SELECT count(*) FROM onetime.ops04_batches', '1');
    await expectScalar('SELECT count(*) FROM onetime.ops04_source_row_versions', '17');
    await expectScalar('SELECT count(*) FROM onetime.ops04_match_decisions', '17');
    await expectScalar(
      "SELECT count(*) FROM onetime.ops04_action_ledger WHERE status = 'rolled_back'",
      String(rollback.rolled_back_actions),
    );
    const quarantined = await pool.query(
      "SELECT count(*)::int AS count FROM onetime.ops04_action_ledger WHERE status = 'quarantined'",
    );
    expect(Number(quarantined.rows[0].count)).toBeGreaterThan(0);
  });

  it('rejects a conflicting dry run for the same batch identity', async () => {
    const request = createSyntheticOps04Fixture();
    const report = createOps04DryRun(request);
    await repository.recordDryRun({ actor, report });

    const conflictingRequest = createSyntheticOps04Fixture();
    conflictingRequest.rows[0] = {
      ...conflictingRequest.rows[0]!,
      email: 'changed-synthetic@example.test',
    };
    const conflictingReport = createOps04DryRun(conflictingRequest);
    await expect(
      repository.recordDryRun({ actor, report: conflictingReport }),
    ).rejects.toBeInstanceOf(Ops04BatchConflictError);
  });
});

async function expectScalar(sql: string, expected: string) {
  const result = await pool.query(sql);
  expect(String(result.rows[0].count)).toBe(expected);
}
