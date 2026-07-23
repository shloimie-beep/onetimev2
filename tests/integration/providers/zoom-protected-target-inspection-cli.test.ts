import { describe, expect, it } from 'vitest';
import {
  ZOOM_ISOLATED_CANARY_AGENDA,
  zoomIsolatedCanaryTopic,
  type ZoomFetch,
} from '../../../packages/domain/src/providers/zoom-rest.ts';
import {
  PROTECTED_CLASS_TARGET_ROTATION_BLOCKED,
  ZOOM_PROTECTED_TARGET_INSPECTION_AUTHORIZATION,
  type ZoomProtectedTargetInspectionResult,
} from '../../../scripts/zoom-protected-target-inspection-plan.ts';
import { runZoomProtectedTargetInspection } from '../../../scripts/zoom-protected-target-inspection-runner.ts';

const protectedMeetingId = '98765432101';
const protectedPasscode = 'protected-passcode-query-value';
const protectedHostId = 'protected-host-reference';
const protectedProviderValue = `provider-private-${protectedMeetingId}-${protectedPasscode}`;

describe('Zoom protected-target inspection CLI runner', () => {
  it('reports exact request phases for a successful read-only classification', async () => {
    const execution = await executeCli(fakeFetch('success'));

    expect(execution.exitCode).toBe(0);
    expect(execution.result).toMatchObject({
      status: 'SAFE_TO_REVOKE',
      blocker: null,
      classifications: {
        provider_readback_succeeded: true,
        safe_to_revoke: true,
      },
      counts: {
        oauth_token_requests: 1,
        meeting_resource_get_requests: 1,
        resource_mutation_requests: 0,
      },
    });
    assertFixedSanitizedOutput(execution.stdout, execution.result);
  });

  it.each([
    [
      'OAuth failure',
      'oauth_failure' as const,
      { oauth_token_requests: 1, meeting_resource_get_requests: 0 },
    ],
    [
      'meeting GET 404',
      'get_404' as const,
      { oauth_token_requests: 1, meeting_resource_get_requests: 1 },
    ],
    [
      'meeting GET network failure',
      'get_network_failure' as const,
      { oauth_token_requests: 1, meeting_resource_get_requests: 1 },
    ],
    [
      'malformed meeting readback',
      'malformed_readback' as const,
      { oauth_token_requests: 1, meeting_resource_get_requests: 1 },
    ],
  ])('fails closed with accurate sanitized counts on %s', async (_label, scenario, counts) => {
    const execution = await executeCli(fakeFetch(scenario));

    expect(execution.exitCode).toBe(1);
    expect(execution.result).toMatchObject({
      status: 'BLOCKED',
      blocker: PROTECTED_CLASS_TARGET_ROTATION_BLOCKED,
      classifications: {
        preflight_gates_passed: true,
        protected_target_parsed: true,
        provider_readback_succeeded: false,
        safe_to_revoke: false,
      },
      counts: {
        ...counts,
        resource_mutation_requests: 0,
      },
    });
    assertFixedSanitizedOutput(execution.stdout, execution.result);
  });

  it('blocks a malformed protected URL before authentication or meeting GET', async () => {
    const environment = authorizedEnvironment();
    environment.ONE_TIME_PROTECTED_CLASS_TARGET_URL = protectedProviderValue;
    let fetchCalled = false;
    const execution = await executeCli(async () => {
      fetchCalled = true;
      throw new Error('fetch must not run');
    }, environment);

    expect(fetchCalled).toBe(false);
    expect(execution.exitCode).toBe(1);
    expect(execution.result).toMatchObject({
      status: 'BLOCKED',
      blocker: PROTECTED_CLASS_TARGET_ROTATION_BLOCKED,
      classifications: {
        preflight_gates_passed: false,
        protected_target_parsed: false,
      },
      counts: {
        oauth_token_requests: 0,
        meeting_resource_get_requests: 0,
        resource_mutation_requests: 0,
      },
    });
    assertFixedSanitizedOutput(execution.stdout, execution.result);
  });

  it('never treats the Tisha event source variable as a disposable target', async () => {
    const environment = authorizedEnvironment();
    environment.ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL = `https://zoom.us/w/${protectedMeetingId}?pwd=different-event-query`;
    delete environment.ZOOM_S2S_ACCOUNT_ID;
    delete environment.ZOOM_S2S_CLIENT_ID;
    delete environment.ZOOM_S2S_CLIENT_SECRET;
    delete environment.ZOOM_HOST_USER_ID;
    let fetchCalled = false;
    const execution = await executeCli(async () => {
      fetchCalled = true;
      throw new Error('fetch must not run');
    }, environment);

    expect(fetchCalled).toBe(false);
    expect(execution.result).toMatchObject({
      status: 'BLOCKED',
      blocker: PROTECTED_CLASS_TARGET_ROTATION_BLOCKED,
      classifications: {
        protected_target_source_scope_checked: true,
        protected_target_source_scope_allowed: false,
        preflight_gates_passed: false,
      },
      counts: {
        oauth_token_requests: 0,
        meeting_resource_get_requests: 0,
        resource_mutation_requests: 0,
      },
    });
    assertFixedSanitizedOutput(execution.stdout, execution.result);
  });

  it('blocks a malformed Tisha source before credential checks or provider requests', async () => {
    const environment = authorizedEnvironment();
    environment.ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL = `https://events.zoom.us/w/not-a-meeting?pwd=${protectedProviderValue}`;
    delete environment.ZOOM_S2S_ACCOUNT_ID;
    delete environment.ZOOM_S2S_CLIENT_ID;
    delete environment.ZOOM_S2S_CLIENT_SECRET;
    delete environment.ZOOM_HOST_USER_ID;
    let fetchCalled = false;
    const execution = await executeCli(async () => {
      fetchCalled = true;
      throw new Error('fetch must not run');
    }, environment);

    expect(fetchCalled).toBe(false);
    expect(execution.result).toMatchObject({
      status: 'BLOCKED',
      blocker: PROTECTED_CLASS_TARGET_ROTATION_BLOCKED,
      classifications: {
        protected_target_parsed: true,
        protected_target_source_scope_checked: false,
        protected_target_source_scope_allowed: false,
        preflight_gates_passed: false,
      },
      counts: {
        oauth_token_requests: 0,
        meeting_resource_get_requests: 0,
        resource_mutation_requests: 0,
      },
    });
    assertFixedSanitizedOutput(execution.stdout, execution.result);
  });

  it('records a distinct source scope before unrelated missing credentials block', async () => {
    const environment = authorizedEnvironment();
    delete environment.ZOOM_S2S_CLIENT_ID;
    let fetchCalled = false;
    const execution = await executeCli(async () => {
      fetchCalled = true;
      throw new Error('fetch must not run');
    }, environment);

    expect(fetchCalled).toBe(false);
    expect(execution.result).toMatchObject({
      status: 'BLOCKED',
      blocker: PROTECTED_CLASS_TARGET_ROTATION_BLOCKED,
      classifications: {
        protected_target_source_scope_checked: true,
        protected_target_source_scope_allowed: true,
        preflight_gates_passed: false,
      },
      counts: {
        oauth_token_requests: 0,
        meeting_resource_get_requests: 0,
        resource_mutation_requests: 0,
      },
    });
    assertFixedSanitizedOutput(execution.stdout, execution.result);
  });
});

