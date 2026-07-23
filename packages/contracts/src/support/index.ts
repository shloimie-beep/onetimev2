import { z } from 'zod';

const crockfordId = '[0-9A-HJKMNP-TV-Z]{26}';
const opaqueActorId = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/;
const sha256Hex = /^[a-f0-9]{64}$/;
const isoDateTime = z.string().datetime({ offset: true });

export const supportTicketCategorySchema = z.enum([
  'access_login',
  'class_zoom',
  'billing',
  'content',
  'technical_bug',
  'account_family',
  'other',
]);
export type SupportTicketCategory = z.infer<typeof supportTicketCategorySchema>;

const supportEventTicketCategorySchema = z.union([
  supportTicketCategorySchema,
  z.enum(['bug', 'complaint']),
]);

export const supportReplyPreferenceSchema = z.enum(['in_app', 'email', 'whatsapp']);
export type SupportReplyPreference = z.infer<typeof supportReplyPreferenceSchema>;

export const supportTicketStatusSchema = z.enum([
  'new',
  'triage',
  'pending_operator',
  'waiting_customer',
  'in_progress',
  'resolved',
  'closed',
  'rejected',
]);
export type SupportTicketStatus = z.infer<typeof supportTicketStatusSchema>;

const issueDetailsSchema = z.object({
  steps_to_reproduce: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
  expected_behavior: z.string().trim().min(1).max(1500).nullable().default(null),
  actual_behavior: z.string().trim().min(1).max(1500).nullable().default(null),
  occurrence: z
    .enum(['once', 'intermittent', 'always', 'not_applicable'])
    .default('not_applicable'),
  first_observed_at: isoDateTime.nullable().default(null),
  error_code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9][A-Z0-9._:-]{0,99}$/)
    .nullable()
    .default(null),
  provider: z
    .enum(['none', 'authentication', 'zoom', 'payments', 'content_delivery', 'other'])
    .default('none'),
});

const clientContextSchema = z.object({
  route_template: z
    .string()
    .trim()
    .regex(/^\/[A-Za-z0-9_./[\]-]{0,255}$/),
  app_release: z.string().trim().min(1).max(64),
  locale: z.string().trim().min(2).max(35),
  timezone: z.string().trim().min(1).max(64),
});

export const supportAttachmentUploadSchema = z.object({
  filename: z.string().min(1).max(240),
  media_type: z.string().min(1).max(100),
  content_base64: z.string().min(1),
});
export type SupportAttachmentUpload = z.infer<typeof supportAttachmentUploadSchema>;

export const supportSubmissionPayloadSchema = z.object({
  category: supportTicketCategorySchema,
  title: z.string().trim().min(5).max(120),
  message: z.string().trim().min(20).max(6000),
  reply_preference: supportReplyPreferenceSchema.default('in_app'),
  issue_details: issueDetailsSchema.default({
    steps_to_reproduce: [],
    expected_behavior: null,
    actual_behavior: null,
    occurrence: 'not_applicable',
    first_observed_at: null,
    error_code: null,
    provider: 'none',
  }),
  client_context: clientContextSchema,
  attachments: z.array(supportAttachmentUploadSchema).max(3).default([]),
  idempotency_key: z.string().trim().min(8).max(120),
});
export type SupportSubmissionPayload = z.infer<typeof supportSubmissionPayloadSchema>;

export const supportEventAttachmentSchema = z
  .object({
    attachment_id: z.string().regex(new RegExp(`^ota_${crockfordId}$`)),
    normalized_filename: z
      .string()
      .min(1)
      .max(100)
      .refine(noUnsafeFilenameChars, 'Filename contains unsafe characters.'),
    media_type: z.enum(['image/png', 'image/jpeg', 'image/webp', 'text/plain']),
    size_bytes: z.number().int().min(1).max(5_242_880),
    sha256: z.string().regex(sha256Hex),
    transfer_locator: z.string().regex(new RegExp(`^onetime-private-blob://ota_${crockfordId}$`)),
    normalization: z.enum(['image-decoded-and-reencoded', 'utf8-text-normalized']),
    storage_class: z.literal('private'),
    content_disposition: z.literal('attachment'),
    pixel_width: z.number().int().min(1).max(8000).nullable().optional(),
    pixel_height: z.number().int().min(1).max(8000).nullable().optional(),
  })
  .superRefine((attachment, ctx) => {
    if (attachment.media_type === 'text/plain') {
      if (attachment.size_bytes > 1_048_576) {
        ctx.addIssue({
          code: 'custom',
          path: ['size_bytes'],
          message: 'Text attachment too large.',
        });
      }
      if (attachment.normalization !== 'utf8-text-normalized') {
        ctx.addIssue({
          code: 'custom',
          path: ['normalization'],
          message: 'Text attachment must use UTF-8 normalization.',
        });
      }
      if (attachment.pixel_width !== null && attachment.pixel_width !== undefined) {
        ctx.addIssue({ code: 'custom', path: ['pixel_width'], message: 'Text has no pixels.' });
      }
      if (attachment.pixel_height !== null && attachment.pixel_height !== undefined) {
        ctx.addIssue({ code: 'custom', path: ['pixel_height'], message: 'Text has no pixels.' });
      }
      return;
    }
    if (attachment.normalization !== 'image-decoded-and-reencoded') {
      ctx.addIssue({
        code: 'custom',
        path: ['normalization'],
        message: 'Images must be decoded and re-encoded.',
      });
    }
    if (!attachment.pixel_width) {
      ctx.addIssue({ code: 'custom', path: ['pixel_width'], message: 'Image width is required.' });
    }
    if (!attachment.pixel_height) {
      ctx.addIssue({
        code: 'custom',
        path: ['pixel_height'],
        message: 'Image height is required.',
      });
    }
  });
