import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const tishaBavRegistrationPayloadSchema = z.object({
  email: z.string().trim().email().max(254),
  first_name: optionalTrimmed(80),
  newsletter_opt_in: z.literal(false).optional().default(false),
  source: z.string().trim().min(1).max(120).optional().default('tisha_bav_2026_landing'),
  idempotency_key: z.string().trim().min(8).max(160),
  homepage: z.string().trim().max(240).optional().default(''),
});
export type TishaBavRegistrationPayload = z.infer<typeof tishaBavRegistrationPayloadSchema>;

export const tishaBavJoinPayloadSchema = z.object({
  email: z.string().trim().email().max(254),
  idempotency_key: z.string().trim().min(8).max(160),
  homepage: z.string().trim().max(240).optional().default(''),
});
export type TishaBavJoinPayload = z.infer<typeof tishaBavJoinPayloadSchema>;

export type TishaBavRegistrationSuccessResponse = {
  success: true;
  duplicate_submission: boolean;
  event_code: 'tisha-bav-2026';
  registration_key: string | null;
  confirmation_queued: boolean;
  ghl_sync_status: 'pending' | 'provider_off' | 'succeeded' | 'skipped';
  message: {
    heading: 'Thank you — your spot has been reserved.';
    body:
      | 'The link was sent to your email.'
      | 'We could not complete that registration. Please try again.';
    schedule: 'Thursday, July 23\n3:00 PM Eastern / 10:00 PM Israel';
  };
};

export type TishaBavJoinSuccessResponse = {
  success: true;
  event_code: 'tisha-bav-2026';
  redirect_path: '/api/v1/events/tisha-bav-2026/redirect';
  expires_at: string;
};
