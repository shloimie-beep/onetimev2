import { z } from 'zod';

export const reminderPreferenceSchema = z.enum(['email', 'whatsapp', 'both', 'none']);
export type ReminderPreference = z.infer<typeof reminderPreferenceSchema>;

export const audienceTypeSchema = z.enum(['family', 'school']);
export type AudienceType = z.infer<typeof audienceTypeSchema>;

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
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: payload.timezone }).format(new Date());
    } catch {
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
  code: 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'SERVER_ERROR';
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

export const contactBaseSchema = z.object({
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

export const createContactSchema = contactBaseSchema;
export type CreateContactPayload = z.infer<typeof createContactSchema>;

export const updateContactSchema = contactBaseSchema.partial().extend({
  version: z.coerce.number().int().min(1),
});
export type UpdateContactPayload = z.infer<typeof updateContactSchema>;

export const contactListQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  classification: audienceTypeSchema.optional(),
  lead_status: leadStatusSchema.optional(),
  source: z.string().trim().max(80).optional(),
  assigned_user_key: z.string().trim().max(160).optional(),
  sort: contactSortSchema.optional().default('updated_desc'),
  cursor: z.string().trim().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(25).optional().default(12),
});
export type ContactListQuery = z.infer<typeof contactListQuerySchema>;

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
