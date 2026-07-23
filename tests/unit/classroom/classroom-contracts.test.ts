import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import { classroomLaunchBootstrapResponseSchema } from '../../../packages/contracts/src/classroom/index.ts';
import {
  createClassroomService,
  type ClassroomEligibility,
  type ClassroomLaunchGrantRecord,
  type ClassroomOccurrenceRecord,
  type ClassroomRepository,
} from '../../../packages/domain/src/classroom/service.ts';
import { resolveDailyClassWindow } from '../../../packages/domain/src/classes/service.ts';
import {
  createDeterministicReminderDeliveryPort,
  createDeterministicZoomMeetingLaunchPort,
  createDeterministicZoomRegistrantPort,
  createDisabledZoomAttendanceReconciliationPort,
  createDisabledZoomFeatureParticipantPort,
} from '../../../packages/domain/src/providers/zoom.ts';
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
        mode: 'sink',
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

    const real = classroomLaunchBootstrapResponseSchema.parse({
      ...base,
      occurrence: { ...base.occurrence, provider_state: 'ready' },
      sdk: {
        mode: 'real',
        sdk_web_version: '6.2.0',
        meeting_number: '9123456789',
        signature: 'real_signature_contract_1234567890',
        meeting_password: 'protected-passcode',
        customer_key: 'zoom_ck_1234567890abcdef12345678',
        role: 0,
        user_display_name: 'Learner',
        user_email_required: false,
        leave_url: '/app/student',
        video_start_model: 'PARTICIPANT_CONSENT',
      },
      provider: { mode: 'real', state: 'ready', raw_join_url_present: false },
    });
    expect(real.sdk).toMatchObject({
      mode: 'real',
      role: 0,
      video_start_model: 'PARTICIPANT_CONSENT',
    });
    expect(() =>
      classroomLaunchBootstrapResponseSchema.parse({
        ...real,
        sdk: { ...real.sdk, customer_key: 'wrong-or-cross-account-key' },
      }),
    ).toThrow();
  });

  it('keeps real provider mode fail-closed and only enables sink readiness', () => {
    const realConfig = loadConfig({
      NODE_ENV: 'test',
      ZOOM_CLASSROOM_ENABLED: 'true',
      ZOOM_CLASSROOM_PROVIDER_MODE: 'real',
      ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'true',
      ZOOM_CLASSROOM_CANARY_LEARNER_KEY: 'learner_contract',
      ZOOM_MEETING_SDK_CLIENT_ID: 'configured',
      ZOOM_MEETING_SDK_CLIENT_SECRET: 'configured',
      ZOOM_MEETING_SDK_WEB_VERSION: '3.11.2',
      ZOOM_S2S_ACCOUNT_ID: 'configured',
      ZOOM_S2S_CLIENT_ID: 'configured',
      ZOOM_S2S_CLIENT_SECRET: 'configured',
    });
    const sinkConfig = loadConfig({
      NODE_ENV: 'test',
      ZOOM_CLASSROOM_ENABLED: 'true',
      ZOOM_CLASSROOM_PROVIDER_MODE: 'sink',
    });

    expect(serviceFor(realConfig).providerState()).toBe('unconfigured');
    expect(serviceFor(realConfig, true).providerState()).toBe('ready');
    expect(serviceFor(sinkConfig).providerState()).toBe('sink_ready');
  });

  it('keeps Meeting SDK aliases separate from canonical S2S OAuth readiness', () => {
    const legacySdkOnly = loadConfig({
      NODE_ENV: 'test',
      ZOOM_MEETING_SDK_KEY: 'legacy-client-id-alias',
      ZOOM_MEETING_SDK_SECRET: 'legacy-client-secret-alias',
      ZOOM_MEETING_SDK_WEB_VERSION: '3.11.2',
      ZOOM_ACCOUNT_ID: 'legacy-s2s-account-id-alias',
    });
    expect(legacySdkOnly).toMatchObject({
      zoomMeetingSdkClientIdConfigured: true,
      zoomMeetingSdkClientSecretConfigured: true,
      zoomMeetingSdkWebVersionConfigured: true,
      zoomMeetingSdkLegacyAliasUsed: true,
      zoomAccountId: 'legacy-s2s-account-id-alias',
      zoomAccountIdConfigured: true,
      zoomS2sAccountIdConfigured: false,
      zoomS2sClientIdConfigured: false,
      zoomS2sClientSecretConfigured: false,
    });

    const canonical = loadConfig({
      NODE_ENV: 'test',
      ZOOM_MEETING_SDK_CLIENT_ID: 'meeting-sdk-client-id',
      ZOOM_MEETING_SDK_CLIENT_SECRET: 'meeting-sdk-client-secret',
      ZOOM_MEETING_SDK_WEB_VERSION: '3.11.2',
      ZOOM_S2S_ACCOUNT_ID: 's2s-account-id',
      ZOOM_S2S_CLIENT_ID: 's2s-client-id',
      ZOOM_S2S_CLIENT_SECRET: 's2s-client-secret',
    });
    expect(canonical).toMatchObject({
      zoomMeetingSdkClientIdConfigured: true,
      zoomMeetingSdkClientSecretConfigured: true,
      zoomMeetingSdkWebVersionConfigured: true,
      zoomMeetingSdkLegacyAliasUsed: false,
      zoomS2sAccountIdConfigured: true,
      zoomS2sClientIdConfigured: true,
      zoomS2sClientSecretConfigured: true,
    });
  });

  it('keeps the official Zoom Meeting SDK boundary deterministic and strips internal fields', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      ZOOM_CLASSROOM_ENABLED: 'true',
      ZOOM_CLASSROOM_PROVIDER_MODE: 'sink',
    });
    const occurrence = fixtureOccurrence();
    const eligibility = fixtureEligibility();
    const grant = fixtureGrant();
    const registrant = await createDeterministicZoomRegistrantPort().resolveRegistrant({
      config,
      occurrence,
      eligibility,
      grant,
    });
    const launchPort = createDeterministicZoomMeetingLaunchPort();
    const component = await launchPort.resolveLaunchMaterial({
      config,
      occurrence,
      eligibility,
      grant,
      registrant,
      selectedView: 'component',
    });
    const client = await launchPort.resolveLaunchMaterial({
      config,
      occurrence,
      eligibility,
      grant,
      registrant,
      selectedView: 'client',
    });

    expect(registrant).toMatchObject({
      provider: 'zoom',
      mode: 'sink',
      registration_state: 'sink_ready',
      raw_join_url_present: false,
    });
    expect(component.official_client_method).toBe('ZoomMtgEmbedded.createClient.init.join');
    expect(client.official_client_method).toBe('ZoomMtg.preLoadWasm.prepareWebSDK.init.join');
    expect(component.provider_meeting_ref_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify({ registrant, component, client })).not.toMatch(
      /https?:\/\/|zoom\.us|\/j\//i,
    );

    const parsed = classroomLaunchBootstrapResponseSchema.parse({
      occurrence: {
        class_key: occurrence.occurrence_key,
        title: occurrence.title,
        learner_key: eligibility.learner_key,
        local_class_date: occurrence.local_class_date,
        timezone: 'Asia/Jerusalem',
        starts_at: occurrence.starts_at,
        join_opens_at: occurrence.join_opens_at,
        join_closes_at: occurrence.join_closes_at,
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
      selected_view: 'component',
      attempt_key: 'classroom_attempt_contract',
      sdk: component,
      provider: { mode: 'sink', state: 'sink_ready', raw_join_url_present: false },
      policy: {
        mute_on_join: true,
        participant_role: 0,
        host_policy_version: 'ot88-host-policy-v1',
      },
    });
    expect(parsed.sdk).not.toHaveProperty('provider_meeting_ref_digest');
    expect(parsed.sdk).not.toHaveProperty('official_client_method');
  });

  it('keeps reconciliation, feature participant, and reminder delivery ports deterministic no-ops', async () => {
    const reconciliation =
      await createDisabledZoomAttendanceReconciliationPort().reconcileAttendance({
        accountKey: 'acct_test',
        productKey: 'prod_test',
        occurrenceKey: 'class_occurrence_contract',
        enabled: true,
      });
    const featured = await createDisabledZoomFeatureParticipantPort().featureParticipant({
      accountKey: 'acct_test',
      productKey: 'prod_test',
      occurrenceKey: 'class_occurrence_contract',
      learnerKey: 'learner_contract',
      enabled: true,
    });
    const reminders = createDeterministicReminderDeliveryPort();
    const baseReminder = {
      accountKey: 'acct_test',
      productKey: 'prod_test',
      learnerKey: 'learner_contract',
      occurrenceKey: 'class_occurrence_contract',
      channel: 'portal' as const,
      preference: 'portal' as const,
      consent: 'granted' as const,
      suppression: 'active' as const,
      attempt: 0,
      idempotencyKey: 'reminder_contract_001',
    };

    await expect(reminders.deliverReminder(baseReminder)).resolves.toMatchObject({
      status: 'sent_sink',
      external_send_performed: false,
      reason: 'sink_delivery_recorded',
    });
    await expect(
      reminders.deliverReminder({
        ...baseReminder,
        preference: 'none',
        idempotencyKey: 'reminder_contract_002',
      }),
    ).resolves.toMatchObject({ status: 'suppressed', reason: 'preference_opted_out' });
    await expect(
      reminders.deliverReminder({
        ...baseReminder,
        consent: 'missing',
        idempotencyKey: 'reminder_contract_003',
      }),
    ).resolves.toMatchObject({ status: 'suppressed', reason: 'consent_required' });
    await expect(
      reminders.deliverReminder({
        ...baseReminder,
        suppression: 'suppressed',
        idempotencyKey: 'reminder_contract_004',
      }),
    ).resolves.toMatchObject({ status: 'suppressed', reason: 'suppressed' });
    await expect(
      reminders.deliverReminder(
        { ...baseReminder, attempt: 1, idempotencyKey: 'reminder_contract_005' },
        new Date('2026-07-16T15:30:00.000Z'),
      ),
    ).resolves.toMatchObject({ status: 'retry', reason: 'retryable_sink_failure' });
    await expect(
      reminders.deliverReminder({
        ...baseReminder,
        attempt: 3,
        idempotencyKey: 'reminder_contract_006',
      }),
    ).resolves.toMatchObject({ status: 'dead_letter', reason: 'max_retries_exceeded' });
    expect(reconciliation).toMatchObject({
      status: 'disabled',
      external_call_performed: false,
      reconciled_count: 0,
    });
    expect(featured).toMatchObject({
      status: 'disabled',
      external_call_performed: false,
      reason: 'v1_host_controls_only',
    });
  });
});

