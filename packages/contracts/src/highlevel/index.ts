import { z } from 'zod';
import { applyCurrentAccessStateSchema } from '../access/index.ts';

export const HIGHLEVEL_CONTRACT_VERSION = '1.0.0' as const;

export const highLevelEventNameSchema = z.enum([
  'adult.signup.submitted',
  'parent.household.sync_requested',
  'parent.portal.invitation_requested',
  'parent.portal.activated',
  'class.reminder.requested',
  'recording.available',
  'event.registration.recorded',
]);
export type HighLevelEventName = z.infer<typeof highLevelEventNameSchema>;

export const highLevelActionNameSchema = z.enum([
  'bot.complete_signup',
  'bot.next_confirmed_class_info',
  'bot.member_login',
  'bot.password_help',
  'bot.apply_opt_out',
  'access.apply_current_state',
]);
export type HighLevelActionName = z.infer<typeof highLevelActionNameSchema>;

const highLevelBotActionNameSchema = z.enum([
  'bot.complete_signup',
  'bot.next_confirmed_class_info',
  'bot.member_login',
  'bot.password_help',
  'bot.apply_opt_out',
]);

export const highLevelConsentContextSchema = z.object({
  email: z.enum(['granted', 'not_granted']),
  whatsapp: z.enum(['granted', 'not_granted']),
  suppression_state: z.enum(['active', 'suppressed']),
  email_dnd: z.boolean(),
  whatsapp_dnd: z.boolean(),
  policy_version: z.string().trim().min(1).max(120),
  captured_at: z.iso.datetime(),
});
export type HighLevelConsentContext = z.infer<typeof highLevelConsentContextSchema>;

export const highLevelProtectedReferenceSchema = z.object({
  kind: z.literal('one_time_path'),
  path: z.enum(['/signup', '/app/parent', '/login', '/forgot-password', '/tisha-bav']),
});

const highLevelActorSchema = z.object({
  kind: z.enum(['system', 'admin', 'parent', 'highlevel_bot']),
  reference: z.string().trim().min(1).max(160),
});

const highLevelScopeSchema = z
  .object({
    account_key: z.string().trim().min(1).max(160),
    product_key: z.string().trim().min(1).max(160),
    location_id: z.string().trim().min(1).max(160),
  })
  .strict();

const highLevelEventDataSchema = z
  .object({
    signup_key: z.string().trim().min(1).max(180).optional(),
    household_key: z.string().trim().min(1).max(180).optional(),
    occurrence_key: z.string().trim().min(1).max(180).optional(),
    content_item_key: z.string().trim().min(1).max(180).optional(),
    starts_at: z.iso.datetime().optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
    classification: z.enum(['family', 'school']).optional(),
    portal_status: z.enum(['invited', 'active']).optional(),
    event_code: z.literal('tisha-bav-2026').optional(),
    registration_key: z.string().trim().min(1).max(180).optional(),
    permission_scope: z.literal('event_service_email').optional(),
  })
  .strict();

export const highLevelOutboundEventSchema = z
  .object({
    contract_version: z.literal(HIGHLEVEL_CONTRACT_VERSION),
    event_name: highLevelEventNameSchema,
    event_id: z.string().trim().min(8).max(180),
    idempotency_key: z.string().trim().min(8).max(180),
    occurred_at: z.iso.datetime(),
    actor: highLevelActorSchema,
    scope: highLevelScopeSchema,
    adult_contact: z.object({
      contact_key: z.string().trim().min(1).max(180),
      adult_only: z.literal(true),
    }),
    consent: highLevelConsentContextSchema.optional(),
    protected_reference: highLevelProtectedReferenceSchema,
    data: highLevelEventDataSchema,
  })
  .strict()
  .superRefine((event, context) => {
    if (event.event_name !== 'event.registration.recorded') {
      if (!event.consent) {
        context.addIssue({
          code: 'custom',
          message: 'Non-event HighLevel projections require the shared consent context.',
          path: ['consent'],
        });
      }
      return;
    }
    if (event.consent) {
      context.addIssue({
        code: 'custom',
        message: 'Event-service permission must not project shared marketing consent.',
        path: ['consent'],
      });
    }
    if (
      event.data.event_code !== 'tisha-bav-2026' ||
      !event.data.registration_key ||
      event.data.permission_scope !== 'event_service_email' ||
      event.protected_reference.path !== '/tisha-bav'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Event registration projection requires the exact scoped event contract.',
        path: ['data'],
      });
    }
  });
export type HighLevelOutboundEvent = z.infer<typeof highLevelOutboundEventSchema>;

