import type { AppConfig } from '../../../config/src/index.ts';
import {
  providerCanaryPlanRequestSchema,
  providerCanaryPlanResponseSchema,
  providerControlCenterResponseSchema,
  type EmailReadinessCheck,
  type OpsProviderKey,
  type OpsProviderStatus,
  type ProviderCanaryPlanResponse,
  type ProviderControlCenterItem,
  type ProviderControlCenterResponse,
  type WebhookEndpointContract,
} from '../../../contracts/src/providers/control-center.ts';
import {
  inspectZoomHostControlReadiness,
  ZOOM_HOST_CONTROL_REQUIRED_VARIABLES,
} from '../live-class/zoom-host.ts';

type EnvLike = Record<string, string | undefined>;

export function buildProviderControlCenter(input: {
  config: AppConfig;
  env?: EnvLike | undefined;
  now?: Date | undefined;
}): ProviderControlCenterResponse {
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const endpoints = buildWebhookEndpoints(input.config);
  const providers = buildProviderItems(input.config, env, endpoints);
  return providerControlCenterResponseSchema.parse({
    success: true,
    generated_at: now.toISOString(),
    account_key: input.config.accountKey,
    product_key: input.config.productKey,
    owner_capability: 'provider_control_center:read',
    providers,
    webhook_endpoints: endpoints,
    email_readiness: buildEmailReadinessChecks(input.config, env),
    canary_policy: {
      real_canaries_executed_by_ops05: false,
      explicit_owner_confirmation_required: true,
      recent_email_assurance_required: true,
      idempotency_required: true,
      protected_runtime_required_for_final_conductor: true,
    },
    guardrail_proof: {
      no_provider_mutation: true,
      no_real_send: true,
      no_live_charge: true,
      no_dns_action: true,
      no_bna_edit: true,
      no_secret_values_included: true,
    },
    sources_inspected: [
      'apps/web/src/server/app.ts',
      'apps/web/src/server/features/billing/router.ts',
      'apps/web/src/server/features/support/router.ts',
      'apps/telegram-bot/src/ingress.ts',
      'apps/worker/src/delivery/provider-webhooks.ts',
      'packages/domain/src/whatsapp/service.ts',
      'packages/domain/src/billing/stripe-test-adapter.ts',
      'origin/pr/42..origin/pr/48 changed-file inventories',
    ],
  });
}

