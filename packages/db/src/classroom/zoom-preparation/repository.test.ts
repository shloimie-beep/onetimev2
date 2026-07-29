import { describe, expect, it } from 'vitest';

import { createZoomPreparationRepository } from './repository.ts';
import {
  ZOOM_PREPARATION_SCHEMA_CONTRACT,
  ZOOM_PREPARATION_SCHEMA_CONTRACT_VERSION,
} from './schema-contract.ts';

describe('P17 Zoom preparation persistence contract', () => {
  it('declares the seven additive tables and protected invariants', () => {
    expect(ZOOM_PREPARATION_SCHEMA_CONTRACT_VERSION).toBe('P17-ZOOM-PREPARATION-SCHEMA-001');
    expect(Object.values(ZOOM_PREPARATION_SCHEMA_CONTRACT)).toHaveLength(7);
    const serialized = JSON.stringify(ZOOM_PREPARATION_SCHEMA_CONTRACT);
    expect(serialized).toContain('never raw join URLs');
    expect(serialized).not.toMatch(/https?:\/\//);
    expect(serialized).toContain('one current live device lease');
  });

  it('uses transactions and parameters without runtime DDL', async () => {
    const queries: Array<{ sql: string; values: readonly unknown[] }> = [];
    const repository = createZoomPreparationRepository({
      connect: async () => ({
        query: async (sql, values = []) => {
          queries.push({ sql, values });
          return { rows: [] };
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
});