function serviceFor(config: ReturnType<typeof loadConfig>, zoomRealProviderReady = false) {
  return createClassroomService({
    config,
    repository: failingRepository(),
    questionCodec: new DeterministicTestPayloadCodec(),
    zoomRealProviderReady,
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

function fixtureOccurrence(): ClassroomOccurrenceRecord {
  return {
    occurrence_key: 'class_occurrence_contract',
    class_series_key: 'class_series_contract',
    title: 'Daily One Time Mishnayos',
    local_class_date: '2026-07-16',
    timezone: 'Asia/Jerusalem',
    starts_at: '2026-07-16T16:00:00.000Z',
    reminder_due_at: '2026-07-16T15:30:00.000Z',
    join_opens_at: '2026-07-16T15:45:00.000Z',
    scheduled_ends_at: '2026-07-16T17:00:00.000Z',
    join_closes_at: '2026-07-16T17:15:00.000Z',
    occurrence_state: 'scheduled',
    access_state: 'ready',
  };
}

function fixtureEligibility(): ClassroomEligibility {
  return {
    account_key: 'acct_test',
    product_key: 'prod_test',
    household_key: 'household_contract',
    learner_key: 'learner_contract',
    display_name: 'Contract Learner',
    learner_status: 'active',
    household_status: 'active',
    student_access_status: 'active',
    entitlement_state: 'active',
    consent_status: 'not_required',
    active_learner_count: 1,
  };
}

function fixtureGrant(): ClassroomLaunchGrantRecord {
  return {
    grant_key: 'classroom_grant_contract',
    account_key: 'acct_test',
    product_key: 'prod_test',
    household_key: 'household_contract',
    learner_key: 'learner_contract',
    occurrence_key: 'class_occurrence_contract',
    actor_user_ref: 'user_contract',
    session_key_digest: 'session_digest_contract',
    status: 'issued',
    idempotency_key: 'idem_contract',
    provider_mode: 'sink',
    expires_at: '2026-07-16T16:20:00.000Z',
    consumed_at: null,
  };
}
