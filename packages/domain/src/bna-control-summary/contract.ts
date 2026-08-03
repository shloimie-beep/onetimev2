import { z } from 'zod';

export const BNA_CONTROL_SUMMARY_SCHEMA_VERSION = 'bna.control_summary.v1' as const;
export const BNA_CONTROL_SUMMARY_REPLAY_WINDOW_SECONDS = 300 as const;
export const BNA_CONTROL_SUMMARY_EVENT_TYPES = [
  'work_item.created',
  'work_item.updated',
  'decision.required',
  'ticket.opened',
  'integration.blocked',
  'deploy.started',
  'deploy.failed',
  'deploy.succeeded',
  'canary.failed',
  'canary.succeeded',
  'agent.result_recorded',
] as const;

const dateTimeSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)), {
  message: 'Expected an RFC 3339 date-time value.',
});

const httpsUrlSchema = z.url().refine((value) => new URL(value).protocol === 'https:', {
  message: 'BNA summary deep links must use HTTPS.',
});

export const bnaControlSummaryEventSchema = z
  .object({
    schema_version: z.literal(BNA_CONTROL_SUMMARY_SCHEMA_VERSION),
    event_type: z.enum(BNA_CONTROL_SUMMARY_EVENT_TYPES),
    event_id: z.string().min(8).max(180),
    idempotency_key: z.string().min(8).max(180),
    source_product: z.string().min(1).max(80),
    source_workspace: z.string().min(1).max(120),
    source_object_type: z.string().min(1).max(80),
    source_object_id: z.string().min(1).max(160),
    source_object_version: z.string().min(1).max(80),
    occurred_at: dateTimeSchema,
    title: z.string().min(1).max(240),
    status: z.string().min(1).max(80),
    assignee: z.string().min(1).max(120),
    priority: z.enum(['low', 'normal', 'today', 'urgent']),
    deep_link: httpsUrlSchema,
    data_classification: z.literal('sanitized_summary'),
    signature_algorithm: z.literal('hmac-sha256'),
    key_id: z.string().min(3).max(80),
    signed_at: dateTimeSchema,
    replay_window_seconds: z.literal(BNA_CONTROL_SUMMARY_REPLAY_WINDOW_SECONDS),
  })
  .strict();

export type BnaControlSummaryEvent = z.infer<typeof bnaControlSummaryEventSchema>;
export type BnaControlSummaryEventType = (typeof BNA_CONTROL_SUMMARY_EVENT_TYPES)[number];
export type BnaControlSummaryPriority = BnaControlSummaryEvent['priority'];

export type BnaControlSummaryInput = Omit<
  BnaControlSummaryEvent,
  | 'schema_version'
  | 'data_classification'
  | 'signature_algorithm'
  | 'key_id'
  | 'signed_at'
  | 'replay_window_seconds'
>;