export function buildWebhookEndpoints(config?: AppConfig): WebhookEndpointContract[] {
  return [
    endpoint({
      provider: 'resend_email',
      path: '/api/v1/delivery/resend/webhook',
      method: 'POST',
      maxBytes: 128 * 1024,
      contentType: 'application/json',
      rawBody: true,
      scheme: 'svix_headers_raw_body',
      replay: ['svix_timestamp_window', 'svix_message_id_replay', 'provider_event_id_dedupe'],
      mounted: true,
      durable: true,
      asyncProcessing: true,
      note: config?.resendWebhookEnabled
        ? 'Mounted before express.json; accepts only signed raw-body Resend Svix events.'
        : 'Mounted before express.json and safely returns disabled until ONE_TIME_RESEND_WEBHOOK_ENABLED and RESEND_WEBHOOK_SECRET are configured.',
    }),
    endpoint({
      provider: 'whatsapp_meta',
      path: '/api/v1/whatsapp/meta/webhook',
      method: 'POST',
      maxBytes: 128 * 1024,
      contentType: 'application/json',
      rawBody: true,
      scheme: 'meta_x_hub_signature_256_raw_body',
      replay: ['provider_message_id_dedupe', 'account_product_scope'],
      mounted: true,
      durable: true,
      asyncProcessing: false,
      note: 'GET challenge exists only for Meta subscription verification; event intake is POST.',
    }),
    endpoint({
      provider: 'telegram_one_time',
      path: '/api/v1/telegram/one-time/webhook',
      method: 'POST',
      maxBytes: 32 * 1024,
      contentType: 'application/json',
      rawBody: true,
      scheme: 'telegram_secret_token_header',
      replay: ['telegram_update_id_inbox_dedupe', 'single_consumer_gate'],
      mounted: true,
      durable: true,
      asyncProcessing: true,
      note: 'Mounted only when ONE_TIME_TELEGRAM_WEBHOOK_ENABLED is true.',
    }),
    endpoint({
      provider: 'zoom_classroom',
      path: null,
      method: null,
      maxBytes: 128 * 1024,
      contentType: 'application/json',
      rawBody: true,
      scheme: 'zoom_webhook_signature_required_before_enablement',
      replay: ['provider_event_id_dedupe', 'meeting_scope'],
      mounted: false,
      durable: false,
      asyncProcessing: true,
      note: 'Zoom webhook route is not in this base; PR #42 introduced adjacent Zoom provider work for later integration.',
    }),
    endpoint({
      provider: 'vimeo_private_content',
      path: null,
      method: null,
      maxBytes: 128 * 1024,
      contentType: 'application/json',
      rawBody: true,
      scheme: 'vimeo_callback_verifier_required_before_enablement',
      replay: ['provider_event_id_dedupe', 'content_scope'],
      mounted: false,
      durable: false,
      asyncProcessing: true,
      note: 'No Vimeo callback endpoint is mounted in this base.',
    }),
    endpoint({
      provider: 'buffer_social',
      path: null,
      method: null,
      maxBytes: 128 * 1024,
      contentType: 'application/json',
      rawBody: true,
      scheme: 'buffer_callback_verifier_required_before_enablement',
      replay: ['provider_event_id_dedupe', 'draft_revision_scope'],
      mounted: false,
      durable: false,
      asyncProcessing: true,
      note: 'No Buffer external callback endpoint is mounted; internal social events use OT86 signing.',
    }),
    endpoint({
      provider: 'stripe_test',
      path: '/api/v1/billing/webhooks/provider',
      method: 'POST',
      maxBytes: 64 * 1024,
      contentType: 'application/json',
      rawBody: true,
      scheme: 'stripe_construct_event_raw_body_test_mode',
      replay: ['provider_event_id_dedupe', 'raw_body_digest_mismatch_guard'],
      mounted: true,
      durable: true,
      asyncProcessing: true,
      note: 'Canonical staging Stripe endpoint in this base.',
    }),
    endpoint({
      provider: 'openai_helper',
      path: null,
      method: null,
      maxBytes: null,
      contentType: null,
      rawBody: false,
      scheme: 'no_webhook_supported',
      replay: ['no_external_callback_supported'],
      mounted: false,
      durable: false,
      asyncProcessing: false,
      note: 'Helper runtime has no provider webhook endpoint in this base.',
    }),
    endpoint({
      provider: 'bna_support_bridge',
      path: '/api/internal/integrations/onetime/support-events/v1',
      method: 'POST',
      maxBytes: 128 * 1024,
      contentType: 'application/json',
      rawBody: true,
      scheme: 'ot89_hmac_canonical_request',
      replay: ['timestamp_window', 'nonce_event_id_dedupe', 'account_product_scope'],
      mounted: true,
      durable: true,
      asyncProcessing: true,
      note: 'Support status uses /api/internal/integrations/onetime/support-ticket-status/v1 with the same signer.',
    }),
  ];
}

