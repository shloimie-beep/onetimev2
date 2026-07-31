export const LEARNING_ENGAGEMENT_SCHEMA_CONTRACT_VERSION =
  'P22-LEARNING-ENGAGEMENT-SCHEMA-002' as const;

const FOUR_DIMENSION_FENCE =
  'account_key, product_key, runtime_tier, and verification_environment_id fence every key, query, uniqueness rule, and mutation';

export const LEARNING_ENGAGEMENT_REQUIRED_SCHEMA = {
  questionProjection: {
    table: 'onetime.learning_question_projection',
    invariants: [
      FOUR_DIMENSION_FENCE,
      'optimistic version update is fenced and contains no transitions_json or mutable recognition fields',
      'private body and answer never join into Parent projections',
    ],
  },
  questionTransitionLedger: {
    table: 'onetime.learning_question_transition_ledger',
    invariants: [
      FOUR_DIMENSION_FENCE,
      'append-only: UPDATE and DELETE are rejected',
      'transition_event_id is immutable and equals idempotency_key plus the transition suffix',
      'scoped idempotency key stores canonical request hash',
      'projection update and transition append occur in one transaction',
    ],
  },
  questionRecognitionLedger: {
    table: 'onetime.learning_question_recognition_ledger',
    invariants: [
      FOUR_DIMENSION_FENCE,
      'append-only: UPDATE and DELETE are rejected',
      'recognition_event_id is immutable and equals idempotency_key plus the recognition suffix',
      'qualification is unique per scoped question and corrections append evidence',
      'immutable recognition_sequence is unique and monotonic per scoped question',
      'optional recognition append shares the projection-and-transition transaction',
    ],
  },
  announcements: {
    table: 'onetime.learning_announcements',
    readTable: 'onetime.learning_announcement_reads',
    invariants: [
      FOUR_DIMENSION_FENCE,
      'unknown audience kinds fail closed',
      'direct Student and household targets carry a roster-verified audience_class_key',
    ],
  },
  reviews: {
    table: 'onetime.learning_review_completions',
    invariants: [
      FOUR_DIMENSION_FENCE,
      'append-only Student completion and reasoned Admin revoke/restore event ledger; UPDATE and DELETE are rejected',
      'review_event_id is immutable and equals idempotency_key plus the review suffix',
      'event_action, completion_source, audit_ref, publication_audit_ref, and monotonic event_sequence are immutable',
      'the latest append sequence per scoped Student, class, household, and Admin-published review item remains canonical history even when revoked',
      'authenticated Student ingestion is idempotent by scoped key and canonical request hash',
    ],
  },
  badgeAwardProjection: {
    table: 'onetime.learning_badge_award_projection',
    invariants: [
      FOUR_DIMENSION_FENCE,
      'unique scoped Student, class, badge family, and badge level projection',
      'all nine fixed family/level rows begin unawarded and use an immutable rule version',
      'per-family deterministic source digest and audit references make exact recalculation replay a no-write result without versioning unrelated families',
      'ordinary evidence changes can award but never revoke an earned badge',
      'revocation or restoration requires explicit service-authorized Admin correction_audit_ref, correction_reason, and corrected_by_admin_id evidence',
      'qualifying count, source keys, awarded_at, revoked_at, recalculated_at, and correction evidence remain auditable',
    ],
  },
  canonicalReadSeams: {
    attendance: 'SELECT-only on onetime.classroom_attendance_projection_v21 from migration 2251',
    consent: 'SELECT-only identity-bound member_recognition events from privacy_consent_event',
    identity: 'SELECT-only P12 actual_name and nullable display_name from v21_student_profiles',
    invariants: [
      'P22 creates no attendance event, attendance projection, consent, identity, or name table',
      'P22 exposes no attendance or consent mutation',
      'attendance is accepted only through canonical account, Student, class, and enrollment joins',
      'streaks use completed in-enrollment scheduled occurrences and fail closed without coverage',
      'ordinary committed attendance projection changes use an internal class-bound context; only corrections carry an Admin actor and audited reason',
      'review-material reads are class-bound and occur only after exact roster authorization',
      'Student and Parent badge responses expose only key, family, and level',
    ],
  },
} as const;

export const LEARNING_ENGAGEMENT_EXCLUDED_TABLES = [
  'onetime.learning_attendance',
  'onetime.learning_attendance_segments',
  'onetime.learning_recognition_consents',
  'onetime.learning_leaderboard_learners',
  'any P22-owned consent or name table',
] as const;
