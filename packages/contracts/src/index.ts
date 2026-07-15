import { z } from 'zod';

export * from './classes/index.ts';
export * from './content/index.ts';

export const reminderPreferenceSchema = z.enum(['email', 'whatsapp', 'both', 'none']);
export type ReminderPreference = z.infer<typeof reminderPreferenceSchema>;

export const audienceTypeSchema = z.enum(['family', 'school']);
export type AudienceType = z.infer<typeof audienceTypeSchema>;

function isIanaTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export const leadPayloadSchema = z
  .object({
    contact_name: z.string().trim().min(2).max(180),
    family_or_school: z.string().trim().min(1).max(180),
    audience_type: audienceTypeSchema,
    location: z.string().trim().min(2).max(180),
    timezone: z.string().trim().min(1).max(80),
    browser_timezone: z.string().trim().max(80).optional(),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(40).optional().default(''),
    reminder_preference: reminderPreferenceSchema,
    reminder_consent: z.boolean().optional().default(false),
    idempotency_key: z.string().trim().min(8).max(120),
    attribution: z
      .object({
        landing_path: z.string().max(120).optional(),
        referrer: z.string().max(500).optional(),
        utm_source: z.string().max(120).optional(),
        utm_medium: z.string().max(120).optional(),
        utm_campaign: z.string().max(120).optional(),
        utm_term: z.string().max(120).optional(),
        utm_content: z.string().max(120).optional(),
      })
      .optional()
      .default({}),
  })
  .superRefine((payload, ctx) => {
    const needsPhone =
      payload.reminder_preference === 'whatsapp' || payload.reminder_preference === 'both';
    if (needsPhone && !payload.phone?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Enter a WhatsApp number or choose a different reminder option.',
      });
    }
    if (payload.reminder_preference !== 'none' && !payload.reminder_consent) {
      ctx.addIssue({
        code: 'custom',
        path: ['reminder_consent'],
        message: 'Confirm that we may send the selected class information and reminders.',
      });
    }
    if (!isIanaTimeZone(payload.timezone)) {
      ctx.addIssue({
        code: 'custom',
        path: ['timezone'],
        message: 'Enter a valid IANA time zone such as America/New_York.',
      });
    }
  });

export type LeadPayload = z.infer<typeof leadPayloadSchema>;

export type LeadSuccessResponse = {
  success: true;
  duplicate_submission: boolean;
  classification: AudienceType;
  contact_key: string;
  signup_key: string;
  confirmation_queued: true;
  outbox_intents: string[];
  message: {
    heading: string;
    body: string;
  };
};

export type LeadErrorResponse = {
  success: false;
  code: 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'IDEMPOTENCY_CONFLICT' | 'SERVER_ERROR';
  message: string;
  request_id?: string;
  field_errors?: Record<string, string>;
};

export type LeadResponse = LeadSuccessResponse | LeadErrorResponse;

export function publicFieldErrors(error: z.ZodError): Record<string, string> {
  const output: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !output[key]) {
      output[key] = issue.message;
    }
  }
  return output;
}

export const userRoleSchema = z.enum(['owner', 'admin', 'crm_agent', 'viewer']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const roleDisplayLabel: Record<UserRole, string> = {
  owner: 'Administrator',
  admin: 'Administrator',
  crm_agent: 'CRM Agent',
  viewer: 'Viewer',
};

export const leadStatusSchema = z.enum([
  'new',
  'in_review',
  'contacted',
  'scheduled',
  'closed',
  'archived',
]);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

export const contactSortSchema = z.enum(['updated_desc', 'created_desc', 'name_asc']);
export type ContactSort = z.infer<typeof contactSortSchema>;

const optionalTrimmed = (max = 180) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const loginPayloadSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(256),
  csrf_token: z.string().trim().min(16).max(160).optional(),
  return_to: z.string().trim().max(240).optional(),
});
export type LoginPayload = z.infer<typeof loginPayloadSchema>;

export const mfaChallengePayloadSchema = z.object({
  challenge_token: z.string().trim().min(32).max(200),
  totp_code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});
export type MfaChallengePayload = z.infer<typeof mfaChallengePayloadSchema>;

export const mfaRecoveryPayloadSchema = z.object({
  challenge_token: z.string().trim().min(32).max(200),
  recovery_code: z.string().trim().min(8).max(40),
});
export type MfaRecoveryPayload = z.infer<typeof mfaRecoveryPayloadSchema>;

export const mfaEnrollmentPayloadSchema = z.object({
  enrollment_token: z.string().trim().min(32).max(200),
  totp_code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});
export type MfaEnrollmentPayload = z.infer<typeof mfaEnrollmentPayloadSchema>;

