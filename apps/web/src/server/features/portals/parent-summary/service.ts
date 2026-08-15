import {
  PARENT_SUMMARY_CONTRACT_VERSION,
  PARENT_SUMMARY_ERROR_CODES,
  type ParentSummaryErrorCode,
  type ParentSummaryPrincipal,
  type ParentSummaryRecord,
  type ParentSummaryRepository,
  type ParentSummarySnapshot,
} from '../../../../../../../packages/contracts/src/portals/parent-summary/index.ts';
import {
  PARENT_WELCOME_VIDEO_CONTRACT_VERSION,
  type ParentWelcomeVideoSlot,
} from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';
import type { ParentWelcomeService } from '../parent-welcome/service.ts';

export class ParentSummaryError extends Error {
  constructor(
    readonly code: ParentSummaryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ParentSummaryError';
  }
}

function assertParentPrincipal(
  principal: ParentSummaryPrincipal,
): asserts principal is ParentSummaryPrincipal {
  if (
    principal.role !== 'parent' ||
    !principal.adult_id ||
    !principal.household_id ||
    !principal.session_id
  ) {
    throw new ParentSummaryError(
      PARENT_SUMMARY_ERROR_CODES.roleDenied,
      'A signed-in Parent account is required.',
    );
  }
}

function assertOwnedRecord(principal: ParentSummaryPrincipal, record: ParentSummaryRecord) {
  if (
    record.household_id !== principal.household_id ||
    record.owner_adult_id !== principal.adult_id
  ) {
    throw new ParentSummaryError(
      PARENT_SUMMARY_ERROR_CODES.scopeDenied,
      'This Parent summary is outside the authenticated household.',
    );
  }

  const studentIds = new Set(record.students.map(({ student_id }) => student_id));
  if (
    studentIds.size !== record.students.length ||
    record.schedule.some(({ student_id }) => !studentIds.has(student_id)) ||
    record.progress.some(({ student_id }) => !studentIds.has(student_id))
  ) {
    throw new ParentSummaryError(
      PARENT_SUMMARY_ERROR_CODES.invalidRecord,
      'The Parent summary contains an invalid household reference.',
    );
  }
}

function toSnapshot(
  record: ParentSummaryRecord,
  featuredWelcomeVideo: ParentWelcomeVideoSlot,
): ParentSummarySnapshot {
  return {
    contract_version: PARENT_SUMMARY_CONTRACT_VERSION,
    household_id: record.household_id,
    display_name: record.display_name,
    generated_at: record.generated_at,
    students: record.students,
    schedule: record.schedule,
    progress: record.progress,
    updates: record.updates,
    featured_welcome_video: featuredWelcomeVideo,
    support: {
      label: 'Contact support',
      description: 'Get help with your Parent account or household.',
      href: '/app/parent/support',
    },
  };
}

export function createParentSummaryService(dependencies: {
  repository: ParentSummaryRepository;
  welcome?: Pick<ParentWelcomeService, 'featuredSlot'>;
}) {
  return {
    async overview(principal: ParentSummaryPrincipal): Promise<ParentSummarySnapshot> {
      assertParentPrincipal(principal);
      const record = await dependencies.repository.loadParentSummary(principal.household_id);
      if (!record) {
        throw new ParentSummaryError(
          PARENT_SUMMARY_ERROR_CODES.summaryMissing,
          'This Parent summary is unavailable.',
        );
      }
      assertOwnedRecord(principal, record);
      const featuredWelcomeVideo = dependencies.welcome
        ? await dependencies.welcome.featuredSlot(principal)
        : unavailableWelcomeVideo();
      return toSnapshot(record, featuredWelcomeVideo);
    },
  };
}

function unavailableWelcomeVideo(): ParentWelcomeVideoSlot {
  return {
    contract_version: PARENT_WELCOME_VIDEO_CONTRACT_VERSION,
    status: 'unavailable',
    reason: 'no_approved_version',
    title: 'Welcome to One Time',
    message:
      'An approved Parent welcome video is not available yet. You can still add a Student, see the next class, or get help.',
  };
}

export type ParentSummaryService = ReturnType<typeof createParentSummaryService>;