export function buildEmailReadinessChecks(
  config: AppConfig,
  env: EnvLike = process.env,
): EmailReadinessCheck[] {
  return [
    readiness('verified_sender_or_domain', ['ONE_TIME_EMAIL_FROM', 'RESEND_DOMAIN_VERIFIED'], env),
    readiness('spf_readiness', ['RESEND_DOMAIN_SPF_READY'], env),
    readiness('dkim_readiness', ['RESEND_DOMAIN_DKIM_READY'], env),
    readiness('dmarc_policy', ['RESEND_DOMAIN_DMARC_POLICY'], env),
    readiness('return_path_bounce_handling', ['RESEND_BOUNCE_WEBHOOK_ENABLED'], env),
    readiness('reply_to_support_mailbox', ['ONE_TIME_EMAIL_REPLY_TO'], env),
    readiness('suppression_bounce_complaint_state', ['RESEND_SUPPRESSION_READBACK_READY'], env),
    readiness('lifecycle_encryption_key', ['ONE_TIME_LIFECYCLE_DELIVERY_KEY'], env, {
      readyOverride: config.lifecycleDeliveryKeyConfigured,
    }),
    readiness('exact_canary_allowlist', ['ONE_TIME_DELIVERY_TEST_CANARY_EMAIL'], env, {
      readyOverride: Boolean(config.deliveryTestCanaryEmail),
    }),
    readiness(
      'guarded_provider_flags',
      [
        'ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED',
        'ONE_TIME_RESEND_TRANSPORT_ENABLED',
        'ONE_TIME_RESEND_WEBHOOK_ENABLED',
      ],
      env,
    ),
  ];
}

export function planProviderCanary(input: {
  payload: unknown;
  actorRole: string;
  recentEmailAssuredAt?: string | undefined;
  allowlistedTargets: readonly string[];
  now?: Date | undefined;
}): ProviderCanaryPlanResponse {
  const audit = {
    owner_capability_required: true as const,
    recent_email_assurance_required: true as const,
    explicit_confirmation_required: true as const,
    allowlisted_fixture_required: true as const,
  };
  const parsed = providerCanaryPlanRequestSchema.safeParse(input.payload);
  if (!parsed.success) {
    return blocked('VALIDATION_ERROR', audit);
  }
  if (input.actorRole !== 'owner') {
    return blocked('OWNER_CAPABILITY_REQUIRED', audit);
  }
  if (!recentAssuranceOk(input.recentEmailAssuredAt, input.now ?? new Date())) {
    return blocked('RECENT_EMAIL_ASSURANCE_REQUIRED', audit);
  }
  if (!input.allowlistedTargets.includes(parsed.data.target_ref)) {
    return blocked('ALLOWLISTED_FIXTURE_TARGET_REQUIRED', audit);
  }
  return providerCanaryPlanResponseSchema.parse({
    success: true,
    plan_status: 'fixture_contract_ready',
    code: 'OPS05_FIXTURE_PLAN_READY_NO_EXTERNAL_MUTATION',
    provider: parsed.data.provider,
    external_mutation_allowed: false,
    real_provider_send_allowed: false,
    idempotency_key: parsed.data.idempotency_key,
    required_next_authority:
      'Final conductor may execute bounded canaries only with protected staging configuration.',
    audit,
  });
}

