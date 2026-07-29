export const CONTENT_PROCESSING_SCHEMA_CONTRACT_VERSION =
  'P20-CONTENT-PROCESSING-SCHEMA-001' as const;

export const CONTENT_PROCESSING_SCHEMA_CONTRACT = {
  versions: {
    table: 'onetime.content_processing_versions',
    invariants: [
      'one checksum- and object-version-bound processing version per opaque content version key',
      'state, attempt count, retry/dead-letter posture, and optimistic version are durable',
      'no processing row can imply publication or Student visibility',
    ],
  },
  artifacts: {
    table: 'onetime.content_processing_artifacts',
    invariants: [
      'artifact revisions are immutable and source/content-version bound',
      'trim, compressed video, transcript, captions, review, worksheet, and knowledge output begin as drafts',
      'approval binds exact payload, model, prompt, schema, source, and artifact revision',
    ],
  },
  commands: {
    table: 'onetime.content_processing_commands',
    invariants: [
      'unique account, product, and idempotency key',
      'conflicting request-hash reuse is rejected before a write',
      'receipts bind operation, result reference, result version, and commit time',
    ],
  },
  captureEvidence: {
    table: 'onetime.content_processing_capture_evidence',
    invariants: [
      'OBS-only evidence records versioned consent, participant snapshot, notice, and controlled device',
      'Zoom cloud recording remains disabled',
      'local deletion evidence cannot precede durable checksum readback and linked ingest source',
    ],
  },
} as const;
