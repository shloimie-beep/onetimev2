import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import type { PortalActorContext } from '../../../packages/contracts/src/portals/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createZoomAdminTestResourceRepository } from '../../../packages/db/src/live-class/zoom-admin-repository.ts';
import {
  createZoomAdminService,
  type ZoomAdminProviderPort,
  type ZoomAdminService,
  ZoomApiError,
} from '../../../packages/domain/src/index.ts';
import { PortalServiceError } from '../../../packages/domain/src/portals/services.ts';

let pool: DbPool;
let config: AppConfig;
let provider: ZoomAdminProviderPort;
let service: ZoomAdminService;

const now = new Date('2026-07-27T12:00:00.000Z');
const protectedMeetingId = '99887766554';
const protectedRegistrantToken = 'operator-registrant-token-must-not-leak';

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
  config = loadConfig({
    NODE_ENV: 'test',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
    PUBLIC_BASE_URL: 'https://isolated-pr.example.test',
    ONE_TIME_OWNER_TEST_EMAIL: 'operator-owned@example.test',
    ZOOM_S2S_ACCOUNT_ID: 'zoom-account-fixture',
    ZOOM_S2S_CLIENT_ID: 'zoom-client-fixture',
    ZOOM_S2S_CLIENT_SECRET: 'zoom-secret-fixture',
    ZOOM_HOST_USER_ID: 'zoom-host-fixture',
  });
  provider = {
    checkConnection: vi.fn(async () => undefined),
    createTestMeeting: vi.fn(
      async (input: Parameters<ZoomAdminProviderPort['createTestMeeting']>[0]) => ({
        meeting: {
          provider: 'zoom' as const,
          meeting_id: protectedMeetingId,
          provider_meeting_ref_digest: 'a'.repeat(48),
          type: 2 as const,
          starts_at: input.startsAt.toISOString(),
          duration_minutes: input.durationMinutes,
          raw_start_url_present: false as const,
          raw_join_url_present: false as const,
        },
        password: 'protected-password',
      }),
    ),
    registerTestLearner: vi.fn(
      async (input: Parameters<ZoomAdminProviderPort['registerTestLearner']>[0]) => ({
        provider: 'zoom' as const,
        meeting_id_digest: 'a'.repeat(48),
        occurrence_id: 'single',
        learner_key: input.learnerKey,
        registrant_id_digest: 'b'.repeat(48),
        registrant_token: protectedRegistrantToken,
        registrant_token_ref: 'registrant_token_ref_fixture',
        join_url_digest: 'c'.repeat(48),
        raw_join_url_present: false as const,
      }),
    ),
    deleteTestMeeting: vi.fn(async () => ({ already_absent: false })),
  };
  service = createZoomAdminService({
    config,
    repository: createZoomAdminTestResourceRepository(pool),
    provider,
    clock: () => now,
  });
});

afterEach(async () => {
  await pool.end();
});

