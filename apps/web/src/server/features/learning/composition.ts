import type { AttendanceProjectionChangePort } from '../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import type { LearningScope } from '../../../../../../packages/contracts/src/learning/index.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import {
  createLearningAttendanceProjectionChangePort,
  createPostgresLearningAdapters,
} from './adapters.ts';
import { createLearningEngagementService } from './service.ts';

export const LEARNING_COMPOSITION_BLOCKERS = {
  aliasSecret: 'learning_alias_hmac_key_unavailable',
  nativeSchema: 'learning_native_postgres_schema_unproven',
  contentWriter: 'learning_content_publication_writer_unavailable',
  attendanceRepository: 'learning_mounted_p18_repository_unavailable',
} as const;

export type LearningCompositionBlocker =
  (typeof LEARNING_COMPOSITION_BLOCKERS)[keyof typeof LEARNING_COMPOSITION_BLOCKERS];

export type LearningComposition = {
  enabled: boolean;
  blockers: readonly LearningCompositionBlocker[];
  service: ReturnType<typeof createLearningEngagementService>;
  attendanceProjectionChanges: AttendanceProjectionChangePort;
};

/**
 * Composes P22 without creating or accepting a self-attested P18 repository.
 * A later exact successor must supply a mounted-repository attachment contract
 * backed by the P18 runtime itself before this composition can be enabled.
 */
export function createLearningComposition(input: {
  pool: DbPool;
  scope: LearningScope;
  aliasHmacKey: string | undefined;
  aliasHmacKeyConfigured: boolean;
  nativePostgresSchemaProven: boolean;
  contentPublicationWriterMounted: boolean;
  clock?: () => Date;
}): LearningComposition {
  const adapters = createPostgresLearningAdapters(input.pool);
  const aliasHmacKey = input.aliasHmacKey?.trim() ?? '';
  const service = createLearningEngagementService({
    repository: adapters.repository,
    attendance: adapters.attendance,
    identity: adapters.identity,
    recognitionConsent: adapters.consent,
    reviewItems: adapters.reviewItems,
    aliasHmacKey,
    ...(input.clock ? { clock: input.clock } : {}),
  });
  const attendanceProjectionChanges = createLearningAttendanceProjectionChangePort({
    pool: input.pool,
    scope: input.scope,
    service,
  });

  const blockers: LearningCompositionBlocker[] = [];
  if (!input.aliasHmacKeyConfigured || aliasHmacKey.length === 0) {
    blockers.push(LEARNING_COMPOSITION_BLOCKERS.aliasSecret);
  }
  if (!input.nativePostgresSchemaProven) {
    blockers.push(LEARNING_COMPOSITION_BLOCKERS.nativeSchema);
  }
  if (!input.contentPublicationWriterMounted) {
    blockers.push(LEARNING_COMPOSITION_BLOCKERS.contentWriter);
  }

  blockers.push(LEARNING_COMPOSITION_BLOCKERS.attendanceRepository);

  return {
    enabled: blockers.length === 0,
    blockers,
    service,
    attendanceProjectionChanges,
  };
}
