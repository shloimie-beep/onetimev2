import { z } from 'zod';

export const ops04TaskId = 'OPS-04' as const;
export const ops04MappingVersion = 'ops04-mapping-v1-2026-07-16' as const;
export const ops04CanonicalizationVersion = 'ops04-canonical-json-v1' as const;

export const ops04SourceKindSchema = z.enum(['csv', 'tsv', 'xlsx', 'json', 'synthetic']);
export type Ops04SourceKind = z.infer<typeof ops04SourceKindSchema>;

export const ops04AudienceTypeSchema = z.enum(['family', 'school', 'organization']);
export type Ops04AudienceType = z.infer<typeof ops04AudienceTypeSchema>;

export const ops04LegacyMembershipStateSchema = z.enum([
  'unknown',
  'trial',
  'active',
  'paused',
  'cancelled',
  'expired',
  'former',
  'deleted',
]);
export type Ops04LegacyMembershipState = z.infer<typeof ops04LegacyMembershipStateSchema>;

export const ops04LeadStateSchema = z.enum([
  'unreviewed',
  'new',
  'contacted',
  'follow_up',
  'qualified',
  'active',
  'not_interested',
  'archived',
  'unknown',
]);
export type Ops04LeadState = z.infer<typeof ops04LeadStateSchema>;

export const ops04CurrentSubscriberStateSchema = z.enum([
  'none',
  'trial',
  'active',
  'past_due',
  'paused',
  'cancelled',
  'expired',
  'unknown',
]);
export type Ops04CurrentSubscriberState = z.infer<typeof ops04CurrentSubscriberStateSchema>;

export const ops04ConsentStateSchema = z.enum([
  'unknown',
  'opted_in',
  'transactional_only',
  'opted_out',
]);
export type Ops04ConsentState = z.infer<typeof ops04ConsentStateSchema>;

export const ops04SuppressionStateSchema = z.enum([
  'none',
  'unsubscribed',
  'hard_bounce',
  'invalid_address',
  'stop',
  'wrong_number',
  'do_not_contact',
  'legal_hold',
]);
export type Ops04SuppressionState = z.infer<typeof ops04SuppressionStateSchema>;

export const ops04PrimaryDispositionSchema = z.enum([
  'manual_review',
  'suppressed',
  'already_migrated',
  'migration_invitation_eligible',
  'blast_candidate',
]);
export type Ops04PrimaryDisposition = z.infer<typeof ops04PrimaryDispositionSchema>;

export const ops04ChannelEligibilitySchema = z.enum([
  'eligible',
  'suppressed',
  'unknown_consent',
  'missing_destination',
  'manual_review',
]);
export type Ops04ChannelEligibility = z.infer<typeof ops04ChannelEligibilitySchema>;

export const ops04QuarantineReasonSchema = z.enum([
  'multiple_top_rank_candidates',
  'email_phone_target_conflict',
  'stable_external_id_target_conflict',
  'shared_email_without_relationship',
  'shared_phone_without_relationship',
  'contact_point_disputed',
  'cross_scope_candidate',
  'person_organization_role_conflict',
  'adult_learner_role_conflict',
  'school_family_role_conflict',
  'archived_target_requires_review',
  'merged_target_survivor_unresolved',
  'contradictory_current_entitlement',
  'ambiguous_local_phone',
  'source_timestamp_ambiguous',
  'source_authority_unknown',
  'cleaned_provider_semantics_unknown',
  'newer_canonical_value_protected',
  'stale_preview',
  'invalid_destination_with_no_stable_identity',
  'insufficient_identity',
  'row_access_not_authorized',
  'source_scope_unclassified',
]);
export type Ops04QuarantineReason = z.infer<typeof ops04QuarantineReasonSchema>;

export const ops04ActionTypeSchema = z.enum([
  'create_contact',
  'link_external_identity',
  'append_legacy_membership_event',
  'append_lead_event',
  'add_contact_point',
  'add_contact_point_owner',
  'append_channel_state_event',
  'add_relationship',
  'add_tag_assignment',
  'link_source_provenance',
  'set_migration_projection',
  'no_op_unchanged',
  'quarantine_manual_review',
  'reject_insufficient_identity',
]);
export type Ops04ActionType = z.infer<typeof ops04ActionTypeSchema>;

export const ops04BatchStateSchema = z.enum([
  'discovered',
  'parsed',
  'previewed',
  'review_required',
  'approved',
  'applying',
  'applied',
  'verified',
  'failed',
  'rejected',
  'rolled_back',
]);
export type Ops04BatchState = z.infer<typeof ops04BatchStateSchema>;

