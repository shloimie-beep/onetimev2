import { z } from 'zod';

export const HIGHLEVEL_CONTRACT_VERSION = '1.0.0' as const;

export const highLevelEventNameSchema = z.enum([
  'adult.signup.submitted',
  'parent.portal.invitation_requested',
  'parent.portal.activated',
  'class.reminder.requested',
  'recording.available',
]);
export type HighLevelEventName = z.infer<typeof highLevelEventNameSchema>;

export const highLevelActionNameSchema = z.enum([
  'bot.complete_signup',
  'bot.next_confirmed_class_info',
  'bot.member_login',
  'bot.password_help',
  'bot.apply_opt_out',
]);
export type HighLevelActionName = z.infer<typeof highLevelActionNameSchema>;

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
  path: z.enum(['/signup', '/app/parent', '/login', '/forgot-password']),
});

const highLevelActorSchema = z.object({
  kind: z.enum(['system', 'admin', 'parent', 'highlevel_bot']),
  reference: z.string().trim().min(1).max(160),
});

const highLevelScopeSchema = z.object({
  account_key: z.string().trim().min(1).max(160),
  product_key: z.string().trim().min(1).max(160),
  location_id: z.string().trim().min(1).max(160),
});

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
    consent: highLevelConsentContextSchema,
    protected_reference: highLevelProtectedReferenceSchema,
    data: highLevelEventDataSchema,
  })
  .strict();
export type HighLevelOutboundEvent = z.infer<typeof highLevelOutboundEventSchema>;

const highLevelActionDataSchema = z
  .object({
    details_complete: z.boolean().optional(),
    channel: z.enum(['email', 'whatsapp', 'all']).optional(),
  })
  .strict();

export const highLevelInboundActionSchema = z
  .object({
    contract_version: z.literal(HIGHLEVEL_CONTRACT_VERSION),
    action_name: highLevelActionNameSchema,
    request_id: z.string().trim().min(8).max(180),
    idempotency_key: z.string().trim().min(8).max(180),
    requested_at: z.iso.datetime(),
    actor: z.object({ kind: z.literal('highlevel_bot'), bot_key: z.literal('OT-A1') }),
    scope: highLevelScopeSchema,
    adult_contact: z.object({
      contact_key: z.string().trim().min(1).max(180),
      adult_only: z.literal(true),
    }),
    data: highLevelActionDataSchema.default({}),
  })
  .strict();
export type HighLevelInboundAction = z.infer<typeof highLevelInboundActionSchema>;

export const highLevelBlockerCodeSchema = z.enum([
  'HIGHLEVEL_PROVIDER_OFF',
  'HIGHLEVEL_PROVIDER_UNCONFIGURED',
  'HIGHLEVEL_ACTIONS_OFF',
  'HIGHLEVEL_ACTION_AUTH_FAILED',
  'HIGHLEVEL_SCOPE_MISMATCH',
  'HIGHLEVEL_ADULT_CONTACT_NOT_FOUND',
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
      result: Record<string, string | boolean | null>;
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
