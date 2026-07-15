import { z } from 'zod';

const scopedKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);

const opaqueKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(180)
  .regex(/^[A-Za-z0-9_:-]+$/);

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const audienceImportCellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type AudienceImportCell = z.infer<typeof audienceImportCellSchema>;

export const audienceTypeSchema = z.enum(['family', 'school', 'unknown']);
export type AudienceType = z.infer<typeof audienceTypeSchema>;

export const audienceConsentStatusSchema = z.enum([
  'consented',
  'not_recorded',
  'unsubscribed',
  'unknown',
]);
export type AudienceConsentStatus = z.infer<typeof audienceConsentStatusSchema>;

export const audienceSuppressionStatusSchema = z.enum([
  'active',
  'do_not_contact',
  'unsubscribed',
  'bounced',
  'complaint',
  'wrong_number',
]);
export type AudienceSuppressionStatus = z.infer<typeof audienceSuppressionStatusSchema>;

export const audienceCommunicationEligibilitySchema = z.enum([
  'eligible',
  'needs_consent_review',
  'blocked_missing_channel',
  'blocked_suppression',
]);
export type AudienceCommunicationEligibility = z.infer<
  typeof audienceCommunicationEligibilitySchema
>;

export const audienceSegmentKeySchema = z.enum([
  'migration_invite_eligible',
  'active_legacy_user',
  'manual_review',
  'school_follow_up',
  'do_not_contact',
]);
export type AudienceSegmentKey = z.infer<typeof audienceSegmentKeySchema>;

export const audienceReconciliationReasonSchema = z.enum([
  'duplicate_row_fingerprint',
  'email_match',
  'phone_match',
  'email_phone_conflict',
  'multiple_identity_matches',
  'missing_reconcilable_identity',
  'name_only_match_forbidden',
  'school_follow_up_required',
  'suppression_blocks_contact',
  'archived_contact',
  'invalid_email',
  'invalid_phone',
  'replay_same_batch_row',
  'new_identity_candidate',
]);
export type AudienceReconciliationReason = z.infer<typeof audienceReconciliationReasonSchema>;

export const audienceReconciliationStatusSchema = z.enum([
  'matched_existing',
  'new_contact_candidate',
  'manual_review',
  'duplicate_input',
  'blocked_do_not_contact',
]);
export type AudienceReconciliationStatus = z.infer<typeof audienceReconciliationStatusSchema>;

export const audienceEntitlementPolicySchema = z.enum([
  'no_class_or_portal_entitlement',
  'not_applicable',
]);
export type AudienceEntitlementPolicy = z.infer<typeof audienceEntitlementPolicySchema>;

export const audienceImportBatchSchema = z
  .object({
    account_key: scopedKeySchema,
    product_key: scopedKeySchema,
    source_spreadsheet_key: opaqueKeySchema,
    source_batch_key: opaqueKeySchema,
    source_name: z.string().trim().min(1).max(180),
    source_kind: z.enum([
      'legacy_audience_export',
      'school_submission_export',
      'synthetic_fixture',
    ]),
    dry_run_only: z.literal(true),
  })
  .strict();
export type AudienceImportBatch = z.infer<typeof audienceImportBatchSchema>;

export const audienceSourceFactsSchema = z
  .object({
    is_lead: z.boolean(),
    in_old_system: z.boolean(),
    active_legacy_user: z.boolean(),
    school_submission: z.boolean(),
  })
  .strict();
export type AudienceSourceFacts = z.infer<typeof audienceSourceFactsSchema>;

