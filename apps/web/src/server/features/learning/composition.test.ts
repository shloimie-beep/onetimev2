import { describe, expect, it, vi } from 'vitest';
import type { EmbeddedClassroomRepository } from '../../../../../../packages/contracts/src/classroom/embedded/index.ts';
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

  it('enables only when the callback is attached to the identical repository mounted by P18', () => {
    const repository = {} as EmbeddedClassroomRepository;
    const attach = vi.fn(() => ({ repository, mountedRepository: repository }));
    const result = createLearningComposition({
      pool,
      scope,
      aliasHmacKey: 'deployed-alias-key',
      aliasHmacKeyConfigured: true,
      nativePostgresSchemaProven: true,
      contentPublicationWriterMounted: true,
      attachToMountedP18: attach,
    });
    expect(result.enabled).toBe(true);
    expect(result.mountedP18Repository).toBe(repository);
    expect(attach).toHaveBeenCalledWith(result.attendanceProjectionChanges);
  });

  it('rejects a callback wired to an unused second P18 repository', () => {
    const result = createLearningComposition({
      pool,
      scope,
      aliasHmacKey: 'deployed-alias-key',
      aliasHmacKeyConfigured: true,
      nativePostgresSchemaProven: true,
      contentPublicationWriterMounted: true,
      attachToMountedP18: () => ({
        repository: {} as EmbeddedClassroomRepository,
        mountedRepository: {} as EmbeddedClassroomRepository,
      }),
    });
    expect(result.enabled).toBe(false);
    expect(result.blockers).toContain(LEARNING_COMPOSITION_BLOCKERS.attendanceRepository);
  });
});
