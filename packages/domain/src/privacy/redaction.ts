import type {
  ContentParticipantPrivacyState,
  SharedMediaPrivacyPlan,
} from '../../../contracts/src/privacy/index.ts';
import { PrivacyError } from './errors.ts';

export function planSharedMediaPrivacyTreatment(input: {
  student_id: string;
  participants: readonly ContentParticipantPrivacyState[];
}): SharedMediaPrivacyPlan {
  const affected = input.participants.filter(
    (participant) => participant.student_id === input.student_id,
  );
  if (affected.length === 0) {
    throw new PrivacyError(
      'invalid_contract',
      'Shared-media treatment requires exact ContentParticipant evidence.',
    );
  }
  return {
    student_id: input.student_id,
    restrict_immediately: true,
    delete_other_students: false,
    replacement_required: affected.some(
      (participant) =>
        participant.other_participant_count > 0 && participant.required_actions.length > 0,
    ),
    permanently_restrict_if_infeasible: true,
    participant_actions: affected.map((participant) => ({
      ...participant,
      required_actions: [...participant.required_actions],
      redaction_state: participant.required_actions.length === 0 ? 'complete' : 'required',
    })),
    search_and_derivative_invalidation_required: true,
  };
}

export function assertSharedMediaReplacementReady(input: {
  plan: SharedMediaPrivacyPlan;
  human_admin_approved: boolean;
  provider_readback_verified: boolean;
  transcript_redacted: boolean;
  captions_redacted: boolean;
  worksheet_redacted: boolean;
  search_index_rebuilt: boolean;
}): void {
  if (
    !input.human_admin_approved ||
    !input.provider_readback_verified ||
    !input.transcript_redacted ||
    !input.captions_redacted ||
    !input.worksheet_redacted ||
    !input.search_index_rebuilt ||
    input.plan.participant_actions.some((participant) => participant.redaction_state !== 'complete')
  ) {
    throw new PrivacyError(
      'invalid_contract',
      'Republish requires human approval, exact readback, and every derivative redacted.',
    );
  }
}

export function memberRecognitionProjection(input: {
  consent_granted: boolean;
  viewer_is_subject: boolean;
  consented_safe_name: string | null;
  class_scoped_alias: string;
  underlying_rank: number;
  learning_fact_count: number;
}): {
  display_label: string;
  rank: number;
  learning_fact_count: number;
  named_attribution_cache_valid: boolean;
} {
  if (
    !/^Anonymous Student [\u2022] [A-Z0-9]{2,12}$/.test(input.class_scoped_alias) ||
    /@|household|student-|user-/i.test(input.class_scoped_alias)
  ) {
    throw new PrivacyError(
      'invalid_contract',
      'Recognition alias must be stable, class-scoped, and nonidentifying.',
    );
  }
  const label = input.consent_granted
    ? requiredSafeDisplay(input.consented_safe_name)
    : input.viewer_is_subject
      ? 'You'
      : input.class_scoped_alias;
  return {
    display_label: label,
    rank: input.underlying_rank,
    learning_fact_count: input.learning_fact_count,
    named_attribution_cache_valid: input.consent_granted,
  };
}

export function parentExportCategories(): {
  included: readonly string[];
  excluded: readonly string[];
} {
  return {
    included: [
      'adult_household',
      'student_profiles',
      'consent_versions_timestamps',
      'enrollment_calendar_summary',
      'parent_authorized_progress_summary',
      'parent_visible_notices_support',
      'billing_access_projection',
    ],
    excluded: [
      'student_recordings_library_playback',
      'private_questions',
      'rabbi_answers',
      'student_support_bodies',
      'student_notifications',
      'student_comparison_data',
    ],
  };
}

export function studentExportCategories(): {
  included: readonly string[];
  excluded: readonly string[];
} {
  return {
    included: [
      'own_student_profile',
      'own_scoped_consent_versions_timestamps',
      'own_enrollment_calendar',
      'own_attendance_progress_badges',
      'own_library_playback_resume',
      'own_notifications',
      'own_private_questions_rabbi_answers',
      'own_student_support',
    ],
    excluded: [
      'sibling_data',
      'other_participant_data',
      'shared_raw_recordings',
      'provider_secrets',
      'other_participant_leaderboard_details',
    ],
  };
}

export function redactPrivacyDiagnostic(value: Record<string, unknown>): Record<string, unknown> {
  const forbidden =
    /(?:password|token|secret|bearer|cookie|join.?url|playback.?url|question.?body|support.?body|student.?name|email|phone)/i;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (forbidden.test(key)) return [key, '[REDACTED]'];
      if (Array.isArray(item)) {
        return [
          key,
          item.map((entry) =>
            entry !== null && typeof entry === 'object'
              ? redactPrivacyDiagnostic(entry as Record<string, unknown>)
              : entry,
          ),
        ];
      }
      if (item !== null && typeof item === 'object') {
        return [key, redactPrivacyDiagnostic(item as Record<string, unknown>)];
      }
      return [key, item];
    }),
  );
}

function requiredSafeDisplay(value: string | null): string {
  if (
    value === null ||
    value.trim() === '' ||
    value.length > 80 ||
    /@|https?:|[0-9]{5,}/i.test(value)
  ) {
    throw new PrivacyError(
      'invalid_contract',
      'Member recognition requires an approved non-contact safe display name.',
    );
  }
  return value;
}
