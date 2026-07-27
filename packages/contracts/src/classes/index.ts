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

export const productStateLabelSchema = z.enum([
  'Ready',
  'Processing',
  'Action needed',
  'Not connected',
  'No data yet',
  'Temporarily unavailable',
]);
export type ProductStateLabel = z.infer<typeof productStateLabelSchema>;

export const classProductStateSchema = z.object({
  label: productStateLabelSchema,
  explanation: z.string().min(1).max(220),
  action_label: z.string().min(1).max(120).nullable(),
});
export type ClassProductState = z.infer<typeof classProductStateSchema>;

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
  product_state: classProductStateSchema,
  protected_access_state: classProductStateSchema,
  next_action: z.string().min(1).max(160).nullable(),
});
export type ClassOccurrenceSummary = z.infer<typeof classOccurrenceSummarySchema>;

export const classOccurrenceDetailSchema = classOccurrenceSummarySchema.extend({
  readiness: classReadinessSchema,
  enrollment_counts: z.object({
    households: z.number().int().min(0),
    learners: z.number().int().min(0),
  }),
  attendance_summary: z.object({
    manual_marks: z.number().int().min(0),
    launch_attempts: z.number().int().min(0),
    joined_attempts: z.number().int().min(0),
  }),
  content_summary: z.object({
    videos: z.number().int().min(0),
    review_sheets: z.number().int().min(0),
    processing: z.number().int().min(0),
    needs_review: z.number().int().min(0),
  }),
  question_summary: z.object({
    new_questions: z.number().int().min(0),
    featured_questions: z.number().int().min(0),
    answered_questions: z.number().int().min(0),
  }),
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

const safeClassKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(180)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]+$/);
const localTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTimeSchema = z.iso.datetime({ offset: true });
const idempotencyKeySchema = z.string().trim().min(8).max(180);

export const classSeriesStatusSchema = z.enum(['active', 'paused', 'archived']);

export const classSeriesSchema = z.object({
  class_series_key: safeClassKeySchema,
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).nullable(),
  teacher_name: z.string().trim().max(180).nullable(),
  timezone: z.string().trim().min(1).max(80),
  local_start_time: localTimeSchema,
  reminder_local_time: localTimeSchema,
  status: classSeriesStatusSchema,
  version: z.number().int().min(1),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ClassSeries = z.infer<typeof classSeriesSchema>;

export const createClassSeriesPayloadSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).nullable().optional().default(null),
  teacher_name: z.string().trim().max(180).nullable().optional().default(null),
  timezone: z.string().trim().min(1).max(80),
  local_start_time: localTimeSchema,
  reminder_local_time: localTimeSchema,
  idempotency_key: idempotencyKeySchema,
});
export type CreateClassSeriesPayload = z.infer<typeof createClassSeriesPayloadSchema>;

export const updateClassSeriesPayloadSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).nullable(),
  teacher_name: z.string().trim().max(180).nullable(),
  timezone: z.string().trim().min(1).max(80),
  local_start_time: localTimeSchema,
  reminder_local_time: localTimeSchema,
  status: classSeriesStatusSchema,
  version: z.number().int().min(1),
});
export type UpdateClassSeriesPayload = z.infer<typeof updateClassSeriesPayloadSchema>;

export const classSeriesListResponseSchema = z.object({
  success: z.literal(true),
  series: z.array(classSeriesSchema),
});

export const classSeriesResponseSchema = z.object({
  success: z.literal(true),
  series: classSeriesSchema,
});

