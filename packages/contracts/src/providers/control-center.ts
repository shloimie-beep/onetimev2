import { z } from 'zod';

export const opsProviderKeySchema = z.enum([
  'resend_email',
  'whatsapp_meta',
  'telegram_one_time',
  'zoom_classroom',
  'vimeo_private_content',
  'buffer_social',
  'stripe_test',
  'openai_helper',
  'bna_support_bridge',
]);
export type OpsProviderKey = z.infer<typeof opsProviderKeySchema>;

export const opsProviderStatusSchema = z.enum([
  'not_configured',
  'configured_provider_off',
  'sink_tested',
  'canary_ready',
  'canary_passed',
  'degraded',
  'failed',
]);
export type OpsProviderStatus = z.infer<typeof opsProviderStatusSchema>;

export const webhookEndpointContractSchema = z
  .object({
    provider: opsProviderKeySchema,
    path: z.string().startsWith('/').nullable(),
    method: z.enum(['POST', 'GET']).nullable(),
    https_required: z.literal(true),
    post_only: z.boolean(),
    max_bytes: z.number().int().positive().nullable(),
    content_type: z.string().min(1).nullable(),
    raw_body_required: z.boolean(),
    signature_scheme: z.string().min(1),
    replay_or_dedupe: z.array(z.string().min(1)).min(1),
    handler_mounted: z.boolean(),
    acknowledged_after_durable_enqueue: z.boolean(),
    business_processing_async: z.boolean(),
    secret_logging_forbidden: z.literal(true),
    registration_note: z.string().min(1),
  })
  .strict();
export type WebhookEndpointContract = z.infer<typeof webhookEndpointContractSchema>;

export const providerControlCenterItemSchema = z
  .object({
    provider: opsProviderKeySchema,
    label: z.string().min(1),
    status: opsProviderStatusSchema,
    required_variable_names: z.array(z.string().min(1)).min(1),
    configured_variable_names: z.array(z.string().min(1)),
    missing_variable_names: z.array(z.string().min(1)),
    webhook_endpoint: webhookEndpointContractSchema,
    last_verified_event: z
      .object({
        observed_at: z.string().datetime().nullable(),
        status: z.string().min(1),
        provider_event_ref_included: z.literal(false),
      })
      .strict(),
    queue_worker_dependency: z
      .object({
        required: z.boolean(),
        readiness: z.enum(['not_required', 'sink_ready', 'configured', 'missing', 'degraded']),
        dependency_names: z.array(z.string().min(1)),
      })
      .strict(),
    last_allowlisted_canary: z
      .object({
        status: z.enum(['not_run', 'blocked', 'ready', 'passed', 'failed']),
        summary: z.string().min(1),
        external_mutation_performed: z.literal(false),
      })
      .strict(),
    rollback_disable_action: z
      .object({
        available: z.literal(true),
        action_id: z.string().min(1),
        mutates_provider_configuration: z.literal(false),
      })
      .strict(),
    delivery_semantics: z
      .object({
        queued_locally_status: z.string().min(1),
        provider_accepted_status: z.string().min(1),
        delivered_or_published_status: z.string().min(1),
        acceptance_is_not_delivery: z.literal(true),
      })
      .strict(),
    guardrails: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type ProviderControlCenterItem = z.infer<typeof providerControlCenterItemSchema>;

export const emailReadinessCheckSchema = z
  .object({
    check: z.string().min(1),
    required_variable_names: z.array(z.string().min(1)).min(1),
    status: z.enum(['ready', 'evidence_missing', 'blocked']),
    evidence_value_included: z.literal(false),
  })
  .strict();
export type EmailReadinessCheck = z.infer<typeof emailReadinessCheckSchema>;

export const providerCanaryPlanRequestSchema = z
  .object({
    provider: opsProviderKeySchema,
    idempotency_key: z.string().trim().min(8).max(160),
    fixture_mode: z.literal(true),
    target_kind: z.enum(['email', 'whatsapp', 'telegram_chat', 'stripe_test', 'webhook_fixture']),
    target_ref: z.string().trim().min(3).max(180),
    explicit_confirmation: z.literal('PLAN OPS-05 FIXTURE CANARY ONLY'),
  })
  .strict();
export type ProviderCanaryPlanRequest = z.infer<typeof providerCanaryPlanRequestSchema>;

export const providerCanaryPlanResponseSchema = z
  .object({
    success: z.boolean(),
    plan_status: z.enum(['fixture_contract_ready', 'blocked']),
    code: z.string().min(1),
    provider: opsProviderKeySchema.optional(),
    external_mutation_allowed: z.literal(false),
    real_provider_send_allowed: z.literal(false),
    idempotency_key: z.string().min(8).max(160).optional(),
    required_next_authority: z.string().min(1),
    audit: z
      .object({
        owner_capability_required: z.literal(true),
        recent_email_assurance_required: z.literal(true),
        explicit_confirmation_required: z.literal(true),
        allowlisted_fixture_required: z.literal(true),
      })
      .strict(),
  })
  .strict();
export type ProviderCanaryPlanResponse = z.infer<typeof providerCanaryPlanResponseSchema>;

export const providerControlCenterResponseSchema = z
  .object({
    success: z.literal(true),
    generated_at: z.string().datetime(),
    account_key: z.string().min(1),
    product_key: z.string().min(1),
    owner_capability: z.literal('provider_control_center:read'),
    providers: z.array(providerControlCenterItemSchema).min(1),
    webhook_endpoints: z.array(webhookEndpointContractSchema).min(1),
    email_readiness: z.array(emailReadinessCheckSchema).min(1),
    canary_policy: z
      .object({
        real_canaries_executed_by_ops05: z.literal(false),
        explicit_owner_confirmation_required: z.literal(true),
        recent_email_assurance_required: z.literal(true),
        idempotency_required: z.literal(true),
        protected_runtime_required_for_final_conductor: z.literal(true),
      })
      .strict(),
    guardrail_proof: z
      .object({
        no_provider_mutation: z.literal(true),
        no_real_send: z.literal(true),
        no_live_charge: z.literal(true),
        no_dns_action: z.literal(true),
        no_bna_edit: z.literal(true),
        no_secret_values_included: z.literal(true),
      })
      .strict(),
    sources_inspected: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type ProviderControlCenterResponse = z.infer<typeof providerControlCenterResponseSchema>;