function buildProviderItems(
  config: AppConfig,
  env: EnvLike,
  endpoints: WebhookEndpointContract[],
): ProviderControlCenterItem[] {
  const endpointByProvider = new Map(endpoints.map((candidate) => [candidate.provider, candidate]));
  const zoomHostReadiness = inspectZoomHostControlReadiness(config);
  return [
    providerItem({
      provider: 'resend_email',
      label: 'Resend email',
      required: [
        'ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED',
        'ONE_TIME_RESEND_TRANSPORT_ENABLED',
        'RESEND_API_KEY',
        'RESEND_WEBHOOK_SECRET',
        'ONE_TIME_EMAIL_FROM',
        'ONE_TIME_EMAIL_REPLY_TO',
        'ONE_TIME_DELIVERY_TEST_CANARY_EMAIL',
      ],
      configured:
        config.deliveryProviderTransportEnabled &&
        config.resendTransportEnabled &&
        Boolean(config.resendApiKey),
      providerOn: config.deliveryProviderTransportEnabled && config.resendTransportEnabled,
      canaryReady: Boolean(config.deliveryTestCanaryEmail && config.resendApiKey),
      endpoint: requiredEndpoint(endpointByProvider, 'resend_email'),
      queueDependency: ['outbox_events', 'delivery_worker'],
      env,
    }),
    providerItem({
      provider: 'whatsapp_meta',
      label: 'Meta WhatsApp',
      required: [
        'ONE_TIME_WHATSAPP_PROVIDER_ACCOUNT_KEY',
        'ONE_TIME_WHATSAPP_PROVIDER_ENV',
        'ONE_TIME_WHATSAPP_STAGING_ISOLATED',
        'ONE_TIME_WHATSAPP_WEBHOOK_SECRET',
        'ONE_TIME_WHATSAPP_VERIFY_TOKEN',
        'ONETIME_CANARY_WHATSAPP_RECIPIENT_E164',
        'ONETIME_WHATSAPP_CANARY_AUTHORIZED',
      ],
      configured: Boolean(config.whatsappWebhookSecret && config.whatsappVerifyToken),
      providerOn: config.whatsappProviderEnv === 'STAGING' && config.whatsappStagingIsolated,
      canaryReady: Boolean(config.whatsappCanaryRecipientE164 && config.whatsappCanaryAuthorized),
      endpoint: requiredEndpoint(endpointByProvider, 'whatsapp_meta'),
      queueDependency: ['whatsapp_inbox_events', 'whatsapp_outbox_messages'],
      env,
    }),
    providerItem({
      provider: 'telegram_one_time',
      label: 'Telegram helper',
      required: [
        'ONE_TIME_TELEGRAM_WEBHOOK_ENABLED',
        'ONE_TIME_TELEGRAM_WEBHOOK_SECRET',
        'ONE_TIME_TELEGRAM_BOT_KEY',
        'ONE_TIME_TELEGRAM_ENVIRONMENT',
      ],
      configured: Boolean(config.oneTimeTelegramWebhookSecret),
      providerOn: config.oneTimeTelegramWebhookEnabled,
      canaryReady: Boolean(env.ONE_TIME_TELEGRAM_CANARY_CHAT_REF),
      endpoint: requiredEndpoint(endpointByProvider, 'telegram_one_time'),
      queueDependency: ['telegram_inbox'],
      env,
    }),
    providerItem({
      provider: 'zoom_classroom',
      label: 'Zoom classroom',
      required: [...ZOOM_HOST_CONTROL_REQUIRED_VARIABLES],
      configured: zoomHostReadiness.readiness_blockers.length === 0,
      providerOn: zoomHostReadiness.provider_gate_blockers.length === 0,
      canaryReady: zoomHostReadiness.ready && config.zoomClassroomCanaryEnabled,
      endpoint: requiredEndpoint(endpointByProvider, 'zoom_classroom'),
      queueDependency: ['class_occurrences', 'classroom_join_grants'],
      env,
    }),
    providerItem({
      provider: 'vimeo_private_content',
      label: 'Vimeo private content',
      required: ['VIMEO_ACCESS_TOKEN', 'VIMEO_ACCOUNT_ID', 'VIMEO_WEBHOOK_SECRET'],
      configured: Boolean(env.VIMEO_ACCESS_TOKEN && env.VIMEO_ACCOUNT_ID),
      providerOn: Boolean(env.VIMEO_PRIVATE_PROVIDER_ENABLED === 'true'),
      canaryReady: Boolean(env.OT86_ALLOW_VIMEO_CANARY_UPLOAD === '1'),
      endpoint: requiredEndpoint(endpointByProvider, 'vimeo_private_content'),
      queueDependency: ['content_items', 'content_revisions'],
      env,
    }),
    providerItem({
      provider: 'buffer_social',
      label: 'Buffer social publishing',
      required: ['BUFFER_ACCESS_TOKEN', 'BUFFER_ORGANIZATION_ID', 'BUFFER_DESTINATION_IDS'],
      configured: Boolean(config.bufferAccessToken && config.bufferOrganizationId),
      providerOn: Boolean(config.bufferAccessToken && config.bufferDestinationIds),
      canaryReady: Boolean(env.BUFFER_CANARY_DESTINATION_ALLOWLIST),
      endpoint: requiredEndpoint(endpointByProvider, 'buffer_social'),
      queueDependency: ['social_drafts', 'social_event_intake'],
      env,
    }),
    providerItem({
      provider: 'stripe_test',
      label: 'Stripe TEST billing',
      required: [
        'ENABLE_PAYMENT_TRANSPORT',
        'LIVE_STRIPE_CHARGES_AUTHORIZED',
        'ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET',
        'ONE_TIME_STRIPE_TEST_ACCOUNT_REF',
      ],
      configured: Boolean(
        env.ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET && env.ONE_TIME_STRIPE_TEST_ACCOUNT_REF,
      ),
      providerOn:
        env.ENABLE_PAYMENT_TRANSPORT === 'true' && env.LIVE_STRIPE_CHARGES_AUTHORIZED === 'NO',
      canaryReady: Boolean(env.ONE_TIME_STRIPE_TEST_CANARY_FIXTURE),
      endpoint: requiredEndpoint(endpointByProvider, 'stripe_test'),
      queueDependency: ['billing_provider_events', 'billing_event_processing_attempts'],
      env,
    }),
    providerItem({
      provider: 'openai_helper',
      label: 'OpenAI/helper runtime',
      required: ['OPENAI_API_KEY', 'ONE_TIME_HELPER_RUNTIME_ENABLED'],
      configured: Boolean(env.OPENAI_API_KEY),
      providerOn: env.ONE_TIME_HELPER_RUNTIME_ENABLED === 'true',
      canaryReady: Boolean(env.ONE_TIME_HELPER_FIXTURE_ALLOWLIST),
      endpoint: requiredEndpoint(endpointByProvider, 'openai_helper'),
      queueDependency: [],
      env,
    }),
    providerItem({
      provider: 'bna_support_bridge',
      label: 'BNA support bridge',
      required: [
        'OT89_SUPPORT_ENABLED',
        'OT89_SUPPORT_DELIVERY_MODE',
        'OT89_SUPPORT_BNA_BASE_URL',
        'OT89_SUPPORT_HMAC_KEY_ID',
        'OT89_SUPPORT_HMAC_SECRET',
        'OT89_BNA_TO_ONETIME_HMAC_KEY_ID',
        'OT89_BNA_TO_ONETIME_HMAC_SECRET',
      ],
      configured: Boolean(config.ot89SupportHmacKeyId && config.ot89SupportHmacSecret),
      providerOn: config.ot89SupportEnabled && config.ot89SupportDeliveryMode !== 'disabled',
      canaryReady: config.ot89SupportDeliveryMode === 'mock',
      endpoint: requiredEndpoint(endpointByProvider, 'bna_support_bridge'),
      queueDependency: ['support_ticket_receipts', 'support_delivery_outbox'],
      env,
    }),
  ];
}