export const managedClassOccurrenceSchema = z.object({
  occurrence_key: safeClassKeySchema,
  class_series_key: safeClassKeySchema,
  title: z.string().trim().min(1).max(180),
  local_class_date: localDateSchema,
  starts_at: z.string(),
  ends_at: z.string(),
  timezone: z.string().trim().min(1).max(80),
  status: z.enum(['scheduled', 'live', 'completed', 'cancelled']),
  access_state: classStateSchema,
  recording_state: classStateSchema,
  enrolled_learner_count: z.number().int().min(0),
  is_operator_test: z.boolean(),
  operator_test_environment: z.string().nullable(),
  version: z.number().int().min(1),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ManagedClassOccurrence = z.infer<typeof managedClassOccurrenceSchema>;

export const createClassOccurrencePayloadSchema = z
  .object({
    class_series_key: safeClassKeySchema,
    local_class_date: localDateSchema,
    starts_at: isoDateTimeSchema,
    ends_at: isoDateTimeSchema,
    is_operator_test: z.boolean().optional().default(false),
    idempotency_key: idempotencyKeySchema,
  })
  .superRefine((value, context) => {
    if (new Date(value.ends_at) <= new Date(value.starts_at)) {
      context.addIssue({
        code: 'custom',
        path: ['ends_at'],
        message: 'Class end time must be after its start time.',
      });
    }
  });
export type CreateClassOccurrencePayload = z.infer<typeof createClassOccurrencePayloadSchema>;

export const updateClassOccurrencePayloadSchema = z
  .object({
    starts_at: isoDateTimeSchema,
    ends_at: isoDateTimeSchema,
    status: z.enum(['scheduled', 'live', 'completed', 'cancelled']),
    version: z.number().int().min(1),
  })
  .superRefine((value, context) => {
    if (new Date(value.ends_at) <= new Date(value.starts_at)) {
      context.addIssue({
        code: 'custom',
        path: ['ends_at'],
        message: 'Class end time must be after its start time.',
      });
    }
  });
export type UpdateClassOccurrencePayload = z.infer<typeof updateClassOccurrencePayloadSchema>;

export const managedClassOccurrenceResponseSchema = z.object({
  success: z.literal(true),
  occurrence: managedClassOccurrenceSchema,
});

export const classEnrollmentSchema = z.object({
  occurrence_key: safeClassKeySchema,
  household_key: safeClassKeySchema,
  learner_key: safeClassKeySchema,
  learner_name: z.string().trim().min(1).max(180),
  enrollment_state: z.enum(['active', 'revoked']),
  updated_at: z.string(),
});
export type ClassEnrollment = z.infer<typeof classEnrollmentSchema>;

export const classEnrollmentPayloadSchema = z.object({
  learner_key: safeClassKeySchema,
  idempotency_key: idempotencyKeySchema,
});
export type ClassEnrollmentPayload = z.infer<typeof classEnrollmentPayloadSchema>;

export const classEnrollmentListResponseSchema = z.object({
  success: z.literal(true),
  enrollments: z.array(classEnrollmentSchema),
});

export const classEnrollmentResponseSchema = z.object({
  success: z.literal(true),
  enrollment: classEnrollmentSchema,
});

export const classEnrollmentCandidateSchema = z.object({
  household_key: safeClassKeySchema,
  learner_key: safeClassKeySchema,
  learner_name: z.string().trim().min(1).max(180),
  enrollment_state: z.enum(['active', 'revoked']).nullable(),
});
export type ClassEnrollmentCandidate = z.infer<typeof classEnrollmentCandidateSchema>;

export const classEnrollmentCandidateListResponseSchema = z.object({
  success: z.literal(true),
  candidates: z.array(classEnrollmentCandidateSchema),
});

export const classRecordingSchema = z.object({
  occurrence_key: safeClassKeySchema,
  content_item_key: safeClassKeySchema,
  title: z.string().trim().min(1).max(180),
  availability: z.enum(['available', 'unavailable']),
  entitled_learner_count: z.number().int().min(0),
  revoked_learner_count: z.number().int().min(0),
});
export type ClassRecording = z.infer<typeof classRecordingSchema>;

export const attachClassRecordingPayloadSchema = z.object({
  content_item_key: safeClassKeySchema,
  availability: z.enum(['available', 'unavailable']),
  idempotency_key: idempotencyKeySchema,
});
export type AttachClassRecordingPayload = z.infer<typeof attachClassRecordingPayloadSchema>;

export const setClassRecordingAccessPayloadSchema = z.object({
  learner_key: safeClassKeySchema,
  access: z.enum(['active', 'revoked']),
  idempotency_key: idempotencyKeySchema,
});
export type SetClassRecordingAccessPayload = z.infer<typeof setClassRecordingAccessPayloadSchema>;

export const classRecordingListResponseSchema = z.object({
  success: z.literal(true),
  recordings: z.array(classRecordingSchema),
});

export const classRecordingResponseSchema = z.object({
  success: z.literal(true),
  recording: classRecordingSchema,
});

export const classRecordingAccessSchema = z.object({
  occurrence_key: safeClassKeySchema,
  content_item_key: safeClassKeySchema,
  household_key: safeClassKeySchema,
  learner_key: safeClassKeySchema,
  learner_name: z.string().trim().min(1).max(180),
  enrollment_state: z.enum(['active', 'revoked']),
  access: z.enum(['active', 'revoked', 'not_granted']),
});
export type ClassRecordingAccess = z.infer<typeof classRecordingAccessSchema>;

export const classRecordingAccessListResponseSchema = z.object({
  success: z.literal(true),
  access: z.array(classRecordingAccessSchema),
});
