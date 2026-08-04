export const CONTENT_INGEST_SCHEMA_CONTRACT_VERSION = 'P19-CONTENT-INGEST-SCHEMA-001' as const;

export const CONTENT_INGEST_SCHEMA_CONTRACT = {
  uploadSessions: {
    table: 'onetime.content_ingest_upload_sessions',
    invariants: [
      'unique account, product, and idempotency key',
      'declared byte count is 1 through 5 GiB',
      'session state and optimistic version are durable',
      'opaque object keys contain no filename, person, household, or occurrence data',
    ],
  },
  uploadParts: {
    table: 'onetime.content_ingest_upload_parts',
    invariants: [
      'unique upload session and part number',
      'part byte count is at most 64 MiB',
      'part SHA-256 and protected provider-part digest are immutable',
    ],
  },
  sources: {
    table: 'onetime.content_sources_v21',
    invariants: [
      'unique account, product, and full SHA-256 across app upload and Drive',
      'confirmed rows bind exact versioned S3 readback and recovery-journal receipt',
      'managed-object and recovery-journal evidence agree on bucket, key digest, object version, byte count, SHA-256, KMS key version, and storage class',
      'originalPreserved is always true',
      'no source is Student-visible before the later published lifecycle state',
    ],
  },
  sourceLinks: {
    table: 'onetime.content_source_links_v21',
    invariants: [
      'repeated app or Drive discovery links to one checksum-canonical source',
      'Drive change marker and protected file reference remain provenance only',
    ],
  },
  driveObservations: {
    table: 'onetime.content_drive_observations',
    invariants: [
      'unique account, product, and protected Drive file digest',
      'stable requires unchanged nonzero size, MIME, and change marker for 120 seconds',
      'provider-off, retry, quarantine, review, and processed states are durable',
    ],
  },
  commands: {
    table: 'onetime.content_ingest_commands',
    invariants: [
      'unique account, product, and idempotency key',
      'same key with a different request hash is rejected',
    ],
  },
} as const;