function providerItem(input: {
  provider: OpsProviderKey;
  label: string;
  required: string[];
  configured: boolean;
  providerOn: boolean;
  canaryReady: boolean;
  endpoint: WebhookEndpointContract;
  queueDependency: string[];
  env: EnvLike;
}): ProviderControlCenterItem {
  const configuredVars = input.required.filter((name) => hasValue(input.env[name]));
  const missingVars = input.required.filter((name) => !hasValue(input.env[name]));
  return {
    provider: input.provider,
    label: input.label,
    status: providerStatus(input),
    required_variable_names: input.required,
    configured_variable_names: configuredVars,
    missing_variable_names: missingVars,
    webhook_endpoint: input.endpoint,
    last_verified_event: {
      observed_at: null,
      status: 'no_verified_event_recorded_in_ops05_fixture',
      provider_event_ref_included: false,
    },
    queue_worker_dependency: {
      required: input.queueDependency.length > 0,
      readiness:
        input.queueDependency.length === 0
          ? 'not_required'
          : input.endpoint.handler_mounted
            ? 'configured'
            : 'missing',
      dependency_names: input.queueDependency,
    },
    last_allowlisted_canary: {
      status: input.canaryReady ? 'ready' : 'not_run',
      summary: input.canaryReady
        ? 'Allowlist/config prerequisites are present; OPS-05 did not execute a real canary.'
        : 'No real canary was run by OPS-05.',
      external_mutation_performed: false,
    },
    rollback_disable_action: {
      available: true,
      action_id: `${input.provider}:disable-provider-flag`,
      mutates_provider_configuration: false,
    },
    delivery_semantics: {
      queued_locally_status: 'Local enqueue means accepted for processing only.',
      provider_accepted_status: 'Provider API/webhook acceptance is not delivery.',
      delivered_or_published_status:
        'Delivered/published requires a verified provider event or readback, never an API accept alone.',
      acceptance_is_not_delivery: true,
    },
    guardrails: [
      'do_not_log_full_body_or_secret',
      'account_product_scope_required',
      'signature_before_business_processing',
      'idempotency_or_replay_guard_required',
    ],
  };
}

