import { z } from 'zod';

export const legacyAudienceSourceKindSchema = z.enum(['csv_normalized', 'xlsx_normalized']);
export type LegacyAudienceSourceKind = z.infer<typeof legacyAudienceSourceKindSchema>;

export const legacyAudienceTypeSchema = z.enum(['family', 'school']);
export type LegacyAudienceType = z.infer<typeof legacyAudienceTypeSchema>;

export const legacySystemStateSchema = z.enum(['present', 'absent', 'unknown']);
export type LegacySystemState = z.infer<typeof legacySystemStateSchema>;

export const legacyLeadStateSchema = z.enum(['lead', 'not_lead', 'unknown']);
export type LegacyLeadState = z.infer<typeof legacyLeadStateSchema>;

export const legacyConsentStateSchema = z.enum(['opted_in', 'opted_out', 'unknown']);
export type LegacyConsentState = z.infer<typeof legacyConsentStateSchema>;

export const legacySuppressionStateSchema = z.enum(['active', 'suppressed', 'unknown']);
export type LegacySuppressionState = z.infer<typeof legacySuppressionStateSchema>;

export const legacyAudienceDispositionSchema = z.enum([
  'matched_existing_contact',
  'stage_new_contact',
  'duplicate_input',
  'manual_review',
]);
export type LegacyAudienceDisposition = z.infer<typeof legacyAudienceDispositionSchema>;

export const legacyAudienceReasonCodeSchema = z.enum([
  'active_legacy_user',
  'ambiguous_match',
  'already_activated',
  'archived_contact',
  'communication_eligible',
  'conflicting_identity',
  'consent_opted_out',
  'duplicate_input',
  'matched_by_email',
  'matched_by_email_and_phone',
  'matched_by_phone',
  'missing_identity',
  'new_identity',
  'no_name_only_match',
  'school_no_entitlement',
  'school_requires_follow_up',
  'suppressed_contact',
  'suppressed_source',
]);
export type LegacyAudienceReasonCode = z.infer<typeof legacyAudienceReasonCodeSchema>;

export const legacyAudienceSegmentCodeSchema = z.enum([
  'migration_invite_eligible',
  'active_legacy_user',
  'manual_review',
  'school_follow_up',
  'do_not_contact',
]);
export type LegacyAudienceSegmentCode = z.infer<typeof legacyAudienceSegmentCodeSchema>;

export const legacyAudienceSourceSchema = z
  .object({
    kind: legacyAudienceSourceKindSchema,
    source_label: z.string().trim().min(1).max(160),
    workbook_label: z.string().trim().min(1).max(160).optional(),
    worksheet_label: z.string().trim().min(1).max(160).optional(),
  })
  .strict();
export type LegacyAudienceSource = z.infer<typeof legacyAudienceSourceSchema>;

const optionalCell = (max: number) => z.string().trim().max(max).optional().default('');

export const legacyAudienceInputRowSchema = z
  .object({
    source_row_number: z.number().int().min(1),
    source_sheet: z.string().trim().min(1).max(160).optional(),
    display_name: optionalCell(180),
    email: optionalCell(254),
    phone: optionalCell(40),
    audience_type: legacyAudienceTypeSchema.default('family'),
    legacy_system_state: legacySystemStateSchema.default('unknown'),
    active_legacy_user: z.boolean().default(false),
    new_system_activated: z.boolean().default(false),
    lead_state: legacyLeadStateSchema.default('unknown'),
    consent_state: legacyConsentStateSchema.default('unknown'),
    suppression_state: legacySuppressionStateSchema.default('unknown'),
    source_tags: z.array(z.string().trim().min(1).max(60)).max(20).optional().default([]),
  })
  .strict();
export type LegacyAudienceInputRow = z.infer<typeof legacyAudienceInputRowSchema>;

export const legacyAudienceDryRunRequestSchema = z
  .object({
    idempotency_key: z.string().trim().min(8).max(120),
    source: legacyAudienceSourceSchema,
    rows: z.array(legacyAudienceInputRowSchema).min(1).max(25000),
  })
  .strict();
export type LegacyAudienceDryRunRequest = z.infer<typeof legacyAudienceDryRunRequestSchema>;

