import { describe, expect, it } from 'vitest';
import {
  ZOOM_ISOLATED_CANARY_AGENDA,
  createZoomProtectedTargetInspectionClient,
  zoomIsolatedCanaryTopic,
  type ZoomFetch,
} from '../../../packages/domain/src/providers/zoom-rest.ts';
import {
  PROTECTED_CLASS_TARGET_ROTATION_BLOCKED,
  ZOOM_PROTECTED_TARGET_INSPECTION_AUTHORIZATION,
  buildZoomProtectedTargetInspectionPlan,
  buildZoomProtectedTargetInspectionResult,
  meetingIdFromProtectedZoomUrl,
} from '../../../scripts/zoom-protected-target-inspection-plan.ts';

const protectedMeetingId = '98765432101';
const protectedHostId = 'protected-host-reference';
const protectedPasscode = 'protected-passcode-query-value';
const protectedTopic = zoomIsolatedCanaryTopic(new Date('2026-07-23T14:45:00.000Z'));

describe('Zoom protected-target read-only inspection', () => {
  it('classifies only an exact repository-created isolated canary as safe to revoke', async () => {
    const fake = fakeZoomInspection();
    const client = createZoomProtectedTargetInspectionClient(fake.options);
    const inspection = await client.inspectMeetingScope({
      meetingId: protectedMeetingId,
      expectedHostUserId: protectedHostId,
    });

    expect(inspection).toEqual({
      type_is_single_meeting: true,
      host_matches_expected: true,
      topic_matches_repository_canary: true,
      agenda_matches_repository_canary: true,
      registrant_confirmation_email_disabled: true,
      registrant_email_notification_disabled: true,
      join_before_host_disabled: true,
      safe_to_revoke: true,
    });
    expect(Object.keys(client)).toEqual(['inspectMeetingScope']);
    expect(client).not.toHaveProperty('createIsolatedTestMeeting');
    expect(client).not.toHaveProperty('deleteMeeting');
    expect(
      fake.requests.filter((request) => request.resource).map((request) => request.method),
    ).toEqual(['GET']);
  });

  it.each([
    ['Tisha event', { topic: 'Tisha B’Av registered-attendee class' }],
    ['customer meeting', { agenda: 'Customer class meeting with invited families.' }],
    ['recurring meeting', { type: 8 }],
    ['different host', { host_id: 'another-host-reference' }],
  ])('blocks a %s without returning protected provider values', async (_label, override) => {
    const fake = fakeZoomInspection(override);
    const client = createZoomProtectedTargetInspectionClient(fake.options);
    const inspection = await client.inspectMeetingScope({
      meetingId: protectedMeetingId,
      expectedHostUserId: protectedHostId,
    });
    const result = buildZoomProtectedTargetInspectionResult({
      inspection,
      canonicalS2sAccountUsed: true,
      legacyS2sAccountAliasUsed: false,
      requestCounts: { oauthTokenRequests: 1, meetingResourceGetRequests: 1 },
    });
    const stdout = JSON.stringify(result);

    expect(inspection.safe_to_revoke).toBe(false);
    expect(result.status).toBe('BLOCKED');
    expect(result.blocker).toBe(PROTECTED_CLASS_TARGET_ROTATION_BLOCKED);
    expect(result.counts).toEqual({
      oauth_token_requests: 1,
      meeting_resource_get_requests: 1,
      resource_mutation_requests: 0,
    });
    expect(stdout).not.toContain(protectedMeetingId);
    expect(stdout).not.toContain(protectedHostId);
    expect(stdout).not.toContain(protectedTopic);
    expect(stdout).not.toContain(ZOOM_ISOLATED_CANARY_AGENDA);
    expect(stdout).not.toContain(protectedPasscode);
    expect(stdout).not.toContain('protected-access-token');
  });

  it('sanitizes malformed meeting readback errors', async () => {
    const fake = fakeZoomInspection({ host_id: undefined });
    const client = createZoomProtectedTargetInspectionClient(fake.options);

    await expect(
      client.inspectMeetingScope({
        meetingId: protectedMeetingId,
        expectedHostUserId: protectedHostId,
      }),
    ).rejects.toMatchObject({
      code: 'ZOOM_PROTECTED_TARGET_READBACK_INVALID',
      message: 'Zoom protected-target readback was incomplete.',
    });
    await expect(
      client.inspectMeetingScope({
        meetingId: protectedMeetingId,
        expectedHostUserId: protectedHostId,
      }),
    ).rejects.not.toThrow(protectedMeetingId);
  });

  it('clamps arbitrary provider codes and messages at the inspection boundary', async () => {
    const protectedProviderMessage = `provider-body-${protectedMeetingId}-${protectedPasscode}`;
    const fake = fakeZoomInspection(
      {},
      {
        status: 404,
        body: {
          code: protectedMeetingId,
          message: protectedProviderMessage,
        },
      },
    );
    const client = createZoomProtectedTargetInspectionClient(fake.options);
    let serializedError = '';

    try {
      await client.inspectMeetingScope({
        meetingId: protectedMeetingId,
        expectedHostUserId: protectedHostId,
      });
    } catch (error) {
      serializedError = JSON.stringify(error, Object.getOwnPropertyNames(error));
      expect(error).toMatchObject({
        code: 'ZOOM_PROTECTED_TARGET_GET_FAILED',
        message: 'Zoom protected-target readback failed.',
      });
    }

    expect(serializedError).not.toContain(protectedMeetingId);
    expect(serializedError).not.toContain(protectedPasscode);
    expect(serializedError).not.toContain(protectedProviderMessage);
  });

  it('clamps arbitrary OAuth provider codes and messages before meeting GET', async () => {
    const protectedProviderMessage = `oauth-body-${protectedMeetingId}-${protectedPasscode}`;
    const fake = fakeZoomInspection(
      {},
      {
        phase: 'oauth',
        status: 401,
        body: {
          code: protectedMeetingId,
          message: protectedProviderMessage,
        },
      },
    );
    const client = createZoomProtectedTargetInspectionClient(fake.options);
    let serializedError = '';

    try {
      await client.inspectMeetingScope({
        meetingId: protectedMeetingId,
        expectedHostUserId: protectedHostId,
      });
    } catch (error) {
      serializedError = JSON.stringify(error, Object.getOwnPropertyNames(error));
      expect(error).toMatchObject({
        code: 'ZOOM_PROTECTED_TARGET_OAUTH_FAILED',
        message: 'Zoom protected-target authorization failed.',
      });
    }

    expect(serializedError).not.toContain(protectedMeetingId);
    expect(serializedError).not.toContain(protectedPasscode);
    expect(serializedError).not.toContain(protectedProviderMessage);
    expect(fake.requests.filter((request) => request.resource)).toHaveLength(0);
  });

  it.each([
    'One Time isolated control verification 2026-02-30T14:45Z',
    'One Time isolated control verification 2026-07-23T24:00Z',
    'One Time isolated control verification 2026-13-23T14:45Z',
    'One Time isolated control verification 2026-07-23T14:45',
  ])('rejects an impossible or noncanonical UTC topic minute: %s', async (topic) => {
    const fake = fakeZoomInspection({ topic });
    const client = createZoomProtectedTargetInspectionClient(fake.options);
    const inspection = await client.inspectMeetingScope({
      meetingId: protectedMeetingId,
      expectedHostUserId: protectedHostId,
    });

    expect(inspection).toMatchObject({
      topic_matches_repository_canary: false,
      safe_to_revoke: false,
    });
  });
});

