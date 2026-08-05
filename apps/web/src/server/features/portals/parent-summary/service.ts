import {
  PARENT_SUMMARY_CONTRACT_VERSION,
  PARENT_SUMMARY_ERROR_CODES,
  type ParentSummaryErrorCode,
  type ParentSummaryPrincipal,
  type ParentSummaryRecord,
  type ParentSummaryRepository,
  type ParentSummarySnapshot,
} from '../../../../../../../packages/contracts/src/portals/parent-summary/index.ts';

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

function toSnapshot(record: ParentSummaryRecord): ParentSummarySnapshot {
  return {
    contract_version: PARENT_SUMMARY_CONTRACT_VERSION,
    household_id: record.household_id,
    display_name: record.display_name,
    generated_at: record.generated_at,
    students: record.students,
    schedule: record.schedule,
    progress: record.progress,
    updates: record.updates,
    support: {
      label: 'Contact support',
      description: 'Get help with your Parent account or household.',
      href: '/app/parent/support',
    },
  };
}

export function createParentSummaryService(dependencies: { repository: ParentSummaryRepository }) {
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
      return toSnapshot(record);
    },
  };
}

export type ParentSummaryService = ReturnType<typeof createParentSummaryService>;