export const legacyAudienceSummarySchema = z
  .object({
    total_rows: z.number().int().min(0),
    unique_rows: z.number().int().min(0),
    duplicate_rows: z.number().int().min(0),
    matched_existing_contacts: z.number().int().min(0),
    staged_new_contacts: z.number().int().min(0),
    manual_review_rows: z.number().int().min(0),
    school_follow_up_rows: z.number().int().min(0),
    do_not_contact_rows: z.number().int().min(0),
    already_activated_rows: z.number().int().min(0),
    migration_invite_eligible_rows: z.number().int().min(0),
    active_legacy_user_rows: z.number().int().min(0),
    reason_counts: z.record(z.string(), z.number().int().min(0)),
    disposition_counts: z.record(z.string(), z.number().int().min(0)),
    segment_counts: z.record(z.string(), z.number().int().min(0)),
  })
  .strict();
export type LegacyAudienceSummary = z.infer<typeof legacyAudienceSummarySchema>;

export const legacyAudienceRowOutcomeSchema = z
  .object({
    row_key: z.string().min(1).max(120),
    row_number: z.number().int().min(1),
    source_sheet: z.string().min(1).max(160).nullable(),
    row_fingerprint: z.string().length(64),
    identity_fingerprint: z.string().length(64).nullable(),
    has_email: z.boolean(),
    has_phone: z.boolean(),
    audience_type: legacyAudienceTypeSchema,
    legacy_system_state: legacySystemStateSchema,
    active_legacy_user: z.boolean(),
    new_system_activated: z.boolean(),
    lead_state: legacyLeadStateSchema,
    consent_state: legacyConsentStateSchema,
    suppression_state: legacySuppressionStateSchema,
    communication_eligible: z.boolean(),
    disposition: legacyAudienceDispositionSchema,
    reasons: z.array(legacyAudienceReasonCodeSchema).min(1),
    segment_codes: z.array(legacyAudienceSegmentCodeSchema),
    matched_contact_key: z.string().min(1).max(180).nullable(),
    matched_contact_id: z.string().min(1).max(180).nullable(),
    candidate_contact_keys: z.array(z.string().min(1).max(180)),
  })
  .strict();
export type LegacyAudienceRowOutcome = z.infer<typeof legacyAudienceRowOutcomeSchema>;

export const legacyAudienceDryRunReportSchema = z
  .object({
    batch_key: z.string().min(1).max(120),
    request_hash: z.string().length(64),
    source_digest: z.string().length(64),
    source: legacyAudienceSourceSchema,
    summary: legacyAudienceSummarySchema,
    row_outcomes: z.array(legacyAudienceRowOutcomeSchema),
    generated_at: z.string().datetime(),
    raw_row_contents_included: z.literal(false),
    production_side_effects: z.literal(false),
  })
  .strict();
export type LegacyAudienceDryRunReport = z.infer<typeof legacyAudienceDryRunReportSchema>;