export type SupportEventAttachment = z.infer<typeof supportEventAttachmentSchema>;

export const supportEventV1Schema = z
  .object({
    contract_version: z.literal('1.0.0'),
    event_type: z.literal('onetime.support.ticket.submitted.v1'),
    event_id: z.string().regex(new RegExp(`^evt_${crockfordId}$`)),
    occurred_at: isoDateTime,
    producer: z.object({
      service: z.literal('onetime'),
      environment: z.enum(['development', 'staging', 'production']),
      deployment_id: z.string().min(1).max(64),
      source_commit: z.string().regex(/^[a-f0-9]{40}$/),
    }),
    scope: z
      .object({
        account_key: z.string().min(1).max(128),
        product_key: z.string().min(1).max(128),
      })
      .optional(),
    submission: z.object({
      source_ticket_id: z.string().regex(new RegExp(`^ots_${crockfordId}$`)),
      receipt_id: z.string().regex(new RegExp(`^otr_${crockfordId}$`)),
      outbox_id: z.string().regex(new RegExp(`^otx_${crockfordId}$`)),
    }),
    actor: z.object({
      onetime_user_id: z.string().regex(opaqueActorId),
      onetime_account_id: z.string().regex(opaqueActorId),
    }),
    authorization: z.object({
      policy_version: z.enum([
        'ot89-subscriber-support-v1',
        'ot114-subscriber-support-v1',
        'ot-launch-01-current-access-v1',
        'ot114-owner-admin-support-v1',
      ]),
      authenticated: z.literal(true),
      account_id: z.string().regex(opaqueActorId),
      entitlement_product: z.literal('one_time'),
      entitlement_id: z.string().regex(opaqueActorId),
      entitlement_status: z.literal('active'),
      checked_at: isoDateTime,
      valid_until: isoDateTime.nullable(),
    }),
    ticket: z.object({
      category: supportEventTicketCategorySchema,
      severity: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      title: z.string().min(5).max(120),
      redacted_summary: z.string().min(1).max(500).optional(),
      message: z.string().min(20).max(6000),
      issue_details: issueDetailsSchema,
      client_context: clientContextSchema,
      reply_preference: supportReplyPreferenceSchema,
      idempotency_key_hash: z.string().regex(sha256Hex).optional(),
      operator_triage: z
        .object({
          bna_triage_candidate: z.boolean(),
          decision_state: z.enum(['triage_candidate', 'decision_needed']),
          structured_options: z.array(z.string().min(1).max(120)).min(1).max(4),
        })
        .optional(),
    }),
    attachments: z.array(supportEventAttachmentSchema).max(3),
    privacy: z.object({
      redaction_policy: z.literal('ot89-redaction-v1'),
      content_state: z.literal('sanitized_user_text'),
      contains_raw_secrets: z.literal(false),
      contains_direct_contact_details: z.literal(false),
      redacted_fields: z
        .array(
          z.enum([
            'ticket.title',
            'ticket.message',
            'ticket.issue_details.steps_to_reproduce',
            'ticket.issue_details.expected_behavior',
            'ticket.issue_details.actual_behavior',
            'attachments.normalized_filename',
          ]),
        )
        .max(6),
      redaction_count: z.number().int().min(0).max(1000),
    }),
    trace: z.object({
      correlation_id: z.string().regex(opaqueActorId),
      request_id: z.string().regex(opaqueActorId),
    }),
  })
  .strict();
export type SupportEventV1 = z.infer<typeof supportEventV1Schema>;

export const supportStatusRequestSchema = z
  .object({
    source_ticket_id: z.string().regex(new RegExp(`^ots_${crockfordId}$`)),
    onetime_account_id: z.string().regex(opaqueActorId),
  })
  .strict();
export type SupportStatusRequest = z.infer<typeof supportStatusRequestSchema>;

export const supportStatusResponseSchema = z
  .object({
    source_ticket_id: z.string().regex(new RegExp(`^ots_${crockfordId}$`)),
    bna_ticket_ref: z.string().regex(new RegExp(`^bna_${crockfordId}$`)),
    status: supportTicketStatusSchema,
    public_summary: z.string().min(1).max(500),
    status_version: z.number().int().min(1),
    updated_at: isoDateTime,
  })
  .strict();
export type SupportStatusResponse = z.infer<typeof supportStatusResponseSchema>;

export const supportReceiptResponseSchema = z.object({
  success: z.literal(true),
  receipt_id: z.string().regex(new RegExp(`^otr_${crockfordId}$`)),
  source_ticket_id: z.string().regex(new RegExp(`^ots_${crockfordId}$`)),
  status_path: z.string().regex(/^\/app\/support\/receipts\/otr_[0-9A-HJKMNP-TV-Z]{26}$/),
  delivery_state: z.enum(['queued', 'delivery_delayed', 'delivered', 'dead_letter']),
  duplicate_submission: z.boolean(),
});
export type SupportReceiptResponse = z.infer<typeof supportReceiptResponseSchema>;

function noUnsafeFilenameChars(value: string) {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (char === '/' || char === '\\' || code <= 0x1f || code === 0x7f) return false;
  }
  return true;
}
