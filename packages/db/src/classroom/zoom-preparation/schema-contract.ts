export const ZOOM_PREPARATION_SCHEMA_CONTRACT_VERSION = 'P17-ZOOM-PREPARATION-SCHEMA-002' as const;

export const ZOOM_PREPARATION_SCHEMA_CONTRACT = {
  preparations: {
    table: 'onetime.zoom_preparations',
    invariants: [
      'unique occurrence, schedule version, and roster version',
      'immutable preview digest and optimistic saga version',
      'acceptance-unknown provider work remains quarantined',
    ],
  },
  rosterSnapshots: {
    table: 'onetime.zoom_roster_snapshots',
    invariants: [
      'immutable occurrence and roster-version snapshot',
      'one Student entry with explicit include or safe exclusion reason',
      'consent, access, Student, and enrollment versions remain bound',
    ],
  },
  classroomResources: {
    table: 'onetime.zoom_classroom_resources',
    invariants: [
      'at most one current normal-class meeting per occurrence',
      'provider references are protected digests and never raw join URLs',
      'source schedule and roster versions are durable',
    ],
  },
  registrants: {
    table: 'onetime.zoom_student_registrants',
    invariants: [
      'at most one current registrant per occurrence and Student',
      'no household-shared registrant or routable Student email',
      'provider reference and technical alias are protected digests',
    ],
  },
  commands: {
    table: 'onetime.zoom_preparation_commands',
    invariants: [
      'unique account, product, and idempotency key',
      'conflicting request hash is rejected',
      'receipt binds exact saga version',
    ],
  },
} as const;