describe('Zoom protected-target inspection plan', () => {
  it('parses the protected URL only in memory and prefers the canonical S2S account', () => {
    const plan = buildZoomProtectedTargetInspectionPlan(authorizedEnvironment());

    expect(plan.meetingId).toBe(protectedMeetingId);
    expect(plan.canonicalS2sAccountUsed).toBe(true);
    expect(plan.legacyS2sAccountAliasUsed).toBe(false);
    expect(plan.credentials.accountId).toBe('canonical-account-reference');
    const result = buildZoomProtectedTargetInspectionResult({
      inspection: {
        type_is_single_meeting: true,
        host_matches_expected: true,
        topic_matches_repository_canary: true,
        agenda_matches_repository_canary: true,
        registrant_confirmation_email_disabled: true,
        registrant_email_notification_disabled: true,
        join_before_host_disabled: true,
        safe_to_revoke: true,
      },
      canonicalS2sAccountUsed: plan.canonicalS2sAccountUsed,
      legacyS2sAccountAliasUsed: plan.legacyS2sAccountAliasUsed,
      requestCounts: { oauthTokenRequests: 1, meetingResourceGetRequests: 1 },
    });
    const stdout = JSON.stringify(result);
    expect(stdout).not.toContain(protectedMeetingId);
    expect(stdout).not.toContain(protectedPasscode);
    expect(stdout).not.toContain(plan.expectedHostUserId);
    expect(stdout).not.toContain(plan.credentials.accountId);
    expect(stdout).not.toContain(plan.credentials.clientId);
    expect(stdout).not.toContain(plan.credentials.clientSecret);
  });

  it('permits the temporary S2S account alias only when the canonical account is absent', () => {
    const environment = authorizedEnvironment();
    delete environment.ZOOM_S2S_ACCOUNT_ID;
    const plan = buildZoomProtectedTargetInspectionPlan(environment);

    expect(plan.canonicalS2sAccountUsed).toBe(false);
    expect(plan.legacyS2sAccountAliasUsed).toBe(true);
    expect(plan.credentials.accountId).toBe('legacy-account-reference');
  });

  it('cannot report safe when any boolean classification disagrees', () => {
    const result = buildZoomProtectedTargetInspectionResult({
      inspection: {
        type_is_single_meeting: false,
        host_matches_expected: true,
        topic_matches_repository_canary: true,
        agenda_matches_repository_canary: true,
        registrant_confirmation_email_disabled: true,
        registrant_email_notification_disabled: true,
        join_before_host_disabled: true,
        safe_to_revoke: true,
      },
      canonicalS2sAccountUsed: true,
      legacyS2sAccountAliasUsed: false,
      requestCounts: { oauthTokenRequests: 1, meetingResourceGetRequests: 1 },
    });

    expect(result).toMatchObject({
      status: 'BLOCKED',
      blocker: PROTECTED_CLASS_TARGET_ROTATION_BLOCKED,
      classifications: { safe_to_revoke: false },
    });
  });

  it.each([
    ['ONE_TIME_RUNTIME_ENVIRONMENT', 'isolated_staging'],
    ['ZOOM_CLASSROOM_PROVIDER_MODE', 'sink'],
    ['ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED', 'false'],
    ['ZOOM_CLASSROOM_CANARY_ENABLED', 'false'],
    [
      'ZOOM_PROTECTED_TARGET_INSPECTION_AUTHORIZATION',
      ZOOM_PROTECTED_TARGET_INSPECTION_AUTHORIZATION,
    ],
    [
      'ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL',
      'https://events.zoom.us/j/12345678909?pwd=event-only',
    ],
  ])('requires the exact %s preflight gate', (key, expectedValue) => {
    const environment = authorizedEnvironment();
    expect(environment[key]).toBe(expectedValue);
    delete environment[key];

    expect(() => buildZoomProtectedTargetInspectionPlan(environment)).toThrow(
      `ZOOM_PROTECTED_TARGET_INSPECTION_PREFLIGHT_FAILED:${key}`,
    );
  });

  it.each([
    'https://example.test/j/98765432101',
    'https://zoom.us/webinar/98765432101',
    'https://zoom.us/j/not-a-meeting',
    'http://zoom.us/j/98765432101',
    'not-a-url',
  ])('rejects noncanonical protected target syntax without reflecting it', (value) => {
    expect(() => meetingIdFromProtectedZoomUrl(value)).toThrow(
      'ZOOM_PROTECTED_TARGET_INSPECTION_PREFLIGHT_FAILED:PROTECTED_TARGET_URL',
    );
    try {
      meetingIdFromProtectedZoomUrl(value);
    } catch (error) {
      expect(String(error)).not.toContain(value);
    }
  });
});

