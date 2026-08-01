import type {
  AttendanceProjectionChangePort,
  EmbeddedClassroomRepository,
} from '../../../../../../packages/contracts/src/classroom/embedded/index.ts';
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

export type MountedP18Binding = {
  /** The repository receiving P18 attendance intake. */
  repository: EmbeddedClassroomRepository;
  /** The repository actually mounted by P18. Must be the same object. */
  mountedRepository: EmbeddedClassroomRepository;
};

export type LearningComposition = {
  enabled: boolean;
  blockers: readonly LearningCompositionBlocker[];
  service: ReturnType<typeof createLearningEngagementService>;
  attendanceProjectionChanges: AttendanceProjectionChangePort;
  mountedP18Repository: EmbeddedClassroomRepository | null;
};

/**
 * Composes P22 without creating a second P18 repository. The only supported
 * attendance seam asks the already-mounted P18 composition to install this
 * callback and proves object identity on readback.
 */
export function createLearningComposition(input: {
  pool: DbPool;
  scope: LearningScope;
  aliasHmacKey: string | undefined;
  aliasHmacKeyConfigured: boolean;
  nativePostgresSchemaProven: boolean;
  contentPublicationWriterMounted: boolean;
  attachToMountedP18?: (projectionChanges: AttendanceProjectionChangePort) => MountedP18Binding;
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

  let mountedP18Repository: EmbeddedClassroomRepository | null = null;
  if (blockers.length === 0 && input.attachToMountedP18) {
    const binding = input.attachToMountedP18(attendanceProjectionChanges);
    if (binding.repository === binding.mountedRepository) {
      mountedP18Repository = binding.repository;
    }
  }
  if (!mountedP18Repository) {
    blockers.push(LEARNING_COMPOSITION_BLOCKERS.attendanceRepository);
  }

  return {
    enabled: blockers.length === 0,
    blockers,
    service,
    attendanceProjectionChanges,
    mountedP18Repository,
  };
}