const highLevelBotActionDataSchema = z
  .object({
    details_complete: z.boolean().optional(),
    channel: z.enum(['email', 'whatsapp', 'all']).optional(),
    email_restriction: z
      .enum(['global_suppression', 'global_dnd', 'global_unsubscribe', 'complaint', 'hard_bounce'])
      .optional(),
  })
  .strict();

const highLevelInboundActionBaseSchema = z
  .object({
    contract_version: z.literal(HIGHLEVEL_CONTRACT_VERSION),
    request_id: z.string().trim().min(8).max(180),
    idempotency_key: z.string().trim().min(8).max(180),
    requested_at: z.iso.datetime(),
    scope: highLevelScopeSchema,
    adult_contact: z
      .object({
        contact_key: z.string().trim().min(1).max(180),
        adult_only: z.literal(true),
      })
      .strict(),
  })
  .strict();

const highLevelInboundBotActionSchema = highLevelInboundActionBaseSchema.extend({
  action_name: highLevelBotActionNameSchema,
  actor: z
    .object({
      kind: z.literal('highlevel_bot'),
      bot_key: z.literal('OT-A1'),
    })
    .strict(),
  data: highLevelBotActionDataSchema.default({}),
});

const highLevelInboundAccessActionSchema = highLevelInboundActionBaseSchema.extend({
  action_name: z.literal('access.apply_current_state'),
  actor: z
    .object({
      kind: z.literal('highlevel_system'),
      integration_key: z.literal('OT-ACCESS'),
    })
    .strict(),
  data: applyCurrentAccessStateSchema,
});

export const highLevelInboundActionSchema = z.union([
  highLevelInboundBotActionSchema,
  highLevelInboundAccessActionSchema,
]);
export type HighLevelInboundAction = z.infer<typeof highLevelInboundActionSchema>;

export const highLevelBlockerCodeSchema = z.enum([
  'HIGHLEVEL_PROVIDER_OFF',
  'HIGHLEVEL_PROVIDER_UNCONFIGURED',
  'HIGHLEVEL_TRANSPORT_UNAUTHORIZED',
  'HIGHLEVEL_PROVIDER_OPERATION_UNCERTAIN',
  'HIGHLEVEL_ACTIONS_OFF',
  'HIGHLEVEL_ACTION_AUTH_FAILED',
  'HIGHLEVEL_ACTION_REPLAYED',
  'HIGHLEVEL_SCOPE_MISMATCH',
  'HIGHLEVEL_ADULT_CONTACT_NOT_FOUND',
  'HIGHLEVEL_ACCESS_IDENTITY_NOT_FOUND',
  'HIGHLEVEL_ACCESS_IDENTITY_AMBIGUOUS',
  'HIGHLEVEL_ACCESS_IDENTITY_MISMATCH',
  'HIGHLEVEL_ACCESS_STATE_STALE',
  'HIGHLEVEL_ACCESS_STATE_CONFLICT',
  'HIGHLEVEL_ACCESS_SOURCE_PRECEDENCE',
  'HIGHLEVEL_CONTACT_INELIGIBLE',
  'HIGHLEVEL_ACTION_RATE_LIMITED',
  'HIGHLEVEL_IDEMPOTENCY_CONFLICT',
  'HIGHLEVEL_DEPENDENCY_UNAVAILABLE',
]);
export type HighLevelBlockerCode = z.infer<typeof highLevelBlockerCodeSchema>;

export type HighLevelActionResult =
  | {
      ok: true;
      action_name: HighLevelActionName;
      replayed: boolean;
      protected_reference: z.infer<typeof highLevelProtectedReferenceSchema> | null;
      result: Record<string, string | number | boolean | null>;
    }
  | { ok: false; code: HighLevelBlockerCode; retryable: boolean };

const FORBIDDEN_HIGHLEVEL_KEYS = new Set([
  'student',
  'student_id',
  'learner',
  'learner_key',
  'username',
  'password',
  'token',
  'security_token',
  'message_body',
  'destination',
  'zoom_url',
  'vimeo_url',
  'amount',
  'amount_paid',
  'invoice',
  'invoice_id',
  'card',
  'card_number',
  'subscription',
  'subscription_id',
  'payment',
  'payment_history',
]);

export function assertHighLevelPayloadSafe(value: unknown): void {
  inspect(value, 'payload');
}

function inspect(value: unknown, path: string): void {
  if (
    typeof value === 'string' &&
    /https?:\/\/(?:[^/]+\.)?(?:zoom\.us|vimeo\.com)\b/i.test(value)
  ) {
    throw new Error(`HIGHLEVEL_FORBIDDEN_PROVIDER_URL:${path}`);
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspect(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_HIGHLEVEL_KEYS.has(key.toLowerCase())) {
      throw new Error(`HIGHLEVEL_FORBIDDEN_FIELD:${path}.${key}`);
    }
    inspect(entry, `${path}.${key}`);
  }
}
