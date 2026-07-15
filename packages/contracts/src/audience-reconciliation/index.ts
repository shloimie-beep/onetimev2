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
