export const LEARNING_ENGAGEMENT_SCHEMA_CONTRACT_VERSION =
  'P22-LEARNING-ENGAGEMENT-SCHEMA-001' as const;

export const LEARNING_ENGAGEMENT_REQUIRED_SCHEMA = {
  questions: {
    table: 'onetime.learning_questions',
    invariants: [
      'primary key is account, product, and question key',
      'private body and answer are never joined into Parent projections',
      'state is submitted, answered_private, approved_for_class, published, closed, or declined',
      'optimistic version fencing and idempotent transition history are mandatory',
    ],
  },
  announcements: {
    table: 'onetime.learning_announcements',
    readTable: 'onetime.learning_announcement_reads',
    invariants: [
      'audience is exactly program, class, parent household, or Student',
      'read identity is account, product, announcement, and authenticated principal',
    ],
  },
  attendance: {
    table: 'onetime.learning_attendance',
    segmentTable: 'onetime.learning_attendance_segments',
    invariants: [
      'one aggregate per account, product, occurrence, and Student',
      'segment key is unique so reconnect replay cannot add minutes twice',
      'manual correction actor, reason, and time are immutable audit fields',
    ],
  },
  reviews: {
    table: 'onetime.learning_review_completions',
    invariants: [
      'one qualifying completion per account, product, Student, and Admin-published review item',
      'correctness and score are not eligibility fields',
    ],
  },
  recognitionConsent: {
    table: 'onetime.learning_recognition_consents',
    invariants: [
      'default is absent and therefore off',
      'consent changes display only and never rewrite ranks or learning facts',
    ],
  },
} as const;