export const legacyAudienceRollbackRequestSchema = z
  .object({
    batch_key: z.string().trim().min(1).max(120),
    idempotency_key: z.string().trim().min(8).max(120),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type LegacyAudienceRollbackRequest = z.infer<typeof legacyAudienceRollbackRequestSchema>;

export const legacyAudienceSegmentContractSchema = z
  .object({
    segment_code: legacyAudienceSegmentCodeSchema,
    tag_key: z.string().min(1).max(120),
    display_name: z.string().min(1).max(80),
    description: z.string().min(1).max(240),
    visual_token: z.enum(['yellow', 'ice', 'neutral']),
    crm_fact_dimension: z.string().min(1).max(80),
    sends_allowed: z.literal(false),
  })
  .strict();
export type LegacyAudienceSegmentContract = z.infer<typeof legacyAudienceSegmentContractSchema>;

export const legacyAudienceContractsResponseSchema = z
  .object({
    success: z.literal(true),
    segments: z.array(legacyAudienceSegmentContractSchema),
  })
  .strict();
export type LegacyAudienceContractsResponse = z.infer<typeof legacyAudienceContractsResponseSchema>;

const idempotencyKeySchema = z.string().trim().min(8).max(160);
const campaignKeySchema = z.string().trim().min(1).max(160);
const snapshotHashSchema = z.string().length(64);
const isoDateTimeSchema = z.string().datetime();

export const legacyActivationCampaignSegmentSchema = z.enum([
  'active_legacy_family_users',
  'other_family_leads',
  'school_leads',
]);
export type LegacyActivationCampaignSegment = z.infer<typeof legacyActivationCampaignSegmentSchema>;

export const legacyActivationCampaignChannelSchema = z.enum(['email', 'whatsapp']);
export type LegacyActivationCampaignChannel = z.infer<typeof legacyActivationCampaignChannelSchema>;

export const legacyActivationTemplateKindSchema = z.enum([
  'activation_migration',
  'launch_signup',
  'school_follow_up',
]);
export type LegacyActivationTemplateKind = z.infer<typeof legacyActivationTemplateKindSchema>;

export const legacyActivationCampaignStatusSchema = z.enum([
  'previewed',
  'approved',
  'running',
  'paused',
  'cancelled',
  'completed',
  'blocked',
]);
export type LegacyActivationCampaignStatus = z.infer<typeof legacyActivationCampaignStatusSchema>;

export const legacyActivationDeliveryStateSchema = z.enum([
  'queued',
  'provider_accepted',
  'delivered',
  'bounced',
  'complained',
  'suppressed',
  'failed',
  'dead_lettered',
  'cancelled',
]);
export type LegacyActivationDeliveryState = z.infer<typeof legacyActivationDeliveryStateSchema>;

export const legacyActivationBlockReasonSchema = z.enum([
  'not_approved',
  'snapshot_mismatch',
  'snapshot_stale',
  'real_audience_not_authorized',
  'protected_canary_not_authorized',
  'protected_canary_destination_mismatch',
  'whatsapp_disabled',
  'recipient_destination_ingest_required',
]);
export type LegacyActivationBlockReason = z.infer<typeof legacyActivationBlockReasonSchema>;

export const legacyActivationCampaignPreviewRequestSchema = z
  .object({
    idempotency_key: idempotencyKeySchema,
    batch_key: campaignKeySchema,
    segment: legacyActivationCampaignSegmentSchema,
    channel: legacyActivationCampaignChannelSchema,
    template_revision: z.string().trim().min(3).max(120),
    batch_size: z.number().int().min(1).max(250),
    schedule_not_before: isoDateTimeSchema.optional(),
    operator_note: z.string().trim().max(500).optional(),
  })
  .strict();
export type LegacyActivationCampaignPreviewRequest = z.infer<
  typeof legacyActivationCampaignPreviewRequestSchema
>;

export const legacyActivationCampaignCountsSchema = z
  .object({
    snapshot_rows: z.number().int().min(0),
    eligible_rows: z.number().int().min(0),
    active_legacy_family_users: z.number().int().min(0),
    other_family_leads: z.number().int().min(0),
    school_leads: z.number().int().min(0),
    already_activated_excluded: z.number().int().min(0),
    manual_review_excluded: z.number().int().min(0),
    duplicate_excluded: z.number().int().min(0),
    suppressed_excluded: z.number().int().min(0),
    invalid_destination_excluded: z.number().int().min(0),
    whatsapp_disabled_excluded: z.number().int().min(0),
    not_in_segment_excluded: z.number().int().min(0),
  })
  .strict();
export type LegacyActivationCampaignCounts = z.infer<typeof legacyActivationCampaignCountsSchema>;

export const legacyActivationCampaignPreviewSchema = z
  .object({
    campaign_key: campaignKeySchema,
    batch_key: campaignKeySchema,
    source_request_hash: snapshotHashSchema,
    source_digest: snapshotHashSchema,
    source_generated_at: isoDateTimeSchema,
    segment: legacyActivationCampaignSegmentSchema,
    channel: legacyActivationCampaignChannelSchema,
    template_revision: z.string().trim().min(3).max(120),
    template_kind: legacyActivationTemplateKindSchema,
    schedule_not_before: isoDateTimeSchema.nullable(),
    batch_size: z.number().int().min(1).max(250),
    snapshot_hash: snapshotHashSchema,
    snapshot_expires_at: isoDateTimeSchema,
    counts: legacyActivationCampaignCountsSchema,
    sample_row_refs: z.array(z.string().min(1).max(160)).max(5),
    recipient_row_keys: z.array(z.string().min(1).max(160)),
    status: z.literal('previewed'),
    created_at: isoDateTimeSchema,
    raw_recipient_list_included: z.literal(false),
    message_body_included: z.literal(false),
    production_side_effects: z.literal(false),
  })
  .strict();
export type LegacyActivationCampaignPreview = z.infer<typeof legacyActivationCampaignPreviewSchema>;

export const legacyActivationCampaignApprovalRequestSchema = z
  .object({
    idempotency_key: idempotencyKeySchema,
    campaign_key: campaignKeySchema,
    snapshot_hash: snapshotHashSchema,
    approved_segment: legacyActivationCampaignSegmentSchema,
    approved_channel: legacyActivationCampaignChannelSchema,
    approved_template_revision: z.string().trim().min(3).max(120),
    approved_batch_size: z.number().int().min(1).max(250),
    approved_schedule_not_before: isoDateTimeSchema.nullable(),
    operator_approval_statement: z.string().trim().min(20).max(1000),
    ops03b_login_verified: z.boolean().default(false),
    real_audience_authorized: z.boolean().default(false),
    canary_authorized: z.boolean().default(false),
  })
  .strict();
export type LegacyActivationCampaignApprovalRequest = z.infer<
  typeof legacyActivationCampaignApprovalRequestSchema
>;

export const legacyActivationCampaignApprovalSchema = z
  .object({
    campaign_key: campaignKeySchema,
    snapshot_hash: snapshotHashSchema,
    approval_fingerprint: snapshotHashSchema,
    approved_at: isoDateTimeSchema,
    status: z.literal('approved'),
    ops03b_login_verified: z.boolean(),
    real_audience_authorized: z.boolean(),
    canary_authorized: z.boolean(),
    production_side_effects: z.literal(false),
  })
  .strict();
export type LegacyActivationCampaignApproval = z.infer<
  typeof legacyActivationCampaignApprovalSchema
>;

export const legacyActivationCampaignQueueModeSchema = z.enum(['canary', 'batch']);
export type LegacyActivationCampaignQueueMode = z.infer<
  typeof legacyActivationCampaignQueueModeSchema
>;

export const legacyActivationLifecycleSubjectSchema = z
  .object({
    household_key: z.string().trim().min(3).max(180),
    relationship_key: z.string().trim().min(3).max(180),
    relationship_label: z.string().trim().min(1).max(80).default('Parent'),
    authority: z.enum(['primary_guardian', 'guardian']).default('guardian'),
  })
  .strict();
export type LegacyActivationLifecycleSubject = z.infer<
  typeof legacyActivationLifecycleSubjectSchema
>;

export const legacyActivationCampaignQueueRequestSchema = z
  .object({
    idempotency_key: idempotencyKeySchema,
    campaign_key: campaignKeySchema,
    snapshot_hash: snapshotHashSchema,
    mode: legacyActivationCampaignQueueModeSchema,
    requested_count: z.number().int().min(1).max(250),
    protected_canary_destination: z.string().trim().email().max(254).optional(),
    protected_canary_display_name: z.string().trim().min(1).max(180).optional(),
    lifecycle_subject: legacyActivationLifecycleSubjectSchema.optional(),
    operator_authorization_reference: z.string().trim().max(240).optional(),
  })
  .strict();
export type LegacyActivationCampaignQueueRequest = z.infer<
  typeof legacyActivationCampaignQueueRequestSchema
>;

export const legacyActivationCampaignSendIntentSchema = z
  .object({
    intent_key: campaignKeySchema,
    campaign_key: campaignKeySchema,
    identity_ref: z.string().min(1).max(160),
    channel: legacyActivationCampaignChannelSchema,
    template_revision: z.string().trim().min(3).max(120),
    delivery_state: legacyActivationDeliveryStateSchema,
    destination_ref: snapshotHashSchema.nullable(),
    lifecycle_intent_ref: z.string().min(1).max(180).nullable(),
    raw_destination_included: z.literal(false),
    raw_token_included: z.literal(false),
    external_send_performed: z.literal(false),
  })
  .strict();
export type LegacyActivationCampaignSendIntent = z.infer<
  typeof legacyActivationCampaignSendIntentSchema
>;

export const legacyActivationCampaignQueueResultSchema = z
  .object({
    campaign_key: campaignKeySchema,
    status: z.enum(['queued', 'blocked']),
    mode: legacyActivationCampaignQueueModeSchema,
    requested_count: z.number().int().min(1).max(250),
    queued_count: z.number().int().min(0),
    blocked_reasons: z.array(legacyActivationBlockReasonSchema),
    intents: z.array(legacyActivationCampaignSendIntentSchema),
    provider_acceptance_is_delivery: z.literal(false),
    external_send_performed: z.literal(false),
    raw_recipient_list_included: z.literal(false),
    raw_token_included: z.literal(false),
  })
  .strict();
export type LegacyActivationCampaignQueueResult = z.infer<
  typeof legacyActivationCampaignQueueResultSchema
>;

export const legacyActivationCampaignControlRequestSchema = z
  .object({
    idempotency_key: idempotencyKeySchema,
    action: z.enum(['pause', 'resume', 'cancel']),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type LegacyActivationCampaignControlRequest = z.infer<
  typeof legacyActivationCampaignControlRequestSchema
>;

export const legacyActivationCampaignControlResultSchema = z
  .object({
    campaign_key: campaignKeySchema,
    action: z.enum(['pause', 'resume', 'cancel']),
    status: legacyActivationCampaignStatusSchema,
    replayed: z.boolean(),
    production_side_effects: z.literal(false),
  })
  .strict();
export type LegacyActivationCampaignControlResult = z.infer<
  typeof legacyActivationCampaignControlResultSchema
>;
