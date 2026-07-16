import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import { classroomLaunchBootstrapResponseSchema } from '../../../packages/contracts/src/classroom/index.ts';
import {
  createClassroomService,
  type ClassroomRepository,
} from '../../../packages/domain/src/classroom/service.ts';
import { resolveDailyClassWindow } from '../../../packages/domain/src/classes/service.ts';
import { DeterministicTestPayloadCodec } from '../../../packages/domain/src/telegram/crypto.ts';

describe('OT-88 classroom contracts and policy', () => {
  it('keeps the daily class at 19:00 Asia/Jerusalem across seasonal offsets', () => {
    const summer = resolveDailyClassWindow(new Date('2026-07-16T10:00:00.000Z'));
    const winter = resolveDailyClassWindow(new Date('2026-01-16T10:00:00.000Z'));

    expect(summer.localDate).toBe('2026-07-16');
    expect(summer.startsAt.toISOString()).toBe('2026-07-16T16:00:00.000Z');
    expect(winter.localDate).toBe('2026-01-16');
    expect(winter.startsAt.toISOString()).toBe('2026-01-16T17:00:00.000Z');
  });

  it('rejects bootstrap payloads that try to elevate learners or expose raw targets', () => {
    const base = {
      occurrence: {
        class_key: 'class_occurrence_contract',
        title: 'Daily One Time Mishnayos',
        learner_key: 'learner_contract',
        local_class_date: '2026-07-16',
        timezone: 'Asia/Jerusalem',
        starts_at: '2026-07-16T16:00:00.000Z',
        join_opens_at: '2026-07-16T15:45:00.000Z',
        join_closes_at: '2026-07-16T17:15:00.000Z',
        state: 'open',
        provider_state: 'sink_ready',
        can_join: true,
        reason: null,
        host_policy: {
          mute_on_join: true,
          learner_screen_share: false,
          learner_invite: false,
          learner_chat: false,
        },
      },
      selected_view: 'client',
      attempt_key: 'classroom_attempt_contract',
      sdk: {
        sdk_key_ref: 'sdk_key_contract',
        meeting_number: '9123456789',
        signature: 'sink_sig_contract_1234567890',
        password_ref: 'meeting_password_contract',
        registrant_token_ref: 'registrant_contract',
        role: 0,
        user_display_name: 'Learner',
        user_email_required: false,
        leave_url: '/app/student',
      },
      provider: { mode: 'sink', state: 'sink_ready', raw_join_url_present: false },
      policy: {
        mute_on_join: true,
        participant_role: 0,
        host_policy_version: 'ot88-host-policy-v1',
      },
    };

    expect(() => classroomLaunchBootstrapResponseSchema.parse(base)).not.toThrow();
    expect(() =>
      classroomLaunchBootstrapResponseSchema.parse({
        ...base,
        sdk: { ...base.sdk, role: 1 },
      }),
    ).toThrow();
    expect(() =>
      classroomLaunchBootstrapResponseSchema.parse({
        ...base,
        provider: { ...base.provider, raw_join_url_present: true },
      }),
    ).toThrow();
  });

  it('keeps real provider mode fail-closed and only enables sink readiness', () => {
    const realConfig = loadConfig({
      NODE_ENV: 'test',
      ZOOM_CLASSROOM_ENABLED: 'true',
      ZOOM_CLASSROOM_PROVIDER_MODE: 'real',
      ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'true',
      ZOOM_MEETING_SDK_KEY: 'configured',
      ZOOM_MEETING_SDK_SECRET: 'configured',
      ZOOM_ACCOUNT_ID: 'configured',
    });
    const sinkConfig = loadConfig({
      NODE_ENV: 'test',
      ZOOM_CLASSROOM_ENABLED: 'true',
      ZOOM_CLASSROOM_PROVIDER_MODE: 'sink',
    });

    expect(serviceFor(realConfig).providerState()).toBe('unconfigured');
    expect(serviceFor(sinkConfig).providerState()).toBe('sink_ready');
  });
});

function serviceFor(config: ReturnType<typeof loadConfig>) {
  return createClassroomService({
    config,
    repository: failingRepository(),
    questionCodec: new DeterministicTestPayloadCodec(),
  });
}

function failingRepository(): ClassroomRepository {
  const fail = () => {
    throw new Error('repository should not be called');
  };
  return {
    ensureDailyOccurrence: fail,
    getOccurrence: fail,
    getLearnerEligibility: fail,
    issueLaunchGrant: fail,
    consumeLaunchGrant: fail,
    upsertAttendanceAttempt: fail,
    recordAttendanceEvent: fail,
    submitQuestion: fail,
    listOwnQuestions: fail,
    moderateQuestion: fail,
    enqueueActionGatewayEvent: fail,
    scheduleDueReminders: fail,
    recordAudit: fail,
  } as unknown as ClassroomRepository;
}