const optionalCell = (max: number) => z.string().trim().max(max).optional().default('');

export const ops04SourceFileSchema = z
  .object({
    file_id: z.string().min(1),
    adapter_family: z.string().min(1).max(80),
    adapter_version: z.string().min(1).max(80),
    file_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    byte_size: z.number().int().min(0),
    safe_path_fingerprint: z.string().min(1).max(120),
    workbook_sheets: z.array(z.string().max(160)).default([]),
    normalized_headers: z.array(z.string().max(120)).default([]),
    physical_row_count: z.number().int().min(0),
    blank_row_count: z.number().int().min(0).default(0),
    error_row_count: z.number().int().min(0).default(0),
    classification_status: z
      .enum(['classified_source', 'unclassified_source', 'rejected_source'])
      .default('unclassified_source'),
    snapshot_semantics: z.enum(['snapshot', 'incremental', 'unknown']).default('unknown'),
    timestamp_policy: z.string().max(160).default('unknown'),
    consent_suppression_metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type Ops04SourceFile = z.infer<typeof ops04SourceFileSchema>;

export const ops04SyntheticRowSchema = z
  .object({
    source_row_number: z.number().int().min(1),
    source_sheet: z.string().trim().max(160).optional(),
    source_stable_id: optionalCell(160),
    display_name: optionalCell(180),
    email: optionalCell(254),
    phone: optionalCell(80),
    phone_region: optionalCell(8),
    audience_type: ops04AudienceTypeSchema.default('family'),
    explicit_relationship: z.boolean().default(false),
    old_user_id: optionalCell(160),
    old_subscription_id: optionalCell(160),
    legacy_membership_state: ops04LegacyMembershipStateSchema.default('unknown'),
    active_old_app_user: z.boolean().default(false),
    lead_state: ops04LeadStateSchema.default('unknown'),
    current_subscriber_state: ops04CurrentSubscriberStateSchema.default('none'),
    existing_migration_state: z.boolean().default(false),
    email_consent_state: ops04ConsentStateSchema.default('unknown'),
    whatsapp_consent_state: ops04ConsentStateSchema.default('unknown'),
    email_suppression_state: ops04SuppressionStateSchema.default('none'),
    whatsapp_suppression_state: ops04SuppressionStateSchema.default('none'),
    source_status: optionalCell(160),
    source_tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  })
  .strict();
export type Ops04SyntheticRow = z.infer<typeof ops04SyntheticRowSchema>;

export const ops04ExistingContactSchema = z
  .object({
    contact_key: z.string().min(1),
    version: z.number().int().min(1).default(1),
    archived: z.boolean().default(false),
    merged: z.boolean().default(false),
    audience_type: ops04AudienceTypeSchema.default('family'),
    old_user_ids: z.array(z.string()).default([]),
    emails: z.array(z.string()).default([]),
    phones: z.array(z.string()).default([]),
    shared_email: z.boolean().default(false),
    shared_phone: z.boolean().default(false),
    current_subscriber_state: ops04CurrentSubscriberStateSchema.default('none'),
    email_suppression_state: ops04SuppressionStateSchema.default('none'),
    whatsapp_suppression_state: ops04SuppressionStateSchema.default('none'),
    newer_field_versions: z.record(z.string(), z.number().int().min(1)).default({}),
  })
  .strict();
export type Ops04ExistingContact = z.infer<typeof ops04ExistingContactSchema>;

export const ops04DryRunRequestSchema = z
  .object({
    account_key: z.string().trim().min(1).max(120),
    product_key: z.string().trim().min(1).max(120),
    operator_idempotency_key: z.string().trim().min(8).max(160),
    mode: z.enum(['synthetic', 'authorized']).default('synthetic'),
    source_files: z.array(ops04SourceFileSchema).min(1),
    rows: z.array(ops04SyntheticRowSchema).min(1).max(100000),
    existing_contacts: z.array(ops04ExistingContactSchema).default([]),
    hmac_key: z.string().min(12).optional(),
    now: z.string().datetime().optional(),
  })
  .strict();
export type Ops04DryRunRequest = z.infer<typeof ops04DryRunRequestSchema>;

export const ops04ChannelSnapshotSchema = z
  .object({
    channel: z.enum(['email', 'whatsapp']),
    eligibility: ops04ChannelEligibilitySchema,
    consent_state: ops04ConsentStateSchema,
    suppression_state: ops04SuppressionStateSchema,
    sends_allowed: z.literal(false),
    reason: z.string().min(1),
  })
  .strict();
export type Ops04ChannelSnapshot = z.infer<typeof ops04ChannelSnapshotSchema>;

export const ops04RowOutcomeSchema = z
  .object({
    row_version_key: z.string().min(1),
    decision_key: z.string().min(1),
    source_row_number: z.number().int().min(1),
    source_sheet: z.string().nullable(),
    row_hmac: z.string().min(1),
    row_version_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    old_external_id_hmacs: z.array(z.string()),
    email_hmac: z.string().nullable(),
    phone_hmac: z.string().nullable(),
    normalized_phone_status: z.enum(['valid', 'invalid', 'ambiguous_local_phone', 'missing']),
    matched_contact_key: z.string().nullable(),
    candidate_contact_keys: z.array(z.string()),
    quarantine_reasons: z.array(ops04QuarantineReasonSchema),
    primary_disposition: ops04PrimaryDispositionSchema,
    independent_facts: z.object({
      lead: z.boolean(),
      old_system: z.boolean(),
      active_old_app_user: z.boolean(),
      current_subscriber: z.boolean(),
      family: z.boolean(),
      school: z.boolean(),
      organization: z.boolean(),
      already_migrated: z.boolean(),
    }),
    channel_snapshots: z.object({
      email: ops04ChannelSnapshotSchema,
      whatsapp: ops04ChannelSnapshotSchema,
    }),
    tag_keys: z.array(z.string()),
    planned_actions: z.array(ops04ActionTypeSchema),
    sends_allowed: z.literal(false),
  })
  .strict();
export type Ops04RowOutcome = z.infer<typeof ops04RowOutcomeSchema>;

export const ops04ReconciliationTotalsSchema = z
  .object({
    files: z.record(z.string(), z.number().int().min(0)),
    rows: z.record(z.string(), z.number().int().min(0)),
    occurrences: z.record(z.string(), z.number().int().min(0)),
    unique_rows: z.record(z.string(), z.number().int().min(0)),
    actions: z.record(z.string(), z.number().int().min(0)),
    attempts: z.record(z.string(), z.number().int().min(0)),
    rollback: z.record(z.string(), z.number().int().min(0)),
    outreach: z.record(z.string(), z.number().int().min(0)),
    equations_balanced: z.boolean(),
  })
  .strict();
export type Ops04ReconciliationTotals = z.infer<typeof ops04ReconciliationTotalsSchema>;

export const ops04DryRunReportSchema = z
  .object({
    task_id: z.literal('OPS-04'),
    batch_key: z.string().min(1),
    manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    mapping_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    database_snapshot_key: z.string().min(1),
    dry_run_hash: z.string().regex(/^[a-f0-9]{64}$/),
    generated_at: z.string().datetime(),
    source_files: z.array(ops04SourceFileSchema),
    rows: z.array(ops04RowOutcomeSchema),
    totals: ops04ReconciliationTotalsSchema,
    approval_status: z.literal('absent'),
    production_import_authorized: z.literal(false),
    campaign_send_authorized: z.literal(false),
    raw_row_contents_included: z.literal(false),
    sends_allowed: z.literal(false),
  })
  .strict();
export type Ops04DryRunReport = z.infer<typeof ops04DryRunReportSchema>;

export const ops04ApplyReceiptSchema = z
  .object({
    task_id: z.literal('OPS-04'),
    mode: z.enum(['synthetic_rehearsal', 'staging_rehearsal']),
    batch_key: z.string(),
    manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    mapping_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    database_snapshot_key: z.string(),
    dry_run_hash: z.string().regex(/^[a-f0-9]{64}$/),
    approved_counts: z.record(z.string(), z.number().int().min(0)),
    actor: z.string().min(1),
    expires_at: z.string().datetime(),
    import_approval_does_not_authorize_send: z.literal(true),
  })
  .strict();
export type Ops04ApplyReceipt = z.infer<typeof ops04ApplyReceiptSchema>;

export const ops04NoSendDiffSchema = z
  .object({
    outbox_events: z.number().int(),
    whatsapp_outbox_messages: z.number().int(),
    delivery_provider_events: z.number().int(),
    account_invitations: z.number().int(),
    access_grants: z.number().int(),
    payment_records: z.number().int(),
    zero_diff: z.boolean(),
  })
  .strict();
export type Ops04NoSendDiff = z.infer<typeof ops04NoSendDiffSchema>;
