import { z } from 'zod';
import { accountAccessSourceKindSchema, accountAccessStateSchema } from '../access/index.ts';

export const ownerDashboardRoleSchema = z.enum([
  'owner',
  'admin',
  'crm_agent',
  'viewer',
  'parent',
  'student',
]);

export const ownerDashboardSectionStateSchema = z.enum([
  'ready',
  'processing',
  'action_needed',
  'not_connected',
  'no_data_yet',
  'temporarily_unavailable',
]);
export type OwnerDashboardSectionState = z.infer<typeof ownerDashboardSectionStateSchema>;

export const ownerDashboardSectionDiagnosticsSchema = z.object({
  source: z.string().min(1).max(120),
  state_code: z.string().min(1).max(120),
  detail: z.string().min(1).max(220),
  checked_at: z.string().nullable(),
});
export type OwnerDashboardSectionDiagnostics = z.infer<
  typeof ownerDashboardSectionDiagnosticsSchema
>;

export const ownerDashboardSectionSchema = z.object({
  id: z.enum([
    'new_leads',
    'next_class',
    'communications_delivery',
    'content_review',
    'portal_account_setup',
    'billing_readiness',
    'support',
  ]),
  label: z.string().min(1).max(80),
  state: ownerDashboardSectionStateSchema,
  value: z.number().int().min(0).nullable(),
  value_label: z.string().min(1).max(120),
  detail: z.string().min(1).max(260),
  next_action: z.string().min(1).max(160).nullable(),
  trend_label: z.string().min(1).max(120).nullable(),
  href: z.string().min(1).nullable(),
  capability: z.string().min(1).max(80),
  updated_at: z.string().nullable(),
  diagnostics: ownerDashboardSectionDiagnosticsSchema,
});
export type OwnerDashboardSection = z.infer<typeof ownerDashboardSectionSchema>;

export const ownerDashboardHouseholdAccessSchema = z.object({
  household_key: z.string().min(1).max(180),
  household_label: z.string().min(1).max(180),
  household_status: z.enum(['active', 'archived']),
  state: accountAccessStateSchema,
  source_kind: accountAccessSourceKindSchema.nullable(),
  source_label: z.string().min(1).max(80),
  grants_access: z.boolean(),
  effective_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  review_or_revocation_reason: z.string().min(1).max(180).nullable(),
  updated_at: z.string().nullable(),
});
export type OwnerDashboardHouseholdAccess = z.infer<typeof ownerDashboardHouseholdAccessSchema>;

export const visibleActionSchema = z.object({
  action_id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  surface: z.enum(['route', 'button', 'form']),
  route: z.string().min(1),
  roles: z.array(ownerDashboardRoleSchema).min(1),
  capability: z.string().min(1).max(80),
  handler: z.object({
    method: z.enum(['GET', 'POST', 'PATCH']),
    path: z.string().min(1),
  }),
  idempotency: z.object({
    required: z.boolean(),
    key_source: z.string().min(1).max(120).nullable(),
  }),
  audit: z.object({
    mode: z.enum(['session', 'domain_audit', 'local_read', 'none']),
    event: z.string().min(1).max(120),
  }),
  states: z.object({
    loading: z.string().min(1).max(120),
    success: z.string().min(1).max(120),
    error: z.string().min(1).max(120),
    permission: z.string().min(1).max(120),
    offline: z.string().min(1).max(120),
  }),
});
export type VisibleAction = z.infer<typeof visibleActionSchema>;

export const ownerDashboardSchema = z.object({
  generated_at: z.string(),
  account_key: z.string().min(1),
  product_key: z.string().min(1),
  actor: z.object({
    user_key: z.string().min(1),
    role: ownerDashboardRoleSchema,
    display_name: z.string().min(1),
  }),
  sections: z.array(ownerDashboardSectionSchema),
  household_access: z.array(ownerDashboardHouseholdAccessSchema),
});
export type OwnerDashboard = z.infer<typeof ownerDashboardSchema>;

export const ownerDashboardResponseSchema = z.object({
  success: z.literal(true),
  dashboard: ownerDashboardSchema,
  actions: z.array(visibleActionSchema),
});
export type OwnerDashboardResponse = z.infer<typeof ownerDashboardResponseSchema>;