type FakeScenario =
  'success' | 'oauth_failure' | 'get_404' | 'get_network_failure' | 'malformed_readback';

function fakeFetch(scenario: FakeScenario): ZoomFetch {
  return async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/oauth/token') {
      if (scenario === 'oauth_failure') {
        return jsonResponse(
          {
            code: protectedProviderValue,
            message: protectedProviderValue,
          },
          401,
        );
      }
      return jsonResponse({
        access_token: protectedProviderValue,
        expires_in: 3600,
      });
    }

    expect(init?.method).toBe('GET');
    if (scenario === 'get_network_failure') {
      throw new Error(protectedProviderValue);
    }
    if (scenario === 'get_404') {
      return jsonResponse(
        {
          code: protectedProviderValue,
          message: protectedProviderValue,
        },
        404,
      );
    }
    if (scenario === 'malformed_readback') {
      return jsonResponse({
        code: protectedProviderValue,
        message: protectedProviderValue,
        join_url: protectedProviderValue,
      });
    }
    return jsonResponse({
      id: protectedMeetingId,
      type: 2,
      host_id: protectedHostId,
      topic: zoomIsolatedCanaryTopic(new Date('2026-07-23T14:45:00.000Z')),
      agenda: ZOOM_ISOLATED_CANARY_AGENDA,
      join_url: protectedProviderValue,
      start_url: protectedProviderValue,
      settings: {
        registrants_confirmation_email: false,
        registrants_email_notification: false,
        join_before_host: false,
      },
    });
  };
}

