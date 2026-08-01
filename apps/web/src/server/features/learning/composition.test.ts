import { describe, expect, it, vi } from 'vitest';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import { createLearningComposition, LEARNING_COMPOSITION_BLOCKERS } from './composition.ts';

const scope = {
  accountKey: 'account-1',
  productKey: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
};
const pool = { query: vi.fn() } as unknown as DbPool;

describe('P22 learning composition', () => {
  it('fails closed for a blank deployed alias, unproven schema, absent P21 writer, and absent P18 mount', () => {
    const result = createLearningComposition({
      pool,
      scope,
      aliasHmacKey: '   ',
      aliasHmacKeyConfigured: true,
      nativePostgresSchemaProven: false,
      contentPublicationWriterMounted: false,
    });
    expect(result.enabled).toBe(false);
    expect(result.blockers).toEqual([
      LEARNING_COMPOSITION_BLOCKERS.aliasSecret,
      LEARNING_COMPOSITION_BLOCKERS.nativeSchema,
      LEARNING_COMPOSITION_BLOCKERS.contentWriter,
      LEARNING_COMPOSITION_BLOCKERS.attendanceRepository,
    ]);
  });

  it('stays unavailable when other gates pass because no mounted P18 attachment contract exists', () => {
    const result = createLearningComposition({
      pool,
      scope,
      aliasHmacKey: 'deployed-alias-key',
      aliasHmacKeyConfigured: true,
      nativePostgresSchemaProven: true,
      contentPublicationWriterMounted: true,
    });
    expect(result.enabled).toBe(false);
    expect(result.blockers).toEqual([LEARNING_COMPOSITION_BLOCKERS.attendanceRepository]);
  });
});
