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
      'scoped idempotency key stores canonical request hash',
      'projection update and transition append occur in one transaction',
    ],
  },
  questionRecognitionLedger: {
    table: 'onetime.learning_question_recognition_ledger',
    invariants: [
      FOUR_DIMENSION_FENCE,
      'append-only: UPDATE and DELETE are rejected',
      'qualification is unique per scoped question and corrections append evidence',
      'optional recognition append shares the projection-and-transition transaction',
    ],
  },
  announcements: {
    table: 'onetime.learning_announcements',
    readTable: 'onetime.learning_announcement_reads',
    invariants: [FOUR_DIMENSION_FENCE, 'unknown audience kinds fail closed'],
  },
  reviews: {
    table: 'onetime.learning_review_completions',
    invariants: [
      FOUR_DIMENSION_FENCE,
      'one qualifying completion per scoped Student and Admin-published review item',
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
