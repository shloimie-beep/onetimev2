import { z } from 'zod';

export const mfaVerifyPayloadSchema = z
  .object({
    pre_auth_token: z.string().trim().min(32).max(200),
    csrf_token: z.string().trim().min(16).max(240).optional(),
    totp_code: z
      .string()
      .trim()
      .regex(/^\d{6}$/)
      .optional(),
    recovery_code: z.string().trim().min(8).max(40).optional(),
    return_to: z.string().trim().max(240).optional(),
  })
  .superRefine((payload, ctx) => {
    if (!payload.totp_code && !payload.recovery_code) {
      ctx.addIssue({
        code: 'custom',
        path: ['totp_code'],
        message: 'Enter an authenticator code or recovery code.',
      });
    }
  });

export type MfaVerifyPayload = z.infer<typeof mfaVerifyPayloadSchema>;

export const mfaReauthPayloadSchema = z.object({
  password: z.string().min(8).max(256),
  totp_code: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .optional(),
  recovery_code: z.string().trim().min(8).max(40).optional(),
  csrf_token: z.string().trim().min(16).max(240).optional(),
});

export type MfaReauthPayload = z.infer<typeof mfaReauthPayloadSchema>;