function providerStatus(input: {
  configured: boolean;
  providerOn: boolean;
  canaryReady: boolean;
  endpoint: WebhookEndpointContract;
}): OpsProviderStatus {
  if (!input.configured) return 'not_configured';
  if (!input.providerOn) return 'configured_provider_off';
  if (!input.endpoint.handler_mounted) return 'degraded';
  if (input.canaryReady) return 'canary_ready';
  return 'sink_tested';
}

function endpoint(input: {
  provider: OpsProviderKey;
  path: string | null;
  method: 'POST' | 'GET' | null;
  maxBytes: number | null;
  contentType: string | null;
  rawBody: boolean;
  scheme: string;
  replay: string[];
  mounted: boolean;
  durable: boolean;
  asyncProcessing: boolean;
  note: string;
}): WebhookEndpointContract {
  return {
    provider: input.provider,
    path: input.path,
    method: input.method,
    https_required: true,
    post_only: input.method !== 'GET',
    max_bytes: input.maxBytes,
    content_type: input.contentType,
    raw_body_required: input.rawBody,
    signature_scheme: input.scheme,
    replay_or_dedupe: input.replay,
    handler_mounted: input.mounted,
    acknowledged_after_durable_enqueue: input.durable,
    business_processing_async: input.asyncProcessing,
    secret_logging_forbidden: true,
    registration_note: input.note,
  };
}

function requiredEndpoint(
  map: Map<OpsProviderKey, WebhookEndpointContract>,
  provider: OpsProviderKey,
) {
  const found = map.get(provider);
  if (!found) throw new Error(`Missing provider endpoint contract: ${provider}`);
  return found;
}

function readiness(
  check: string,
  requiredNames: string[],
  env: EnvLike,
  options: { readyOverride?: boolean | undefined } = {},
): EmailReadinessCheck {
  const ready =
    options.readyOverride !== undefined
      ? options.readyOverride
      : requiredNames.every((name) => hasValue(env[name]));
  return {
    check,
    required_variable_names: requiredNames,
    status: ready ? 'ready' : 'evidence_missing',
    evidence_value_included: false,
  };
}

function blocked(
  code: string,
  audit: ProviderCanaryPlanResponse['audit'],
): ProviderCanaryPlanResponse {
  return providerCanaryPlanResponseSchema.parse({
    success: false,
    plan_status: 'blocked',
    code,
    external_mutation_allowed: false,
    real_provider_send_allowed: false,
    required_next_authority:
      'No provider canary may run until all OPS-05 canary preconditions are satisfied.',
    audit,
  });
}

function recentAssuranceOk(value: string | undefined, now: Date) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const ageMs = Math.abs(now.getTime() - parsed.getTime());
  return ageMs <= 15 * 60 * 1000;
}

function hasValue(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}
