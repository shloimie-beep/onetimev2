import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import type { PortalActorContext } from '../../../packages/contracts/src/portals/index.ts';
import {
  createLiveClassService,
  createZoomHostLaunchPort,
  inspectZoomHostControlReadiness,
  ZOOM_HOST_CONTROL_PROVIDER_GATE_VARIABLES,
  ZOOM_HOST_CONTROL_READINESS_VARIABLES,
  ZOOM_REAL_CONTROL_CANARY_AUTHORIZATION_VARIABLES,
} from '../../../packages/domain/src/index.ts';
import type { ZoomHostLaunchDependencies } from '../../../packages/domain/src/live-class/zoom-host.ts';

const fullyConfiguredEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
  ZOOM_CLASSROOM_ENABLED: 'true',
  ZOOM_CLASSROOM_PROVIDER_MODE: 'real',
  ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'true',
  ZOOM_MEETING_SDK_CLIENT_ID: 'sdk-client-fixture',
  ZOOM_MEETING_SDK_CLIENT_SECRET: 'sdk-secret-fixture',
  ZOOM_MEETING_SDK_ALLOWED_ORIGIN: 'https://isolated-pr.example.test',
  ZOOM_MEETING_SDK_WEB_VERSION: '6.2.0',
  ZOOM_S2S_ACCOUNT_ID: 'account-fixture',
  ZOOM_S2S_CLIENT_ID: 's2s-client-fixture',
  ZOOM_S2S_CLIENT_SECRET: 's2s-secret-fixture',
  ZOOM_HOST_USER_ID: 'host-fixture',
  ZOOM_REAL_CONTROL_MEETING_ID: '987654321',
  ZOOM_REAL_CONTROL_MEETING_PASSCODE: 'meeting-passcode-fixture',
  ZOOM_CLASSROOM_CANARY_ENABLED: 'true',
  ZOOM_CLASSROOM_CANARY_LEARNER_KEY: 'full_app_preview_student_1',
  PUBLIC_BASE_URL: 'https://isolated-pr.example.test',
};