const contactBaseObject = z.object({
  display_name: z.string().trim().min(2).max(180),
  family_school_classification: audienceTypeSchema,
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().default(''),
  location: z.string().trim().min(2).max(180),
  timezone: z.string().trim().min(1).max(80),
  lead_status: leadStatusSchema.default('new'),
  assigned_user_key: optionalTrimmed(160),
  internal_note: z.string().trim().max(1000).optional().default(''),
});

function validateOptionalTimezone(
  payload: { timezone?: string | undefined },
  ctx: z.RefinementCtx,
) {
  if (payload.timezone && !isIanaTimeZone(payload.timezone)) {
    ctx.addIssue({
      code: 'custom',
      path: ['timezone'],
      message: 'Enter a valid IANA time zone such as America/New_York.',
    });
  }
}

export const contactBaseSchema = contactBaseObject.superRefine((payload, ctx) => {
  validateOptionalTimezone(payload, ctx);
});

export const createContactSchema = contactBaseObject
  .extend({
    idempotency_key: z.string().trim().min(8).max(120),
  })
  .superRefine((payload, ctx) => {
    validateOptionalTimezone(payload, ctx);
  });
export type CreateContactPayload = z.infer<typeof createContactSchema>;

export const updateContactSchema = contactBaseObject
  .partial()
  .extend({
    version: z.coerce.number().int().min(1),
  })
  .superRefine((payload, ctx) => {
    validateOptionalTimezone(payload, ctx);
  });
export type UpdateContactPayload = z.infer<typeof updateContactSchema>;

export const contactListQuerySchema = z.object({
  classification: audienceTypeSchema.optional(),
  lead_status: leadStatusSchema.optional(),
  source: z.string().trim().max(80).optional(),
  assigned_user_key: z.string().trim().max(160).optional(),
  sort: contactSortSchema.optional().default('updated_desc'),
  cursor: z.string().trim().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(25).optional().default(12),
});
export type ContactListQuery = z.infer<typeof contactListQuerySchema>;

export const contactSearchCommandSchema = contactListQuerySchema.extend({
  search: z.string().trim().max(120).optional().default(''),
});
export type ContactSearchCommand = z.infer<typeof contactSearchCommandSchema>;

export type SessionUser = {
  user_key: string;
  email: string;
  display_name: string;
  role: UserRole;
  role_label: string;
  mfa_capable: boolean;
};

export type ContactListItem = {
  contact_id: string;
  display_name: string;
  family_school_classification: AudienceType;
  lead_status: LeadStatus;
  email: string | null;
  phone: string | null;
  source: string;
  assigned_team_member: string | null;
  last_activity_at: string;
  updated_at: string;
  version: number;
};

export const contactListItemSchema = z.object({
  contact_id: z.string().min(1),
  display_name: z.string().min(1),
  family_school_classification: audienceTypeSchema,
  lead_status: leadStatusSchema,
  email: z.string().nullable(),
  phone: z.string().nullable(),
  source: z.string(),
  assigned_team_member: z.string().nullable(),
  last_activity_at: z.string(),
  updated_at: z.string(),
  version: z.number().int(),
}) satisfies z.ZodType<ContactListItem>;

export type ContactDetail = ContactListItem & {
  location: string;
  timezone: string;
  reminder_preference: ReminderPreference;
  consent_state: 'recorded' | 'not_recorded';
  suppression_state: string;
  offer_version: string | null;
  content_version: string | null;
  created_at: string;
  audit_safe_signup_provenance: {
    source: string;
    signup_key: string | null;
    captured_at: string | null;
  };
  internal_note: string;
};

export const contactDetailSchema: z.ZodType<ContactDetail> = contactListItemSchema.extend({
  location: z.string(),
  timezone: z.string(),
  reminder_preference: reminderPreferenceSchema,
  consent_state: z.enum(['recorded', 'not_recorded']),
  suppression_state: z.string(),
  offer_version: z.string().nullable(),
  content_version: z.string().nullable(),
  created_at: z.string(),
  audit_safe_signup_provenance: z.object({
    source: z.string(),
    signup_key: z.string().nullable(),
    captured_at: z.string().nullable(),
  }),
  internal_note: z.string(),
});

export const contactListResponseSchema = z.object({
  success: z.literal(true),
  contacts: z.array(contactListItemSchema),
  next_cursor: z.string().nullable(),
  applied_filters: z.record(z.string(), z.string().optional()),
});

export const contactResponseSchema = z.object({
  success: z.literal(true),
  contact: contactDetailSchema,
});

export const assigneeSchema = z.object({
  user_key: z.string(),
  display_name: z.string(),
  role: userRoleSchema,
  role_label: z.string(),
});

export type Assignee = z.infer<typeof assigneeSchema>;

export const assigneeListResponseSchema = z.object({
  success: z.literal(true),
  assignees: z.array(assigneeSchema),
});
