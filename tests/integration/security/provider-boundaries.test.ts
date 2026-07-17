import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import {
  buildBillingReturnPaths,
  processZoomWebhook,
  zoomWebhookSignature,
} from '../../../packages/domain/src/index.ts';
import { assertNoBrowserReturnPath } from '../../../packages/domain/src/billing/return-paths.ts';
import { withBillingNetworkGuard } from '../../../packages/domain/src/billing/network-guard.ts';

describe('W12-100-01 provider and production safety boundaries', () => {
  it('fails closed for production-only Portal Test Lab, BNA mock bridge, and real transports', () => {
    expect(() => productionConfig({ PORTAL_TEST_LAB_ENABLED: 'true' })).toThrow(
      'Portal Test Lab is forbidden in production.',
    );
    expect(() => productionConfig({ OT89_MOCK_BNA_ENABLED: 'true' })).toThrow(
      'OT89 mock BNA endpoint is forbidden in production.',
    );
    expect(() => productionConfig({ ENABLE_REAL_EMAIL_TRANSPORT: 'true' })).toThrow(
      'Real transports are outside this task and must remain disabled.',
    );
  });

  it('rejects browser-supplied billing return paths and blocks direct provider/network URLs', async () => {
    expect(buildBillingReturnPaths('https://join.onetimeonetime.com')).toEqual({
      checkoutSuccessUrl: 'https://join.onetimeonetime.com/app/billing/checkout/success',
      checkoutCancelUrl: 'https://join.onetimeonetime.com/app/billing/checkout/cancel',
      portalReturnUrl: 'https://join.onetimeonetime.com/app/parent',
    });
    expect(() => buildBillingReturnPaths('http://169.254.169.254')).toThrow(
      'Billing return path rejected.',
    );
    expect(() => buildBillingReturnPaths('https://join.onetimeonetime.com/path')).toThrow(
      'Billing return path rejected.',
    );
    expect(() => assertNoBrowserReturnPath('/app/parent')).toThrow(
      'Browser-supplied billing return paths are not accepted.',
    );

    await expect(
      withBillingNetworkGuard(() => fetch('http://169.254.169.254/latest/meta-data')),
    ).rejects.toMatchObject({
      attempts: [{ url: 'http://169.254.169.254/latest/meta-data', reason: 'fetch' }],
    });
  });

  it('verifies provider webhooks, rejects replay/stale signatures, dedupes, and redacts raw IDs', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const secretToken = 'zoom-webhook-secret-local-only';
    const rawBody = JSON.stringify({
      event: 'meeting.participant_joined',
      event_ts: now.getTime(),
      payload: {
        object: {
          id: '987654321',
          uuid: 'raw-meeting-uuid',
          occurrence_id: 'occurrence_alpha',
          participant: {
            id: 'participant-private-id',
            registrant_id: 'registrant-private-id',
            join_time: now.toISOString(),
          },
        },
      },
    });
    const signature = zoomWebhookSignature({ rawBody, timestamp, secretToken });
    const seenEventKeys = new Set<string>();

    const accepted = processZoomWebhook({
      rawBody,
      secretToken,
      seenEventKeys,
      now,
      headers: { signature, timestamp, requestId: 'zoom-request-001' },
    });
    expect(accepted).toMatchObject({ status: 202, code: 'ACCEPTED', duplicate: false });
    expect(JSON.stringify(accepted.projection)).not.toMatch(
      /987654321|raw-meeting-uuid|participant-private-id|registrant-private-id/,
    );
    expect(accepted.projection).toMatchObject({
      attendance_state: 'joined',
      occurrence_id: 'occurrence_alpha',
    });

    const duplicate = processZoomWebhook({
      rawBody,
      secretToken,
      seenEventKeys,
      now,
      headers: { signature, timestamp, requestId: 'zoom-request-001' },
    });
    expect(duplicate).toMatchObject({ status: 202, code: 'DUPLICATE', duplicate: true });

    const staleTimestamp = String(Math.floor(now.getTime() / 1000) - 3600);
    const staleSignature = zoomWebhookSignature({
      rawBody,
      timestamp: staleTimestamp,
      secretToken,
    });
    expect(
      processZoomWebhook({
        rawBody,
        secretToken,
        now,
        headers: { signature: staleSignature, timestamp: staleTimestamp },
      }),
    ).toMatchObject({ status: 403, code: 'STALE_TIMESTAMP' });

    expect(
      processZoomWebhook({
        rawBody,
        secretToken,
        now,
        headers: { signature: `${signature.slice(0, -2)}aa`, timestamp },
      }),
    ).toMatchObject({ status: 401, code: 'INVALID_SIGNATURE' });
  });
});

function productionConfig(overrides: NodeJS.ProcessEnv) {
  return loadConfig({
    NODE_ENV: 'production',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    AUTH_CSRF_SECRET: 'prod-test-auth-csrf-secret-32-bytes-min',
    MFA_SECRET_ENCRYPTION_KEY: 'prod-test-mfa-secret-32-bytes-minimum',
    ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'prod-test-lifecycle-key-32-bytes-min',
    ...overrides,
  });
}