function authorizedEnvironment(): NodeJS.ProcessEnv {
  return {
    ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
    ZOOM_CLASSROOM_PROVIDER_MODE: 'sink',
    ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'false',
    ZOOM_CLASSROOM_CANARY_ENABLED: 'false',
    ZOOM_PROTECTED_TARGET_INSPECTION_AUTHORIZATION,
    ONE_TIME_PROTECTED_CLASS_TARGET_URL: `https://example.zoom.us/j/${protectedMeetingId}?pwd=${protectedPasscode}`,
    ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL: 'https://events.zoom.us/j/12345678909?pwd=event-only',
    ZOOM_S2S_ACCOUNT_ID: 'canonical-account-reference',
    ZOOM_ACCOUNT_ID: 'legacy-account-reference',
    ZOOM_S2S_CLIENT_ID: 'protected-client-reference',
    ZOOM_S2S_CLIENT_SECRET: 'protected-client-secret',
    ZOOM_HOST_USER_ID: protectedHostId,
  };
}

function fakeZoomInspection(
  override: Record<string, unknown> = {},
  failure?: { phase?: 'oauth' | 'meeting' | undefined; status: number; body: unknown } | undefined,
) {
  const requests: Array<{ method: string; resource: boolean }> = [];
  const fetchImpl: ZoomFetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const resource = url.pathname.startsWith('/v2/');
    requests.push({ method, resource });
    if (url.pathname === '/oauth/token') {
      if (failure?.phase === 'oauth') return jsonResponse(failure.body, failure.status);
      return jsonResponse({
        access_token: 'protected-access-token',
        expires_in: 3600,
      });
    }
    if (url.pathname === `/v2/meetings/${protectedMeetingId}` && method === 'GET') {
      if (failure && failure.phase !== 'oauth') {
        return jsonResponse(failure.body, failure.status);
      }
      return jsonResponse({ ...exactMeetingPayload(), ...override });
    }
    return jsonResponse({ message: 'not found' }, 404);
  };

  return {
    requests,
    options: {
      enabled: true,
      environment: 'staging' as const,
      apiBaseUrl: 'https://api.zoom.test/v2',
      oauthTokenUrl: 'https://auth.zoom.test/oauth/token',
      credentials: {
        accountId: 'protected-account-reference',
        clientId: 'protected-client-reference',
        clientSecret: 'protected-client-secret',
      },
      fetchImpl,
    },
  };
}

function exactMeetingPayload() {
  return {
    id: protectedMeetingId,
    type: 2,
    host_id: protectedHostId,
    topic: protectedTopic,
    agenda: ZOOM_ISOLATED_CANARY_AGENDA,
    join_url: `https://example.zoom.us/j/${protectedMeetingId}?pwd=${protectedPasscode}`,
    start_url: 'https://example.zoom.us/s/protected-start',
    settings: {
      registrants_confirmation_email: false,
      registrants_email_notification: false,
      join_before_host: false,
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
