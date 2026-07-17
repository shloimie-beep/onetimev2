import { z } from 'zod';

export const classOccurrenceStatusSchema = z.enum([
  'scheduled',
  'live',
  'completed',
  'cancelled',
  'unavailable',
]);
export type ClassOccurrenceStatus = z.infer<typeof classOccurrenceStatusSchema>;

export const classStateSchema = z.enum([
  'not_required',
  'pending',
  'satisfied',
  'skipped',
  'provider_unavailable',
  'not_expected',
  'ready',
  'expired',
  'available',
  'unavailable',
  'not_started',
  'open',
  'closed',
  'failed',
]);

export const classReadinessSchema = z.object({
  occurrence_key: z.string().min(1),
  provider_status: z.enum(['provider_unavailable', 'ready', 'needs_setup']),
  reason: z.string().min(1).max(240),
  protected_launch_required: z.literal(true),
  raw_provider_target_present: z.literal(false),
  launch_descriptor: z
    .object({
      kind: z.literal('protected_launch'),
      href: z.string().nullable(),
      token_ref: z.string().nullable(),
      expires_at: z.string().nullable(),
    })
    .nullable(),
});
export type ClassReadiness = z.infer<typeof classReadinessSchema>;

export const classOccurrenceSummarySchema = z.object({
  occurrence_key: z.string().min(1),
  class_series_key: z.string().min(1),
  title: z.string().min(1).max(180),
  local_class_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).max(80),
  starts_at: z.string(),
  reminder_due_at: z.string(),
  status: classOccurrenceStatusSchema,
  acknowledgement_state: classStateSchema,
  reminder_state: classStateSchema,
  access_state: classStateSchema,
  attendance_state: classStateSchema,
  delivery_state: classStateSchema,
  recording_state: classStateSchema,
});
export type ClassOccurrenceSummary = z.infer<typeof classOccurrenceSummarySchema>;

export const classOccurrenceDetailSchema = classOccurrenceSummarySchema.extend({
  readiness: classReadinessSchema,
  fulfillment_counts: z.object({
    queued: z.number().int().min(0),
    satisfied: z.number().int().min(0),
    suppressed: z.number().int().min(0),
    skipped: z.number().int().min(0),
    provider_unavailable: z.number().int().min(0),
  }),
});
export type ClassOccurrenceDetail = z.infer<typeof classOccurrenceDetailSchema>;

export const classOccurrenceListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type ClassOccurrenceListQuery = z.infer<typeof classOccurrenceListQuerySchema>;

export const classOccurrenceListResponseSchema = z.object({
  success: z.literal(true),
  occurrences: z.array(classOccurrenceSummarySchema),
  next_cursor: z.null(),
});

export const classOccurrenceDetailResponseSchema = z.object({
  success: z.literal(true),
  occurrence: classOccurrenceDetailSchema,
});
