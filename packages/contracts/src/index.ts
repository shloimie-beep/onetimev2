import { z } from 'zod';

export * from './classes/index.ts';
export * from './classroom/index.ts';
export * from './classroom/embedded/index.ts';
export * from './live-class/index.ts';
export * from './content/index.ts';
export * from './social/index.ts';
export * from './accounts/index.ts';
export * from './gamification/index.ts';
export * from './portals/index.ts';
export * from './learning/index.ts';
export * from './signup/school/index.ts';
export * from './dashboard/index.ts';
export * from './billing/index.ts';
export * from './access/index.ts';
export * from './action-gateway/events.ts';
export * from './support/index.ts';
export * from './whatsapp/index.ts';
export * from './ops/index.ts';
export * from './events/index.ts';
export * from './experience-preview/index.ts';
export * from './highlevel/index.ts';
export * from './contact-operations/index.ts';
export * from './telegram/rabbi-communications.ts';

export const reminderPreferenceSchema = z.enum(['email', 'whatsapp', 'both', 'none']);
export type ReminderPreference = z.infer<typeof reminderPreferenceSchema>;

export const audienceTypeSchema = z.enum(['family', 'school']);
export type AudienceType = z.infer<typeof audienceTypeSchema>;

export const leadConsentChannelSchema = z.enum(['email', 'whatsapp']);
export type LeadConsentChannel = z.infer<typeof leadConsentChannelSchema>;

export const leadConsentPurposeSchema = z.enum([
  'required_service_communication',
  'optional_class_reminders',
]);
export type LeadConsentPurpose = z.infer<typeof leadConsentPurposeSchema>;

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
    consent_context: z
      .object({
        policy_version: z.string().trim().min(1).max(120),
        purpose: leadConsentPurposeSchema.default('optional_class_reminders'),
        source: z.literal('public_signup').default('public_signup'),
        channels: z.array(leadConsentChannelSchema).max(2).default([]),
        captured_at: z.iso.datetime().optional(),
        withdrawal_state: z.enum(['not_withdrawn', 'withdrawn']).default('not_withdrawn'),
        suppression_state: z.string().trim().min(1).max(40).default('active'),
      })
      .optional(),
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
        message: 'Choose and confirm each optional reminder channel you want to receive.',
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