describe('Zoom Admin app-owned disposable resource', () => {
  it('runs the six-button backend lifecycle without exposing provider launch material', async () => {
    expect(await service.status(ownerActor())).toMatchObject({
      connection_state: 'not_checked',
      meeting_state: 'none',
      learner_state: 'none',
      raw_join_url_present: false,
    });

    expect(await service.checkConnection(ownerActor())).toMatchObject({
      connection_state: 'connected',
    });
    const created = await service.createTestMeeting(ownerActor(), 'zoom-create-fixture-1');
    expect(created).toMatchObject({
      meeting_state: 'active',
      app_created_meeting_recorded: true,
      can_register_learner: true,
      can_delete_meeting: true,
      raw_join_url_present: false,
    });

    const registered = await service.registerTestLearner(ownerActor(), 'zoom-register-fixture-1');
    expect(registered).toMatchObject({
      meeting_state: 'active',
      learner_state: 'registered',
      raw_join_url_present: false,
    });

    const deleted = await service.deleteTestMeeting(ownerActor(), 'zoom-delete-fixture-1');
    expect(deleted).toMatchObject({
      meeting_state: 'deleted',
      app_created_meeting_recorded: false,
      can_delete_meeting: false,
      raw_join_url_present: false,
    });

    const serialized = JSON.stringify({ created, registered, deleted });
    expect(serialized).not.toContain(protectedMeetingId);
    expect(serialized).not.toContain(protectedRegistrantToken);
    expect(serialized).not.toMatch(/https?:\/\/|zoom\.us|"(?:join_url|password)"\s*:/i);
  });

  it('makes create, register, and delete idempotent around the recorded resource', async () => {
    await service.createTestMeeting(ownerActor(), 'zoom-create-fixture-1');
    await service.createTestMeeting(ownerActor(), 'zoom-create-fixture-2');
    expect(provider.createTestMeeting).toHaveBeenCalledTimes(1);

    await service.registerTestLearner(ownerActor(), 'zoom-register-fixture-1');
    await service.registerTestLearner(ownerActor(), 'zoom-register-fixture-2');
    expect(provider.registerTestLearner).toHaveBeenCalledTimes(1);

    await service.deleteTestMeeting(ownerActor(), 'zoom-delete-fixture-1');
    await service.deleteTestMeeting(ownerActor(), 'zoom-delete-fixture-2');
    expect(provider.deleteTestMeeting).toHaveBeenCalledTimes(1);
    expect(provider.deleteTestMeeting).toHaveBeenCalledWith(protectedMeetingId);
  });

  it('does not allow deletion or registration when no app-created meeting is recorded', async () => {
    await expect(
      service.deleteTestMeeting(ownerActor(), 'zoom-delete-unknown-1'),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'No app-created Zoom test meeting is recorded for deletion.',
    });
    await expect(
      service.registerTestLearner(ownerActor(), 'zoom-register-unknown-1'),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'No app-created Zoom test meeting is recorded for this action.',
    });
    expect(provider.deleteTestMeeting).not.toHaveBeenCalled();
    expect(provider.registerTestLearner).not.toHaveBeenCalled();
  });

  it('stores ownership ciphertext rather than a raw meeting id', async () => {
    await service.createTestMeeting(ownerActor(), 'zoom-create-fixture-1');
    const result = await pool.query(
      `SELECT provider_meeting_ref_digest, provider_meeting_ciphertext
         FROM onetime.zoom_admin_test_resources`,
    );
    expect(result.rows[0]?.provider_meeting_ref_digest).toBe('a'.repeat(48));
    expect(result.rows[0]?.provider_meeting_ciphertext).toBeTruthy();
    expect(String(result.rows[0]?.provider_meeting_ciphertext)).not.toContain(protectedMeetingId);
  });

  it('surfaces a plain recoverable error and blocks a blind second create after timeout', async () => {
    provider.createTestMeeting = vi.fn(async () => {
      throw new ZoomApiError(0, 'ZOOM_TIMEOUT', 'Zoom request timed out.', true);
    });
    service = createZoomAdminService({
      config,
      repository: createZoomAdminTestResourceRepository(pool),
      provider,
      clock: () => now,
    });

    await expect(service.createTestMeeting(ownerActor(), 'zoom-create-timeout-1')).rejects.toEqual(
      expect.objectContaining<Partial<PortalServiceError>>({
        code: 'ADAPTER_UNAVAILABLE',
        message: 'Zoom request timed out.',
      }),
    );
    const status = await service.status(ownerActor());
    expect(status).toMatchObject({
      meeting_state: 'create_unknown',
      can_create_meeting: false,
      recoverable: false,
      last_error: 'Zoom request timed out.',
    });

    await service.createTestMeeting(ownerActor(), 'zoom-create-timeout-2');
    expect(provider.createTestMeeting).toHaveBeenCalledTimes(1);
  });

  it('requires an owner or admin actor', async () => {
    await expect(service.status(studentActor())).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(provider.checkConnection).not.toHaveBeenCalled();
  });
});

function ownerActor(): PortalActorContext {
  return {
    account_key: config.accountKey,
    product_key: config.productKey,
    actor_user_ref: 'owner-fixture',
    actor_role: 'owner',
    session_key: 'session-fixture',
    capabilities: [],
    authorized_households: [],
    student_learner: null,
  };
}

function studentActor(): PortalActorContext {
  return {
    ...ownerActor(),
    actor_user_ref: 'student-fixture',
    actor_role: 'student',
    student_learner: {
      learner_key: 'student-fixture',
      household_key: 'household-fixture',
      access_state_key: 'access-fixture',
    },
  };
}
