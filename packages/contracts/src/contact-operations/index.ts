import { z } from 'zod';

const opaqueKeySchema = z.string().trim().min(3).max(180);
const idempotencyKeySchema = z.string().trim().min(8).max(180);

export const contactOperationsCapabilitySchema = z.enum([
  'contact_ops:supervise',
  'contact_ops:school_admin',
  'contact_ops:parent_self_service',
]);
export type ContactOperationsCapability = z.infer<typeof contactOperationsCapabilitySchema>;

export const contactOperationsEnrollmentSchema = z
  .object({
    idempotency_key: idempotencyKeySchema,
    adult: z
      .object({
        display_name: z.string().trim().min(2).max(180),
        email: z.string().trim().email().max(254),
        phone: z.string().trim().max(40).optional().default(''),
        classification: z.enum(['family', 'school']).default('family'),
        family_or_school: z.string().trim().min(1).max(180),
        location: z.string().trim().min(2).max(180),
        timezone: z.string().trim().min(1).max(80),
      })
      .strict(),
    household: z
      .object({
        household_key: opaqueKeySchema.optional(),
        display_name: z.string().trim().min(1).max(180),
      })
      .strict(),
    students: z
      .array(
        z
          .object({
            display_name: z.string().trim().min(1).max(160),
            hebrew_name: z.string().trim().max(160).optional(),
            grade_label: z.string().trim().max(80).optional(),
            username: z
              .string()
              .trim()
              .min(3)
              .max(24)
              .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]$/u),
          })
          .strict(),
      )
      .default([]),
    complimentary: z
      .object({
        expires_at: z.iso.datetime().nullable().default(null),
        policy_version: z.string().trim().min(3).max(120),
        opaque_source_reference: z
          .string()
          .trim()
          .min(8)
          .max(180)
          .regex(/^[A-Za-z0-9_:-]+$/u),
      })
      .strict()
      .optional(),
  })
  .strict();
export type ContactOperationsEnrollment = z.infer<typeof contactOperationsEnrollmentSchema>;

export const contactOperationsEnrollmentResultSchema = z
  .object({
    replayed: z.boolean(),
    contact_key: opaqueKeySchema,
    household_key: opaqueKeySchema,
    relationship_key: opaqueKeySchema,
    parent_activation_token_ref: opaqueKeySchema,
    student_setup_token_refs: z.array(
      z.object({
        learner_key: opaqueKeySchema,
        username: z.string().min(3).max(24),
        token_ref: opaqueKeySchema,
      }),
    ),
    access_state: z.string().min(3).max(40),
    sync_state: z.enum(['sync_pending', 'synced', 'conflict']),
    child_highlevel_operations: z.literal(0),
    plaintext_credentials_stored: z.literal(false),
    payment_history_written: z.literal(false),
  })
  .strict();
export type ContactOperationsEnrollmentResult = z.infer<
  typeof contactOperationsEnrollmentResultSchema
>;

export const contactOperationsAccessCommandSchema = z
  .object({
    idempotency_key: idempotencyKeySchema,
    expires_at: z.iso.datetime().nullable().optional(),
    policy_version: z.string().trim().min(3).max(120),
    reason: z.string().trim().min(3).max(120).optional(),
  })
  .strict();

export const contactOperationsResetCommandSchema = z
  .object({
    idempotency_key: idempotencyKeySchema,
  })
  .strict();

export const adultContactLinkSchema = z
  .object({
    contact_key: opaqueKeySchema,
    household_key: opaqueKeySchema,
    guardian_user_ref: opaqueKeySchema.nullable(),
    sync_state: z.enum(['sync_pending', 'synced', 'conflict']),
    highlevel_contact_linked: z.boolean(),
    open_in_highlevel_url: z.url().nullable(),
    projection_revision: z.number().int().positive(),
    payment_data_present: z.literal(false),
  })
  .strict();

export const contactOperationsHouseholdSchema = z
  .object({
    household_key: opaqueKeySchema,
    display_name: z.string().trim().min(1).max(180),
    adult_display_name: z.string().trim().min(1).max(180),
    access_state: z.string().trim().min(3).max(40),
    students: z.array(
      z
        .object({
          learner_key: opaqueKeySchema,
          display_name: z.string().trim().min(1).max(160),
          username: z.string().trim().min(1).max(160),
          status: z.string().trim().min(3).max(40),
        })
        .strict(),
    ),
    adult_link: adultContactLinkSchema,
  })
  .strict();
export type ContactOperationsHousehold = z.infer<typeof contactOperationsHouseholdSchema>;

export const parentAccessShellSchema = z
  .object({
    mode: z.enum(['active', 'paused']),
    display_name: z.string().trim().min(1).max(180),
    household_count: z.number().int().nonnegative(),
    primary_household_key: opaqueKeySchema,
    learning_routes_available: z.boolean(),
    identity_profile_available: z.literal(true),
    recovery_available: z.literal(true),
    support_available: z.literal(true),
  })
  .strict();