export const userRoleSchema = z.enum([
  'owner',
  'admin',
  'rabbi',
  'crm_agent',
  'viewer',
  'parent',
  'student',
]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const roleDisplayLabel: Record<UserRole, string> = {
  owner: 'Administrator',
  admin: 'Administrator',
  rabbi: 'Rabbi',
  crm_agent: 'CRM Agent',
  viewer: 'Viewer',
  parent: 'Parent',
  student: 'Student',
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

const loginIdentifierSchema = z.string().trim().min(3).max(254);

export const loginPayloadSchema = z
  .object({
    identifier: loginIdentifierSchema.optional(),
    email: loginIdentifierSchema.optional(),
    password: z.string().min(8).max(256),
    csrf_token: z.string().trim().min(16).max(160).optional(),
    return_to: z.string().trim().max(240).optional(),
  })
  .superRefine((payload, ctx) => {
    if (!payload.identifier && !payload.email) {
      ctx.addIssue({
        code: 'custom',
        path: ['identifier'],
        message: 'Enter your email or student username.',
      });
    }
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
  tags: ContactTag[];
  system_facts: ContactSystemFact[];
  last_activity_at: string;
  updated_at: string;
  version: number;
};

export type ContactTag = {
  tag_id: string;
  display_name: string;
  visual_token: string | null;
};

export type ContactSystemFact = {
  dimension: string;
  value: string;
  label: string;
  source: string;
};

export type ContactNote = {
  note_id: string;
  body: string;
  author_label: string;
  source: string;
  created_at: string;
};

export type ContactRelationship = {
  relationship_id: string;
  contact_id: string;
  display_name: string;
  type: string;
  label: string | null;
};

export type ContactTask = {
  task_id: string;
  title: string;
  detail: string | null;
  status: string;
  owner_label: string;
  due_at: string;
};

export type ContactSupportTicket = {
  receipt_id: string;
  status: string;
  delivery_state: string;
  public_summary: string;
  updated_at: string;
};

export type ContactTimelineItem = {
  timeline_id: string;
  occurred_at: string;
  kind: 'communication' | 'note' | 'support' | 'audit' | 'task';
  label: string;
  status_label: string;
  channel: string | null;
  detail: string;
};

export type ContactSummaryFact = {
  label: string;
  value: string;
};

const contactTagSchema = z.object({
  tag_id: z.string().min(1),
  display_name: z.string().min(1),
  visual_token: z.string().nullable(),
}) satisfies z.ZodType<ContactTag>;

const contactSystemFactSchema = z.object({
  dimension: z.string().min(1),
  value: z.string().min(1),
  label: z.string().min(1),
  source: z.string().min(1),
}) satisfies z.ZodType<ContactSystemFact>;

const contactNoteSchema = z.object({
  note_id: z.string().min(1),
  body: z.string().min(1),
  author_label: z.string().min(1),
  source: z.string().min(1),
  created_at: z.string(),
}) satisfies z.ZodType<ContactNote>;

const contactRelationshipSchema = z.object({
  relationship_id: z.string().min(1),
  contact_id: z.string().min(1),
  display_name: z.string().min(1),
  type: z.string().min(1),
  label: z.string().nullable(),
}) satisfies z.ZodType<ContactRelationship>;

const contactTaskSchema = z.object({
  task_id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().nullable(),
  status: z.string().min(1),
  owner_label: z.string().min(1),
  due_at: z.string(),
}) satisfies z.ZodType<ContactTask>;

const contactSupportTicketSchema = z.object({
  receipt_id: z.string().min(1),
  status: z.string().min(1),
  delivery_state: z.string().min(1),
  public_summary: z.string().min(1),
  updated_at: z.string(),
}) satisfies z.ZodType<ContactSupportTicket>;

const contactTimelineItemSchema = z.object({
  timeline_id: z.string().min(1),
  occurred_at: z.string(),
  kind: z.enum(['communication', 'note', 'support', 'audit', 'task']),
  label: z.string().min(1),
  status_label: z.string().min(1),
  channel: z.string().nullable(),
  detail: z.string(),
}) satisfies z.ZodType<ContactTimelineItem>;

const contactSummaryFactSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
}) satisfies z.ZodType<ContactSummaryFact>;

export const contactListItemSchema = z.object({
  contact_id: z.string().min(1),
  display_name: z.string().min(1),
  family_school_classification: audienceTypeSchema,
  lead_status: leadStatusSchema,
  email: z.string().nullable(),
  phone: z.string().nullable(),
  source: z.string(),
  assigned_team_member: z.string().nullable(),
  tags: z.array(contactTagSchema),
  system_facts: z.array(contactSystemFactSchema),
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
  enrollment_summary: ContactSummaryFact[];
  managed_household: {
    household_key: string;
    display_name: string;
  } | null;
  relationships: ContactRelationship[];
  notes: ContactNote[];
  tasks: ContactTask[];
  support_tickets: ContactSupportTicket[];
  timeline: ContactTimelineItem[];
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
  enrollment_summary: z.array(contactSummaryFactSchema),
  managed_household: z
    .object({
      household_key: z.string().min(3).max(180),
      display_name: z.string().min(1).max(180),
    })
    .nullable(),
  relationships: z.array(contactRelationshipSchema),
  notes: z.array(contactNoteSchema),
  tasks: z.array(contactTaskSchema),
  support_tickets: z.array(contactSupportTicketSchema),
  timeline: z.array(contactTimelineItemSchema),
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