async function executeCli(
  fetchImpl: ZoomFetch,
  environment: NodeJS.ProcessEnv = authorizedEnvironment(),
) {
  let stdout = '';
  const exitCode = await runZoomProtectedTargetInspection(environment, {
    fetchImpl,
    apiBaseUrl: 'https://api.zoom.test/v2',
    oauthTokenUrl: 'https://auth.zoom.test/oauth/token',
    writeOutput(serialized) {
      stdout += serialized;
    },
  });
  return {
    exitCode,
    stdout,
    result: JSON.parse(stdout) as ZoomProtectedTargetInspectionResult,
  };
}

function authorizedEnvironment(): NodeJS.ProcessEnv {
  return {
    ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
    ZOOM_CLASSROOM_PROVIDER_MODE: 'sink',
    ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'false',
    ZOOM_CLASSROOM_CANARY_ENABLED: 'false',
    ZOOM_PROTECTED_TARGET_INSPECTION_AUTHORIZATION,
    ONE_TIME_PROTECTED_CLASS_TARGET_URL: `https://example.zoom.us/j/${protectedMeetingId}?pwd=${protectedPasscode}`,
    ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL: 'https://events.zoom.us/j/12345678909?pwd=event-only',
    ZOOM_S2S_ACCOUNT_ID: 'protected-account-reference',
    ZOOM_S2S_CLIENT_ID: 'protected-client-reference',
    ZOOM_S2S_CLIENT_SECRET: 'protected-client-secret',
    ZOOM_HOST_USER_ID: protectedHostId,
  };
}

function assertFixedSanitizedOutput(stdout: string, result: ZoomProtectedTargetInspectionResult) {
  expect(Object.keys(result)).toEqual(['status', 'blocker', 'classifications', 'counts']);
  expect(Object.keys(result.classifications).sort()).toEqual(
    [
      'agenda_matches_repository_canary',
      'canonical_s2s_account_used',
      'host_matches_expected',
      'join_before_host_disabled',
      'legacy_s2s_account_alias_used',
      'preflight_gates_passed',
      'protected_target_parsed',
      'protected_target_source_scope_allowed',
      'protected_target_source_scope_checked',
      'provider_readback_succeeded',
      'registrant_confirmation_email_disabled',
      'registrant_email_notification_disabled',
      'resource_requests_get_only',
      'safe_to_revoke',
      'topic_matches_repository_canary',
      'type_is_single_meeting',
    ].sort(),
  );
  expect(Object.keys(result.counts)).toEqual([
    'oauth_token_requests',
    'meeting_resource_get_requests',
    'resource_mutation_requests',
  ]);
  expect(stdout).not.toContain(protectedMeetingId);
  expect(stdout).not.toContain(protectedPasscode);
  expect(stdout).not.toContain(protectedHostId);
  expect(stdout).not.toContain(protectedProviderValue);
  expect(stdout).not.toMatch(/https?:\/\//);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
