import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import {
  providerCanaryPlanResponseSchema,
  providerControlCenterResponseSchema,
} from '../../../packages/contracts/src/providers/control-center.ts';
import {
  buildEmailReadinessChecks,
  buildProviderControlCenter,
  buildWebhookEndpoints,
  planProviderCanary,
} from '../../../packages/domain/src/providers/control-center.ts';
import { ZOOM_HOST_CONTROL_REQUIRED_VARIABLES } from '../../../packages/domain/src/live-class/zoom-host.ts';
import { fixtureWebhookSignature } from '../../../packages/domain/src/billing/fixture-adapter.ts';
import {
  OT89_EVENT_TARGET,
  createOt89SignedHeaders,
  verifyOt89Signature,
} from '../../../packages/domain/src/support/hmac.ts';
import { MetaWhatsAppCloudAdapter } from '../../../packages/domain/src/whatsapp/provider.ts';

const now = new Date('2026-07-17T05:00:00.000Z');

describe('OPS-05 provider control center projection', () => {
  it('fails closed unless every email evidence field has a truthful typed value', () => {
    const readyEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      ONE_TIME_EMAIL_FROM: 'One Time Account Security <info@onetimeonetime.com>',
      ONE_TIME_EMAIL_REPLY_TO: 'info@onetimeonetime.com',
      ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'ops05-lifecycle-delivery-key-value',
      ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: 'suppressed@resend.dev',
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_WEBHOOK_ENABLED: 'true',
      RESEND_DOMAIN_VERIFIED: 'true',
      RESEND_DOMAIN_SPF_READY: 'true',
      RESEND_DOMAIN_DKIM_READY: 'true',
      RESEND_DOMAIN_DMARC_POLICY: 'p=none',
      RESEND_BOUNCE_WEBHOOK_ENABLED: 'true',
      RESEND_SUPPRESSION_READBACK_READY: 'true',
      RESEND_WEBHOOK_SECRET: 'ops05-resend-webhook-secret',
    };

    expect(buildEmailReadinessChecks(loadConfig(readyEnv), readyEnv)).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'ready' })]),
    );
    expect(
      buildEmailReadinessChecks(loadConfig(readyEnv), readyEnv).every(
        (check) => check.status === 'ready',
      ),
    ).toBe(true);

    const booleanEvidence = [
      ['RESEND_DOMAIN_VERIFIED', 'verified_sender_or_domain'],
      ['RESEND_DOMAIN_SPF_READY', 'spf_readiness'],
      ['RESEND_DOMAIN_DKIM_READY', 'dkim_readiness'],
      ['RESEND_BOUNCE_WEBHOOK_ENABLED', 'return_path_bounce_handling'],
      ['RESEND_SUPPRESSION_READBACK_READY', 'suppression_bounce_complaint_state'],
    ] as const;
    for (const [variableName, checkName] of booleanEvidence) {
      for (const falseLikeValue of ['false', '1', 'yes', 'TRUE', 'evidence-present', ' ']) {
        const env = { ...readyEnv, [variableName]: falseLikeValue };
        expect(emailReadinessStatus(env, checkName)).toBe('evidence_missing');
      }
    }

    for (const policy of ['p=none', 'p=quarantine', 'p=reject']) {
      expect(
        emailReadinessStatus({ ...readyEnv, RESEND_DOMAIN_DMARC_POLICY: policy }, 'dmarc_policy'),
      ).toBe('ready');
    }
    for (const invalidPolicy of ['none', 'p=monitor', 'p=none; rua=mailto:test@example.test', '']) {
      expect(
        emailReadinessStatus(
          { ...readyEnv, RESEND_DOMAIN_DMARC_POLICY: invalidPolicy },
          'dmarc_policy',
        ),
      ).toBe('evidence_missing');
    }

    expect(
      emailReadinessStatus(
        { ...readyEnv, ONE_TIME_RESEND_WEBHOOK_ENABLED: 'false' },
        'guarded_provider_flags',
      ),
    ).toBe('evidence_missing');
    expect(
      emailReadinessStatus(
        { ...readyEnv, ONE_TIME_EMAIL_REPLY_TO: ' ' },
        'reply_to_support_mailbox',
      ),
    ).toBe('evidence_missing');
  });

  it('builds a provider-neutral owner matrix without secret values or site-root webhooks', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_WEBHOOK_ENABLED: 'true',
      ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: 'owner@example.test',
      RESEND_API_KEY: 'resend-secret-value-never-return',
      RESEND_WEBHOOK_SECRET: 'whsec_secret_value_never_return',
      RESEND_DOMAIN_VERIFIED: 'true',
      RESEND_DOMAIN_SPF_READY: 'true',
      RESEND_DOMAIN_DKIM_READY: 'true',
      RESEND_DOMAIN_DMARC_POLICY: 'p=quarantine',
      ONE_TIME_EMAIL_FROM: 'One Time <classes@example.test>',
      ONE_TIME_EMAIL_REPLY_TO: 'support@example.test',
      ENABLE_PAYMENT_TRANSPORT: 'true',
      LIVE_STRIPE_CHARGES_AUTHORIZED: 'NO',
      ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET: 'whsec_test_only',
      ONE_TIME_STRIPE_TEST_ACCOUNT_REF: 'acct_test_ops05',
      ONE_TIME_STRIPE_TEST_CANARY_FIXTURE: 'ops05_fixture_webhook',
    };
    const config = loadConfig(env);
    const matrix = buildProviderControlCenter({ config, env, now });
    const parsed = providerControlCenterResponseSchema.parse(matrix);

    expect(parsed.providers.map((provider) => provider.provider)).toEqual([
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
    expect(parsed.guardrail_proof).toMatchObject({
      no_provider_mutation: true,
      no_real_send: true,
      no_live_charge: true,
      no_bna_edit: true,
      no_secret_values_included: true,
    });
    expect(parsed.webhook_endpoints.every((endpoint) => endpoint.path !== '/')).toBe(true);
    expect(
      parsed.webhook_endpoints.find((endpoint) => endpoint.provider === 'stripe_test'),
    ).toMatchObject({
      path: '/api/v1/billing/webhooks/provider',
      signature_scheme: 'stripe_construct_event_raw_body_test_mode',
    });
    expect(JSON.stringify(parsed)).not.toContain('resend-secret-value-never-return');
    expect(JSON.stringify(parsed)).not.toContain('whsec_secret_value_never_return');
  });

  it('records provider-specific webhook schemes instead of a single invented HMAC', () => {
    const endpoints = buildWebhookEndpoints();
    const schemes = new Set(endpoints.map((endpoint) => endpoint.signature_scheme));

    expect(schemes.size).toBeGreaterThan(6);
    expect(endpoint('resend_email').signature_scheme).toBe('svix_headers_raw_body');
    expect(endpoint('whatsapp_meta').signature_scheme).toBe('meta_x_hub_signature_256_raw_body');
    expect(endpoint('telegram_one_time').signature_scheme).toBe('telegram_secret_token_header');
    expect(endpoint('stripe_test').signature_scheme).toBe(
      'stripe_construct_event_raw_body_test_mode',
    );
    expect(endpoint('bna_support_bridge').signature_scheme).toBe('ot89_hmac_canonical_request');
    expect(endpoint('zoom_classroom').handler_mounted).toBe(false);
    expect(endpoint('vimeo_private_content')).toMatchObject({
      path: '/api/v1/content/vimeo/webhook',
      signature_scheme: 'vimeo_payload_shared_secret_constant_time',
      handler_mounted: true,
      acknowledged_after_durable_enqueue: true,
    });
    expect(endpoint('buffer_social').handler_mounted).toBe(false);

    function endpoint(provider: ReturnType<typeof buildWebhookEndpoints>[number]['provider']) {
      const found = endpoints.find((candidate) => candidate.provider === provider);
      if (!found) throw new Error(`Missing endpoint ${provider}`);
      return found;
    }
  });

  it('reports complete canonical Zoom host-control prerequisites without values', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
      ZOOM_CLASSROOM_ENABLED: 'true',
      ZOOM_CLASSROOM_PROVIDER_MODE: 'real',
      ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'true',
      ZOOM_MEETING_SDK_CLIENT_ID: 'sdk-client-control-center-fixture',
      ZOOM_MEETING_SDK_CLIENT_SECRET: 'sdk-secret-control-center-fixture',
      ZOOM_MEETING_SDK_ALLOWED_ORIGIN: 'https://isolated-pr.example.test',
      ZOOM_MEETING_SDK_WEB_VERSION: '6.2.0',
      ZOOM_S2S_ACCOUNT_ID: 'zoom-account-control-center-fixture',
      ZOOM_S2S_CLIENT_ID: 's2s-client-control-center-fixture',
      ZOOM_S2S_CLIENT_SECRET: 's2s-secret-control-center-fixture',
      ZOOM_HOST_USER_ID: 'host-control-center-fixture',
      ZOOM_REAL_CONTROL_MEETING_ID: '987654321',
      ZOOM_REAL_CONTROL_MEETING_PASSCODE: 'meeting-passcode-control-center-fixture',
      ZOOM_CLASSROOM_CANARY_ENABLED: 'true',
      ZOOM_CLASSROOM_CANARY_LEARNER_KEY: 'full_app_preview_student_1',
      PUBLIC_BASE_URL: 'https://isolated-pr.example.test',
    };
    const matrix = buildProviderControlCenter({ config: loadConfig(env), env, now });
    const zoom = matrix.providers.find((provider) => provider.provider === 'zoom_classroom');
    if (!zoom) throw new Error('Zoom provider readiness missing.');

    expect(zoom.required_variable_names).toEqual([...ZOOM_HOST_CONTROL_REQUIRED_VARIABLES]);
    expect(zoom.configured_variable_names).toEqual([...ZOOM_HOST_CONTROL_REQUIRED_VARIABLES]);
    expect(zoom.missing_variable_names).toEqual([]);
    expect(zoom.status).toBe('degraded');
    expect(zoom.required_variable_names).not.toContain('ZOOM_MEETING_SDK_KEY');
    expect(zoom.required_variable_names).not.toContain('ZOOM_MEETING_SDK_SECRET');
    expect(JSON.stringify(zoom)).not.toContain('sdk-secret-control-center-fixture');
    expect(JSON.stringify(zoom)).not.toContain('s2s-secret-control-center-fixture');
    expect(JSON.stringify(zoom)).not.toContain('meeting-passcode-control-center-fixture');
  });

  it('keeps legacy SDK aliases visible only as aliases, never real readiness', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
      ZOOM_CLASSROOM_ENABLED: 'true',
      ZOOM_CLASSROOM_PROVIDER_MODE: 'real',
      ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'true',
      ZOOM_MEETING_SDK_KEY: 'legacy-sdk-key-fixture',
      ZOOM_MEETING_SDK_SECRET: 'legacy-sdk-secret-fixture',
      ZOOM_MEETING_SDK_ALLOWED_ORIGIN: 'https://isolated-pr.example.test',
      ZOOM_MEETING_SDK_WEB_VERSION: '6.2.0',
      ZOOM_S2S_ACCOUNT_ID: 'zoom-account-fixture',
      ZOOM_S2S_CLIENT_ID: 's2s-client-fixture',
      ZOOM_S2S_CLIENT_SECRET: 's2s-secret-fixture',
      ZOOM_HOST_USER_ID: 'host-fixture',
      ZOOM_REAL_CONTROL_MEETING_ID: '987654321',
      ZOOM_REAL_CONTROL_MEETING_PASSCODE: 'meeting-passcode-fixture',
      ZOOM_CLASSROOM_CANARY_ENABLED: 'true',
      ZOOM_CLASSROOM_CANARY_LEARNER_KEY: 'full_app_preview_student_1',
      PUBLIC_BASE_URL: 'https://isolated-pr.example.test',
    };
    const zoom = buildProviderControlCenter({ config: loadConfig(env), env, now }).providers.find(
      (provider) => provider.provider === 'zoom_classroom',
    );

    expect(zoom).toMatchObject({
      status: 'not_configured',
      missing_variable_names: expect.arrayContaining([
        'ZOOM_MEETING_SDK_CLIENT_ID',
        'ZOOM_MEETING_SDK_CLIENT_SECRET',
      ]),
    });
  });

  it('keeps provider-specific fixtures distinct for Stripe, Meta, Telegram, and BNA support', () => {
    const rawBody = Buffer.from(JSON.stringify({ id: 'evt_fixture', type: 'fixture' }));
    const stripeHeader = fixtureWebhookSignature({
      rawBody,
      timestamp: Math.floor(now.getTime() / 1000),
    });
    expect(stripeHeader).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);

    const metaSecret = 'meta-webhook-secret-fixture';
    const metaHeader = `sha256=${createHmac('sha256', metaSecret).update(rawBody).digest('hex')}`;
    expect(
      new MetaWhatsAppCloudAdapter().verifyWebhook({
        rawBody,
        signatureHeader: metaHeader,
        secret: metaSecret,
      }),
    ).toBe(true);
    expect(
      new MetaWhatsAppCloudAdapter().verifyWebhook({
        rawBody,
        signatureHeader: metaHeader,
        secret: 'wrong-meta-secret',
      }),
    ).toBe(false);

    const bnaHeaders = createOt89SignedHeaders({
      keyId: 'ot89-key',
      secret: 'ot89-hmac-secret-fixture',
      method: 'POST',
      requestTarget: OT89_EVENT_TARGET,
      rawBody,
      eventId: 'evt_ot89_fixture',
      now,
      nonce: 'abcdefghijklmnopqrstuvwxyzABCDEF',
    });
    expect(
      verifyOt89Signature({
        expectedKeyId: 'ot89-key',
        secret: 'ot89-hmac-secret-fixture',
        method: 'POST',
        requestTarget: OT89_EVENT_TARGET,
        rawBody,
        headers: {
          keyId: bnaHeaders['X-OT89-Key-Id'],
          timestamp: bnaHeaders['X-OT89-Timestamp'],
          nonce: bnaHeaders['X-OT89-Nonce'],
          signature: bnaHeaders['X-OT89-Signature'],
          eventId: bnaHeaders['X-OT89-Event-Id'],
        },
        now,
      }).ok,
    ).toBe(true);
    expect(
      buildWebhookEndpoints().find((endpoint) => endpoint.provider === 'telegram_one_time'),
    ).toMatchObject({
      signature_scheme: 'telegram_secret_token_header',
      replay_or_dedupe: expect.arrayContaining(['telegram_update_id_inbox_dedupe']),
    });
  });

  it('requires owner capability, recent email assurance, fixture mode, and allowlisted targets', () => {
    const payload = {
      provider: 'resend_email',
      idempotency_key: 'ops05-canary-plan',
      fixture_mode: true,
      target_kind: 'email',
      target_ref: 'owner@example.test',
      explicit_confirmation: 'PLAN OPS-05 FIXTURE CANARY ONLY',
    };

    expect(
      providerCanaryPlanResponseSchema.parse(
        planProviderCanary({
          payload,
          actorRole: 'admin',
          recentEmailAssuredAt: now.toISOString(),
          allowlistedTargets: ['owner@example.test'],
          now,
        }),
      ),
    ).toMatchObject({ success: false, code: 'OWNER_CAPABILITY_REQUIRED' });
    expect(
      planProviderCanary({
        payload,
        actorRole: 'owner',
        recentEmailAssuredAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        allowlistedTargets: ['owner@example.test'],
        now,
      }),
    ).toMatchObject({ success: false, code: 'RECENT_EMAIL_ASSURANCE_REQUIRED' });
    expect(
      planProviderCanary({
        payload,
        actorRole: 'owner',
        recentEmailAssuredAt: now.toISOString(),
        allowlistedTargets: ['other@example.test'],
        now,
      }),
    ).toMatchObject({ success: false, code: 'ALLOWLISTED_FIXTURE_TARGET_REQUIRED' });
    expect(
      planProviderCanary({
        payload,
        actorRole: 'owner',
        recentEmailAssuredAt: now.toISOString(),
        allowlistedTargets: ['owner@example.test'],
        now,
      }),
    ).toMatchObject({
      success: true,
      plan_status: 'fixture_contract_ready',
      external_mutation_allowed: false,
      real_provider_send_allowed: false,
    });
  });
});

function emailReadinessStatus(env: NodeJS.ProcessEnv, checkName: string) {
  const check = buildEmailReadinessChecks(loadConfig(env), env).find(
    (candidate) => candidate.check === checkName,
  );
  if (!check) throw new Error(`Missing email readiness check: ${checkName}`);
  return check.status;
}
