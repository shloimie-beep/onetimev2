import { describe, expect, it } from 'vitest';

import type { ProviderOperation } from '../../../../contracts/src/providers/v21-provider-core.ts';
import { createZoomPreparationRepository } from './repository.ts';
import {
  ZOOM_PREPARATION_SCHEMA_CONTRACT,
  ZOOM_PREPARATION_SCHEMA_CONTRACT_VERSION,
} from './schema-contract.ts';

describe('P17 Zoom preparation persistence contract', () => {
  it('declares exactly five preparation tables without P18-owned persistence', () => {
    expect(ZOOM_PREPARATION_SCHEMA_CONTRACT_VERSION).toBe('P17-ZOOM-PREPARATION-SCHEMA-002');
    expect(Object.values(ZOOM_PREPARATION_SCHEMA_CONTRACT)).toHaveLength(5);
    const serialized = JSON.stringify(ZOOM_PREPARATION_SCHEMA_CONTRACT);
    expect(serialized).toContain('never raw join URLs');
    expect(serialized).not.toMatch(/https?:\/\//);
    expect(serialized).not.toMatch(/launch.?grant|live.?session|attendance|bootstrap|device/i);
  });

  it('uses transactions and parameters without runtime DDL', async () => {
    const queries: Array<{ sql: string; values: readonly unknown[] }> = [];
    const repository = createZoomPreparationRepository({
      connect: async () => ({
        query: async (sql, values = []) => {
          queries.push({ sql, values });
          return {
            rows: sql.includes('RETURNING idempotency_key')
              ? [{ idempotency_key: 'prepare-1' }]
              : [],
          };
        },
      }),
    });
    await repository.inTransaction((unit) =>
      unit.saveReceipt({
        accountKey: 'account-1',
        productKey: 'one-time',
        idempotencyKey: 'prepare-1',
        requestHash: 'a'.repeat(64),
        operation: 'prepare_preview',
        resultRef: 'saga-1',
        resultVersion: 2,
        committedAt: '2026-07-28T23:00:00.000Z',
      }),
    );
    expect(queries[0]?.sql).toBe('BEGIN');
    expect(queries.at(-1)?.sql).toBe('COMMIT');
    expect(queries.some(({ sql }) => /\b(?:CREATE|ALTER|DROP)\b/i.test(sql))).toBe(false);
    expect(queries.some(({ values }) => values.includes('prepare-1'))).toBe(true);
    expect(queries.every(({ sql }) => !sql.includes('prepare-1'))).toBe(true);
  });

  it('rolls back a failed write', async () => {
    const commands: string[] = [];
    const repository = createZoomPreparationRepository({
      connect: async () => ({
        query: async (sql) => {
          commands.push(sql);
          if (sql.includes('INSERT INTO')) throw new Error('synthetic failure');
          return { rows: [] };
        },
      }),
    });
    await expect(
      repository.inTransaction((unit) =>
        unit.saveReceipt({
          accountKey: 'account-1',
          productKey: 'one-time',
          idempotencyKey: 'prepare-1',
          requestHash: 'a'.repeat(64),
          operation: 'prepare_preview',
          resultRef: 'saga-1',
          resultVersion: 2,
          committedAt: '2026-07-28T23:00:00.000Z',
        }),
      ),
    ).rejects.toThrow('synthetic failure');
    expect(commands.at(-1)).toBe('ROLLBACK');
  });

  it('fails closed and rolls back stale versioned or changed immutable writes', async () => {
    const versionCommands: string[] = [];
    const staleRepository = createZoomPreparationRepository({
      connect: async () => ({
        query: async (sql) => {
          versionCommands.push(sql);
          return { rows: [] };
        },
      }),
    });
    await expect(
      staleRepository.inTransaction((unit) =>
        unit.saveSaga({
          id: 'saga-1',
          accountKey: 'account-1',
          productKey: 'one-time',
          occurrenceId: 'occurrence-1',
          trigger: 'admin_manual',
          scheduleVersion: 1,
          rosterVersion: 1,
          state: 'draft',
          providerOperationIds: [],
          completedOperationIds: [],
          unknownOperationIds: [],
          version: 2,
          createdAt: '2026-07-28T23:00:00.000Z',
          updatedAt: '2026-07-28T23:01:00.000Z',
        }),
      ),
    ).rejects.toThrow('zoom_preparation_optimistic_conflict');
    expect(versionCommands.at(-1)).toBe('ROLLBACK');

    const receiptCommands: string[] = [];
    const conflictRepository = createZoomPreparationRepository({
      connect: async () => ({
        query: async (sql) => {
          receiptCommands.push(sql);
          return { rows: [] };
        },
      }),
    });
    await expect(
      conflictRepository.inTransaction((unit) =>
        unit.saveReceipt({
          accountKey: 'account-1',
          productKey: 'one-time',
          idempotencyKey: 'prepare-1',
          requestHash: 'a'.repeat(64),
          operation: 'prepare_preview',
          resultRef: 'saga-1',
          resultVersion: 2,
          committedAt: '2026-07-28T23:00:00.000Z',
        }),
      ),
    ).rejects.toThrow('zoom_preparation_command_idempotency_conflict');
    expect(receiptCommands.at(-1)).toBe('ROLLBACK');
  });

  it('atomically persists the canonical job outbox row and exact provider binding', async () => {
    const queries: Array<{ sql: string; values: readonly unknown[] }> = [];
    const operation = operationFixture();
    const repository = createZoomPreparationRepository({
      connect: async () => ({
        query: async (sql, values = []) => {
          queries.push({ sql, values });
          return sql.includes('RETURNING job_id')
            ? { rows: [{ job_id: operation.job_id }] }
            : { rows: [] };
        },
      }),
    });

    await repository.inTransaction((unit) => unit.saveProviderOperation(operation));

    const sql = queries.map(({ sql: statement }) => statement).join('\n');
    expect(sql).toContain('INSERT INTO onetime.job_outbox');
    expect(sql).toContain(
      'ON CONFLICT (product, runtime_tier, verification_environment_id, idempotency_key)',
    );
    expect(sql).toContain('INSERT INTO onetime.provider_operation_binding');
    expect(sql).toContain('provider_operation_binding.registry_binding_key');
    expect(sql).not.toContain('onetime.provider_operations');
    expect(queries[0]?.sql).toBe('BEGIN');
    expect(queries.at(-1)?.sql).toBe('COMMIT');
  });

  it('fails closed and rolls back when an existing outbox or binding row mismatches', async () => {
    const commands: string[] = [];
    const repository = createZoomPreparationRepository({
      connect: async () => ({
        query: async (sql) => {
          commands.push(sql);
          return { rows: [] };
        },
      }),
    });

    await expect(
      repository.inTransaction((unit) => unit.saveProviderOperation(operationFixture())),
    ).rejects.toThrow('job_outbox_idempotency_conflict');
    expect(commands.at(-1)).toBe('ROLLBACK');
    expect(commands.some((sql) => sql.includes('provider_operation_binding'))).toBe(false);

    const bindingCommands: string[] = [];
    const operation = operationFixture();
    const bindingConflictRepository = createZoomPreparationRepository({
      connect: async () => ({
        query: async (sql) => {
          bindingCommands.push(sql);
          return sql.includes('INSERT INTO onetime.job_outbox')
            ? { rows: [{ job_id: operation.job_id }] }
            : { rows: [] };
        },
      }),
    });
    await expect(
      bindingConflictRepository.inTransaction((unit) => unit.saveProviderOperation(operation)),
    ).rejects.toThrow('provider_operation_binding_conflict');
    expect(bindingCommands.at(-1)).toBe('ROLLBACK');
    expect(bindingCommands.some((sql) => sql.includes('provider_operation_binding'))).toBe(true);
  });
});

function operationFixture(): ProviderOperation {
  const digest = 'a'.repeat(64);
  return {
    job_id: 'job-1',
    operation_type: 'zoom.meeting.create_or_reuse',
    aggregate_ref: 'resource-1',
    source_version: 1,
    provider: 'zoom',
    scope: {
      product: 'one_time_mishnayos',
      runtime_tier: 'isolated_staging',
      verification_environment_id: 'provider_sandbox',
    },
    idempotency_key: 'meeting-resource-1',
    canonical_request_hash: digest,
    payload_ref: 'zoom-preparation/resource-1',
    payload_digest: digest,
    compensation_for_job_id: null,
    state: 'not_started',
    version: 1,
    recovery_generation: 0,
    dispatch_attempts: 0,
    lifetime_dispatch_attempts: 0,
    reconciliation_attempts: 0,
    lease_owner: null,
    lease_generation: 0,
    lease_expires_at: null,
    last_heartbeat_at: null,
    next_attempt_at: null,
    unknown_effect: false,
    provider_acceptance_digest: null,
    reconciliation_digest: null,
    safe_error_code: null,
    created_at: '2026-07-30T07:15:00.000Z',
    updated_at: '2026-07-30T07:15:00.000Z',
    registry_binding_key: 'zoom-binding',
    provider_account_ref_hash: digest,
    effect_kind: 'mutation',
    household_id: null,
  };
}