export const audienceImportRowSchema = z
  .object({
    source_row_id: opaqueKeySchema,
    source_spreadsheet_key: opaqueKeySchema,
    source_batch_key: opaqueKeySchema,
    source_sheet_name: z.string().trim().min(1).max(120),
    source_row_number: z.number().int().min(1),
    row_fingerprint: sha256Schema,
    display_name_present: z.boolean(),
    email_normalized: z.string().trim().email().max(254).nullable(),
    phone_normalized: z
      .string()
      .trim()
      .regex(/^\+\d{7,15}$/)
      .nullable(),
    audience_type: audienceTypeSchema,
    source_facts: audienceSourceFactsSchema,
    consent_status: audienceConsentStatusSchema,
    suppression_status: audienceSuppressionStatusSchema,
    archived: z.boolean(),
    row_warnings: z.array(audienceReconciliationReasonSchema).max(8),
  })
  .strict();
export type AudienceImportRow = z.infer<typeof audienceImportRowSchema>;

export const audienceExistingContactSchema = z
  .object({
    contact_key: opaqueKeySchema,
    account_key: scopedKeySchema,
    product_key: scopedKeySchema,
    display_name: z.string().trim().min(1).max(180),
    email_normalized: z.string().trim().email().max(254).nullable(),
    phone_normalized: z
      .string()
      .trim()
      .regex(/^\+\d{7,15}$/)
      .nullable(),
    archived: z.boolean().default(false),
    suppression_status: audienceSuppressionStatusSchema.default('active'),
  })
  .strict();
export type AudienceExistingContact = z.infer<typeof audienceExistingContactSchema>;

export const audienceReconciliationDecisionSchema = z
  .object({
    row_key: opaqueKeySchema,
    row_fingerprint: sha256Schema,
    status: audienceReconciliationStatusSchema,
    matched_contact_key: opaqueKeySchema.nullable(),
    reasons: z.array(audienceReconciliationReasonSchema).min(1).max(12),
    segments: z.array(audienceSegmentKeySchema).max(5),
    communication_eligibility: audienceCommunicationEligibilitySchema,
    entitlement_policy: audienceEntitlementPolicySchema,
    rollback_record_key: opaqueKeySchema,
  })
  .strict();
export type AudienceReconciliationDecision = z.infer<typeof audienceReconciliationDecisionSchema>;

export const audienceDryRunReportSchema = z
  .object({
    success: z.literal(true),
    report_kind: z.literal('ot74_audience_reconciliation_dry_run'),
    account_key: scopedKeySchema,
    product_key: scopedKeySchema,
    source_batch_key: opaqueKeySchema,
    source_spreadsheet_key: opaqueKeySchema,
    row_count: z.number().int().min(0),
    unique_row_count: z.number().int().min(0),
    duplicate_row_count: z.number().int().min(0),
    status_counts: z.record(audienceReconciliationStatusSchema, z.number().int().min(0)),
    segment_counts: z.record(audienceSegmentKeySchema, z.number().int().min(0)),
    reason_counts: z.record(audienceReconciliationReasonSchema, z.number().int().min(0)),
    decisions: z.array(audienceReconciliationDecisionSchema),
    rollback_plan: z
      .object({
        rollback_plan_key: opaqueKeySchema,
        reversible_records: z.number().int().min(0),
        destructive_contact_deletes: z.literal(0),
        actions: z.array(
          z
            .object({
              action: z.enum([
                'mark_import_batch_rolled_back',
                'remove_segment_assignments',
                'clear_reconciliation_links',
              ]),
              record_count: z.number().int().min(0),
            })
            .strict(),
        ),
      })
      .strict(),
    external_mutation_counts: z
      .object({
        production_database_writes: z.literal(0),
        messages_sent: z.literal(0),
        provider_mutations: z.literal(0),
        real_spreadsheets_ingested: z.literal(0),
      })
      .strict(),
  })
  .strict();
export type AudienceDryRunReport = z.infer<typeof audienceDryRunReportSchema>;

export const audienceDryRunRequestSchema = z
  .object({
    batch: audienceImportBatchSchema,
    rows: z.array(z.record(z.string(), audienceImportCellSchema)).min(1).max(10000),
  })
  .strict();
export type AudienceDryRunRequest = z.infer<typeof audienceDryRunRequestSchema>;
