import { z } from 'zod';

const accessKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(180)
  .regex(/^[A-Za-z0-9_:-]+$/u);

const opaqueSourceReferenceSchema = z
  .string()
  .trim()
  .min(8)
  .max(180)
  .regex(/^[A-Za-z0-9_:-]+$/u);

export const accountAccessStateSchema = z.enum([
  'pending',
  'paused',
  'active',
  'grace',
  'scheduled_end',
  'suspended',
  'revoked',
  'manual_review',
]);
export type AccountAccessState = z.infer<typeof accountAccessStateSchema>;

export const accountAccessSourceKindSchema = z.enum([
  'free_pilot',
  'complimentary',
  'highlevel_payment_state',
  'admin_override',
  'admin_suspension',
  'legacy_preview',
]);
export type AccountAccessSourceKind = z.infer<typeof accountAccessSourceKindSchema>;

const applyCurrentAccessStateShape = {
  household_key: accessKeySchema,
  state: accountAccessStateSchema,
  effective_at: z.iso.datetime(),
  expires_at: z.iso.datetime().nullable(),
  opaque_source_reference: opaqueSourceReferenceSchema,
  source_revision: z.number().int().positive(),
  source_updated_at: z.iso.datetime(),
  policy_version: z.string().trim().min(3).max(120),
  revocation_reason: z.string().trim().min(3).max(120).nullable(),
};

function refineCurrentAccessState(
  value: z.infer<z.ZodObject<typeof applyCurrentAccessStateShape>>,
  context: z.RefinementCtx,
) {
  if (['suspended', 'revoked', 'manual_review'].includes(value.state) && !value.revocation_reason) {
    context.addIssue({
      code: 'custom',
      path: ['revocation_reason'],
      message: 'A non-access state requires a revocation reason.',
    });
  }
  if (
    ['active', 'grace', 'scheduled_end'].includes(value.state) &&
    value.expires_at &&
    new Date(value.expires_at).getTime() <= new Date(value.effective_at).getTime()
  ) {
    context.addIssue({
      code: 'custom',
      path: ['expires_at'],
      message: 'Access expiry must be later than its effective time.',
    });
  }
}

export const applyCurrentAccessStateSchema = z
  .object(applyCurrentAccessStateShape)
  .strict()
  .superRefine(refineCurrentAccessState);
export type ApplyCurrentAccessState = z.infer<typeof applyCurrentAccessStateSchema>;

const lowerSha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const highLevelVerifiedAccessStateSchema = z
  .object({
    ...applyCurrentAccessStateShape,
    event_id: opaqueSourceReferenceSchema,
    billing_episode: opaqueSourceReferenceSchema,
    verified_state: z.enum(['active', 'grace', 'inactive', 'canceled']),
    provider_customer_ref_hash: lowerSha256Schema.nullable(),
    provider_subscription_ref_hash: lowerSha256Schema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    refineCurrentAccessState(value, context);
    if (!value.provider_customer_ref_hash && !value.provider_subscription_ref_hash) {
      context.addIssue({
        code: 'custom',
        path: ['provider_customer_ref_hash'],
        message: 'A verified provider reference hash is required.',
      });
    }
    const expected = {
      active: ['active'],
      grace: ['grace'],
      inactive: ['revoked'],
      canceled: ['scheduled_end', 'revoked'],
    }[value.verified_state];
    if (!expected.includes(value.state)) {
      context.addIssue({
        code: 'custom',
        path: ['state'],
        message: 'Verified billing state does not match the requested access state.',
      });
    }
    if (value.state === 'scheduled_end' && !value.expires_at) {
      context.addIssue({
        code: 'custom',
        path: ['expires_at'],
        message: 'Scheduled-end access requires the verified period end.',
      });
    }
  });
export type HighLevelVerifiedAccessState = z.infer<typeof highLevelVerifiedAccessStateSchema>;

export const freePilotAccessGrantSchema = z
  .object({
    household_key: accessKeySchema,
    idempotency_key: z.string().trim().min(8).max(180),
    effective_at: z.iso.datetime(),
    expires_at: z.iso.datetime(),
    policy_version: z.string().trim().min(3).max(120),
    opaque_source_reference: opaqueSourceReferenceSchema,
  })
  .strict()
  .refine(
    (value) => new Date(value.expires_at).getTime() > new Date(value.effective_at).getTime(),
    {
      path: ['expires_at'],
      message: 'Free-pilot expiry must be later than its effective time.',
    },
  );
export type FreePilotAccessGrant = z.infer<typeof freePilotAccessGrantSchema>;

export const freePilotAccessRevokeSchema = z
  .object({
    household_key: accessKeySchema,
    idempotency_key: z.string().trim().min(8).max(180),
    revoked_at: z.iso.datetime(),
    reason: z.string().trim().min(3).max(120),
    policy_version: z.string().trim().min(3).max(120),
  })
  .strict();
export type FreePilotAccessRevoke = z.infer<typeof freePilotAccessRevokeSchema>;

export const accountAccessProjectionSchema = z
  .object({
    access_key: accessKeySchema,
    account_key: accessKeySchema,
    product_key: accessKeySchema,
    household_key: accessKeySchema,
    state: accountAccessStateSchema,
    source_kind: accountAccessSourceKindSchema,
    effective_at: z.iso.datetime(),
    expires_at: z.iso.datetime().nullable(),
    opaque_source_reference: opaqueSourceReferenceSchema,
    source_revision: z.number().int().positive(),
    source_updated_at: z.iso.datetime(),
    policy_version: z.string().trim().min(3).max(120),
    revocation_reason: z.string().trim().min(3).max(120).nullable(),
    access_version: z.number().int().positive(),
    grants_access: z.boolean(),
    evaluated_at: z.iso.datetime(),
  })
  .strict();
export type AccountAccessProjection = z.infer<typeof accountAccessProjectionSchema>;

export const accountAccessApplyResultSchema = z
  .object({
    state: z.enum(['applied', 'replayed']),
    projection: accountAccessProjectionSchema,
    sessions_revoked: z.number().int().nonnegative(),
    payment_history_written: z.literal(false),
  })
  .strict();
export type AccountAccessApplyResult = z.infer<typeof accountAccessApplyResultSchema>;