describe('Zoom real host-control readiness', () => {
  it.each(ZOOM_HOST_CONTROL_PROVIDER_GATE_VARIABLES)(
    'blocks before provider construction when %s is missing',
    (variableName) => {
      const env = without(variableName);
      const config = loadConfig(env);
      const createRestClient = vi.fn() as unknown as NonNullable<
        ZoomHostLaunchDependencies['createRestClient']
      >;
      const readiness = inspectZoomHostControlReadiness(config);

      expect(readiness).toMatchObject({
        ready: false,
        code: 'PROVIDER_OFF',
        provider_gate_blockers: expect.arrayContaining([variableName]),
        secret_values_included: false,
      });
      expect(
        createZoomHostLaunchPort(config, {
          createRestClient,
        }),
      ).toBeUndefined();
      expect(createRestClient).not.toHaveBeenCalled();
    },
  );

  it.each(ZOOM_HOST_CONTROL_READINESS_VARIABLES)(
    'returns provider-not-ready before provider construction when %s is missing',
    (variableName) => {
      const env = without(variableName);
      const config = loadConfig(env);
      const createRestClient = vi.fn() as unknown as NonNullable<
        ZoomHostLaunchDependencies['createRestClient']
      >;
      const readiness = inspectZoomHostControlReadiness(config);

      expect(readiness).toMatchObject({
        ready: false,
        code: 'PROVIDER_NOT_READY',
        readiness_blockers: expect.arrayContaining([variableName]),
        secret_values_included: false,
      });
      expect(
        createZoomHostLaunchPort(config, {
          createRestClient,
        }),
      ).toBeUndefined();
      expect(createRestClient).not.toHaveBeenCalled();
    },
  );

  it('does not let legacy SDK aliases satisfy canonical real-control readiness', () => {
    const env = without('ZOOM_MEETING_SDK_CLIENT_ID', 'ZOOM_MEETING_SDK_CLIENT_SECRET');
    env.ZOOM_MEETING_SDK_KEY = 'legacy-key-fixture';
    env.ZOOM_MEETING_SDK_SECRET = 'legacy-secret-fixture';

    const config = loadConfig(env);
    expect(config.zoomMeetingSdkKeyConfigured).toBe(true);
    expect(config.zoomMeetingSdkSecretConfigured).toBe(true);
    expect(inspectZoomHostControlReadiness(config)).toMatchObject({
      ready: false,
      code: 'PROVIDER_NOT_READY',
      readiness_blockers: expect.arrayContaining([
        'ZOOM_MEETING_SDK_CLIENT_ID',
        'ZOOM_MEETING_SDK_CLIENT_SECRET',
      ]),
    });
  });

  it('keeps the legacy S2S account alias compatible without letting it satisfy readiness', () => {
    const env = without('ZOOM_S2S_ACCOUNT_ID');
    env.ZOOM_ACCOUNT_ID = 'legacy-account-fixture';
    const config = loadConfig(env);
    const createRestClient = vi.fn() as unknown as NonNullable<
      ZoomHostLaunchDependencies['createRestClient']
    >;

    expect(config).toMatchObject({
      zoomAccountId: 'legacy-account-fixture',
      zoomAccountIdConfigured: true,
      zoomS2sAccountIdConfigured: false,
    });
    expect(inspectZoomHostControlReadiness(config)).toMatchObject({
      ready: false,
      code: 'PROVIDER_NOT_READY',
      readiness_blockers: expect.arrayContaining(['ZOOM_S2S_ACCOUNT_ID']),
    });
    expect(createZoomHostLaunchPort(config, { createRestClient })).toBeUndefined();
    expect(createRestClient).not.toHaveBeenCalled();
  });

  it('prefers the canonical S2S account ID when both names are present', () => {
    const createRestClient: NonNullable<ZoomHostLaunchDependencies['createRestClient']> = vi.fn(
      () => ({ getHostZakToken: vi.fn(async () => 'fake-zak-token') }),
    );
    const config = loadConfig({
      ...fullyConfiguredEnv,
      ZOOM_ACCOUNT_ID: 'legacy-account-fixture',
      ZOOM_S2S_ACCOUNT_ID: 'canonical-account-fixture',
    });

    expect(config.zoomAccountId).toBe('canonical-account-fixture');
    expect(config.zoomS2sAccountIdConfigured).toBe(true);
    expect(
      createZoomHostLaunchPort(config, {
        createRestClient,
        createHostSignature: () => 'fake-host-signature',
        createLearnerSignature: () => 'fake-learner-signature',
      }),
    ).toBeDefined();
    expect(createRestClient).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: expect.objectContaining({
          accountId: 'canonical-account-fixture',
        }),
      }),
    );
  });

  it.each([
    'https://another-origin.example.test',
    'http://isolated-pr.example.test',
    'https://isolated-pr.example.test/not-an-origin',
  ])('rejects non-matching or non-exact SDK origin binding %s', (allowedOrigin) => {
    const createRestClient = vi.fn() as unknown as NonNullable<
      ZoomHostLaunchDependencies['createRestClient']
    >;
    const config = loadConfig({
      ...fullyConfiguredEnv,
      ZOOM_MEETING_SDK_ALLOWED_ORIGIN: allowedOrigin,
    });
    const readiness = inspectZoomHostControlReadiness(config);

    expect(readiness).toMatchObject({
      ready: false,
      code: 'PROVIDER_NOT_READY',
      phases: {
        sdk_app: {
          ready: false,
          blocker_variable_names: ['ZOOM_MEETING_SDK_ALLOWED_ORIGIN'],
        },
      },
    });
    expect(createZoomHostLaunchPort(config, { createRestClient })).toBeUndefined();
    expect(createRestClient).not.toHaveBeenCalled();
  });

  it('separates the known S2S meeting and host blockers from SDK readiness', () => {
    const config = loadConfig(
      without(
        'ZOOM_S2S_ACCOUNT_ID',
        'ZOOM_S2S_CLIENT_ID',
        'ZOOM_S2S_CLIENT_SECRET',
        'ZOOM_HOST_USER_ID',
        'ZOOM_REAL_CONTROL_MEETING_ID',
        'ZOOM_REAL_CONTROL_MEETING_PASSCODE',
      ),
    );

    expect(inspectZoomHostControlReadiness(config)).toMatchObject({
      ready: false,
      code: 'PROVIDER_NOT_READY',
      phases: {
        sdk_app: { ready: true, blocker_variable_names: [] },
        s2s_meeting_provisioning: {
          ready: false,
          blocker_variable_names: [
            'ZOOM_S2S_ACCOUNT_ID',
            'ZOOM_S2S_CLIENT_ID',
            'ZOOM_S2S_CLIENT_SECRET',
            'ZOOM_REAL_CONTROL_MEETING_ID',
            'ZOOM_REAL_CONTROL_MEETING_PASSCODE',
          ],
        },
        host_authorization: {
          ready: false,
          blocker_variable_names: ['ZOOM_HOST_USER_ID'],
        },
      },
    });
  });

  it.each(ZOOM_REAL_CONTROL_CANARY_AUTHORIZATION_VARIABLES)(
    'keeps canary authorization separate and fail-closed when %s is missing',
    (variableName) => {
      const createRestClient = vi.fn() as unknown as NonNullable<
        ZoomHostLaunchDependencies['createRestClient']
      >;
      const config = loadConfig(without(variableName));
      const readiness = inspectZoomHostControlReadiness(config);

      expect(readiness).toMatchObject({
        ready: false,
        code: 'PROVIDER_OFF',
        readiness_blockers: [],
        canary_authorization_blockers: [variableName],
        phases: {
          sdk_app: { ready: true },
          s2s_meeting_provisioning: { ready: true },
          host_authorization: { ready: true },
          real_control_canary_authorization: { ready: false },
        },
      });
      expect(createZoomHostLaunchPort(config, { createRestClient })).toBeUndefined();
      expect(createRestClient).not.toHaveBeenCalled();
    },
  );

  it('returns typed provider-off and readiness errors before repository or provider work', async () => {
    const providerOffService = createLiveClassService({
      config: loadConfig(without('ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED')),
      repository: {} as never,
    });
    const notReadyService = createLiveClassService({
      config: loadConfig(without('ZOOM_S2S_ACCOUNT_ID')),
      repository: {} as never,
    });

    await expect(providerOffService.zoomHostBootstrap(ownerActor())).rejects.toMatchObject({
      code: 'PROVIDER_OFF',
    });
    await expect(notReadyService.zoomHostBootstrap(ownerActor())).rejects.toMatchObject({
      code: 'PROVIDER_NOT_READY',
    });
  });

  it('builds a fully configured host port using fakes without live Zoom', async () => {
    const getHostZakToken = vi.fn(async () => 'fake-zak-token');
    const createRestClient: NonNullable<ZoomHostLaunchDependencies['createRestClient']> = vi.fn(
      () => ({ getHostZakToken }),
    );
    const config = loadConfig({ ...fullyConfiguredEnv });
    const readiness = inspectZoomHostControlReadiness(config);
    const port = createZoomHostLaunchPort(config, {
      createRestClient,
      createHostSignature: () => 'fake-host-signature',
      createLearnerSignature: () => 'fake-learner-signature',
    });

    expect(readiness).toEqual({
      ready: true,
      code: 'ZOOM_HOST_CONTROL_READY',
      provider_gate_blockers: [],
      readiness_blockers: [],
      canary_authorization_blockers: [],
      phases: {
        sdk_app: { ready: true, blocker_variable_names: [] },
        s2s_meeting_provisioning: { ready: true, blocker_variable_names: [] },
        host_authorization: { ready: true, blocker_variable_names: [] },
        real_control_canary_authorization: { ready: true, blocker_variable_names: [] },
      },
      secret_values_included: false,
    });
    expect(JSON.stringify(readiness)).not.toContain('sdk-secret-fixture');
    expect(JSON.stringify(readiness)).not.toContain('s2s-secret-fixture');
    expect(port).toBeDefined();

    await expect(
      port!.resolveHostLaunch({
        occurrenceKey: 'occurrence-fixture',
        now: new Date('2026-07-22T12:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      signature: 'fake-host-signature',
      zak: 'fake-zak-token',
      video_start_model: 'PARTICIPANT_CONSENT',
    });
    await expect(
      port!.resolveTestParticipantLaunch({
        occurrenceKey: 'occurrence-fixture',
        customerKey: 'zoom_ck_1234567890abcdef12345678',
        userName: 'Student 1',
        now: new Date('2026-07-22T12:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      signature: 'fake-learner-signature',
      customer_key: 'zoom_ck_1234567890abcdef12345678',
    });
    expect(createRestClient).toHaveBeenCalledTimes(1);
    expect(getHostZakToken).toHaveBeenCalledWith('host-fixture');
  });
});

function without(...variableNames: string[]) {
  const env = { ...fullyConfiguredEnv };
  for (const variableName of variableNames) delete env[variableName];
  return env;
}

function ownerActor(): PortalActorContext {
  return {
    account_key: 'account-fixture',
    product_key: 'product-fixture',
    actor_user_ref: 'owner-fixture',
    actor_role: 'owner',
    session_key: 'session-fixture',
    capabilities: [],
    authorized_households: [],
    student_learner: null,
  };
}
