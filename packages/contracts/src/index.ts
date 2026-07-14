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
    const needsPhone = payload.reminder_preference === 'whatsapp' || payload.reminder_preference === 'both';
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
