import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import {
  createClassroomService,
  type ClassroomRepository,
} from '../../../packages/domain/src/classroom/service.ts';
import {
  ZoomApiError,
  createHostZoomSdkSignature,
  createLearnerZoomSdkSignature,
  createZoomRestClient,
  registrantTokenFromJoinUrl,
  resolveZoomOccurrenceForLocalDate,
} from '../../../packages/domain/src/providers/zoom-rest.ts';
import {
  processZoomWebhook,
  verifyZoomWebhookSignature,
  zoomWebhookSignature,
  zoomWebhookUrlValidationToken,
} from '../../../packages/domain/src/providers/zoom-webhook.ts';
import { DeterministicTestPayloadCodec } from '../../../packages/domain/src/telegram/crypto.ts';

describe('OT-103 Zoom provider fulfillment contracts', () => {
  it('creates a sanitized fixed daily recurring meeting and resolves the local occurrence', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const client = createZoomRestClient({
      enabled: true,
      environment: 'staging',
      credentials: {
        accountId: 'acct_zoom_test',
        clientId: 'client_test',
        clientSecret: 'client_secret_test',
      },
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init });
        if (String(input).startsWith('https://zoom.us/oauth/token')) {
          expect(init?.headers).toMatchObject({
            authorization: `Basic ${Buffer.from('client_test:client_secret_test').toString('base64')}`,
          });
          return jsonResponse({ access_token: 'access_token_test', expires_in: 3600 });
        }
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body).toMatchObject({
          type: 8,
          timezone: 'Asia/Jerusalem',
          duration: 60,
          recurrence: { type: 1, repeat_interval: 1, end_times: 50 },
          settings: {
            registration_type: 2,
            registrants_confirmation_email: false,
            registrants_email_notification: false,
            join_before_host: false,
            mute_upon_entry: true,
          },
        });
        expect(body.start_time).toBe('2026-07-16T16:00:00.000Z');
        return jsonResponse({
          id: 987654321,
          type: 8,
          start_url: 'https://zoom.us/s/private-host-start',
          join_url: 'https://zoom.us/j/reusable-join',
          occurrences: [
            {
              occurrence_id: 'occurrence_20260716',
              start_time: '2026-07-16T16:00:00Z',
              status: 'available',
            },
          ],
        });
      },
    });

    const meeting = await client.createDailyRecurringMeeting({
      hostUserId: 'host_user_test',
      localDate: '2026-07-16',
      topic: 'Daily One Time Mishnayos',
      durationMinutes: 60,
    });

    expect(calls.map((call) => call.url)).toEqual([
      'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=acct_zoom_test',
      'https://api.zoom.us/v2/users/host_user_test/meetings',
    ]);
    expect(JSON.stringify(meeting)).not.toMatch(
      /"(?:start_url|join_url)"\s*:|https?:\/\/|zoom\.us/i,
    );
    expect(meeting).toMatchObject({
      provider: 'zoom',
      type: 8,
      raw_start_url_present: false,
      raw_join_url_present: false,
      occurrence_count: 1,
    });
    expect(
      resolveZoomOccurrenceForLocalDate({
        occurrences: meeting.occurrences,
        localDate: '2026-07-16',
      })?.occurrence_id,
    ).toBe('occurrence_20260716');
  });

  it('creates a learner registrant from the occurrence and keeps raw join URLs out of outputs', async () => {
    const client = createZoomRestClient({
      enabled: true,
      environment: 'staging',
      credentials: {
        accountId: 'acct_zoom_test',
        clientId: 'client_test',
        clientSecret: 'client_secret_test',
      },
      fetchImpl: async (input, init) => {
        if (String(input).startsWith('https://zoom.us/oauth/token')) {
          return jsonResponse({ access_token: 'access_token_test', expires_in: 3600 });
        }
        expect(String(input)).toBe(
          'https://api.zoom.us/v2/meetings/987654321/registrants?occurrence_ids=occurrence_20260716',
        );
        expect(JSON.parse(String(init?.body))).toMatchObject({
          email: 'learner@example.test',
          first_name: 'Alpha',
          last_name: 'Learner',
          auto_approve: true,
        });
        return jsonResponse({
          id: 987654321,
          registrant_id: 'registrant_alpha',
          join_url: 'https://example.zoom.us/w/987654321?tk=REGISTRANT_TOKEN&pwd=secret',
        });
      },
    });

    const registrant = await client.addLearnerRegistrant({
      meetingId: '987654321',
      occurrenceId: 'occurrence_20260716',
      learnerKey: 'learner_alpha',
      displayName: 'Alpha Learner',
      email: 'learner@example.test',
    });

    expect(registrantTokenFromJoinUrl('https://example.zoom.us/w/1?tk=abc123')).toBe('abc123');
    expect(registrant).toMatchObject({
      provider: 'zoom',
      learner_key: 'learner_alpha',
      occurrence_id: 'occurrence_20260716',
      registrant_token: 'REGISTRANT_TOKEN',
      raw_join_url_present: false,
    });
    expect(JSON.stringify(registrant)).not.toMatch(/https?:\/\/|zoom\.us|pwd=secret/i);
  });

  it('creates one isolated meeting and one-time fictional registrants without returning provider URLs', async () => {
    const calls: string[] = [];
    const meetingSettings: unknown[] = [];
    const client = createZoomRestClient({
      enabled: true,
      environment: 'staging',
      credentials: {
        accountId: 'acct_zoom_test',
        clientId: 'client_test',
        clientSecret: 'client_secret_test',
      },
      fetchImpl: async (input, init) => {
        const url = String(input);
        calls.push(url);
        if (url.startsWith('https://zoom.us/oauth/token')) {
          return jsonResponse({ access_token: 'access_token_test', expires_in: 3600 });
        }
        if (url.endsWith('/users/host_test/meetings')) {
          expect(JSON.parse(String(init?.body))).toMatchObject({
            type: 2,
            settings: {
              registrants_confirmation_email: false,
              registrants_email_notification: false,
              participant_video: false,
              mute_upon_entry: true,
              waiting_room: true,
            },
          });
          return jsonResponse({
            id: '987654321',
            type: 2,
            password: 'private-test-passcode',
            start_url: 'https://zoom.us/private-start',
            join_url: 'https://zoom.us/private-join',
          });
        }
        if (init?.method === 'PATCH') {
          meetingSettings.push(JSON.parse(String(init.body)));
          return jsonResponse({});
        }
        expect(url).toBe('https://api.zoom.us/v2/meetings/987654321/registrants');
        return jsonResponse({
          registrant_id: 'fictional_1',
          join_url: 'https://example.zoom.us/w/987654321?tk=FICTIONAL_TOKEN',
        });
      },
    });
    const privateMeeting = await client.createIsolatedTestMeeting({
      hostUserId: 'host_test',
      startsAt: new Date('2027-07-21T16:30:00Z'),
      topic: 'One Time isolated control canary',
      durationMinutes: 60,
    });
    await client.enableMeetingRegistration(privateMeeting.meeting.meeting_id);
    const registrant = await client.addLearnerRegistrant({
      meetingId: privateMeeting.meeting.meeting_id,
      learnerKey: 'fictional_student_1',
      displayName: 'Student 1',
      email: 'fictional-1@example.test',
    });
    await client.disableMeetingRegistration(privateMeeting.meeting.meeting_id);
    expect(privateMeeting.meeting).toMatchObject({
      type: 2,
      raw_start_url_present: false,
      raw_join_url_present: false,
    });
    expect(registrant.occurrence_id).toBe('single');
    expect(JSON.stringify({ meeting: privateMeeting.meeting, registrant })).not.toMatch(
      /https?:\/\/|private-test-passcode/i,
    );
    expect(meetingSettings).toEqual([
      {
        settings: {
          approval_type: 1,
          registration_type: 1,
          registrants_confirmation_email: false,
          registrants_email_notification: false,
        },
      },
      { settings: { approval_type: 2 } },
    ]);
    expect(calls).toHaveLength(5);
  });

  it('fails closed when disabled, sanitizes provider errors, and marks retryable statuses', async () => {
    const disabled = createZoomRestClient({
      enabled: false,
      environment: 'staging',
      credentials: { accountId: 'a', clientId: 'b', clientSecret: 'c' },
      fetchImpl: async () => jsonResponse({}),
    });
    await expect(disabled.getMeeting('123')).rejects.toMatchObject({
      code: 'ZOOM_PROVIDER_DISABLED',
      status: 503,
    });

    const rateLimited = createZoomRestClient({
      enabled: true,
      environment: 'staging',
      credentials: { accountId: 'a', clientId: 'b', clientSecret: 'c' },
      fetchImpl: async (input) =>
        String(input).includes('/oauth/')
          ? jsonResponse({ access_token: 'token' })
          : jsonResponse({ code: 429, message: 'raw sensitive body' }, 429),
    });
    await expect(rateLimited.getMeeting('123')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ZoomApiError);
      expect(error).toMatchObject({ status: 429, retryable: true });
      expect(String((error as Error).message)).not.toContain('raw sensitive body');
      return true;
    });
  });

  it('creates learner-only Meeting SDK signatures with role 0 and no SDK secret leakage', () => {
    const signature = createLearnerZoomSdkSignature({
      credentials: { sdkKey: 'sdk_key_test', sdkSecret: 'sdk_secret_do_not_leak' },
      meetingNumber: '987654321',
      issuedAt: new Date('2026-07-16T16:00:00Z'),
    });
    const payload = JSON.parse(Buffer.from(signature.split('.')[1] ?? '', 'base64url').toString());

    expect(payload).toMatchObject({
      appKey: 'sdk_key_test',
      sdkKey: 'sdk_key_test',
      mn: '987654321',
      role: 0,
    });
    expect(signature).not.toContain('sdk_secret_do_not_leak');
  });

  it('creates a short-lived role-1 host signature without exposing the SDK secret', () => {
    const issuedAt = new Date('2027-07-21T16:00:00Z');
    const signature = createHostZoomSdkSignature({
      credentials: { sdkKey: 'sdk_key_test', sdkSecret: 'sdk_secret_do_not_leak' },
      meetingNumber: '987654321',
      issuedAt,
      ttlSeconds: 30 * 60,
    });
    const payload = JSON.parse(Buffer.from(signature.split('.')[1] ?? '', 'base64url').toString());
    expect(payload).toMatchObject({ role: 1, mn: '987654321' });
    expect(payload.exp - payload.iat).toBe(30 * 60);
    expect(signature).not.toContain('sdk_secret_do_not_leak');
  });

  it('verifies Zoom webhook signatures, URL validation, duplicate detection, and attendance projection', () => {
    const secretToken = 'zoom_webhook_secret_token_test';
    const now = new Date('2026-07-16T19:17:08+03:00');
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const body = JSON.stringify({
      event: 'meeting.participant_joined',
      event_ts: 1784215028000,
      payload: {
        object: {
          id: '987654321',
          uuid: 'meeting_uuid_occurrence_alpha',
          occurrence_id: 'occurrence_20260716',
          participant: {
            registrant_id: 'registrant_alpha',
            participant_user_id: 'participant_alpha',
            user_name: 'Do Not Trust Display Name',
            join_time: '2026-07-16T16:01:00Z',
          },
        },
      },
    });
    const signature = zoomWebhookSignature({ rawBody: body, timestamp, secretToken });

    expect(
      verifyZoomWebhookSignature({
        rawBody: body,
        headers: { signature, timestamp },
        secretToken,
        now,
      }),
    ).toEqual({ ok: true });
    expect(
      verifyZoomWebhookSignature({
        rawBody: body,
        headers: { signature: 'v0=bad', timestamp },
        secretToken,
        now,
      }),
    ).toMatchObject({ ok: false, reason: 'invalid_signature' });

    const seen = new Set<string>();
    const accepted = processZoomWebhook({
      rawBody: body,
      headers: { signature, timestamp, requestId: 'zoom_request_001' },
      secretToken,
      seenEventKeys: seen,
      now,
    });
    const duplicate = processZoomWebhook({
      rawBody: body,
      headers: { signature, timestamp, requestId: 'zoom_request_001' },
      secretToken,
      seenEventKeys: seen,
      now,
    });

    expect(accepted).toMatchObject({
      status: 202,
      code: 'ACCEPTED',
      duplicate: false,
      projection: {
        event_type: 'meeting.participant_joined',
        occurrence_id: 'occurrence_20260716',
        attendance_state: 'joined',
      },
    });
    expect(accepted.projection?.registrant_id_digest).toMatch(/^[a-f0-9]{48}$/);
    expect(JSON.stringify(accepted)).not.toContain('Do Not Trust Display Name');
    expect(duplicate).toMatchObject({ status: 202, code: 'DUPLICATE', duplicate: true });

    const validationBody = JSON.stringify({
      event: 'endpoint.url_validation',
      payload: { plainToken: 'plain_token_test' },
    });
    const validationTimestamp = timestamp;
    const validation = processZoomWebhook({
      rawBody: validationBody,
      headers: {
        timestamp: validationTimestamp,
        signature: zoomWebhookSignature({
          rawBody: validationBody,
          timestamp: validationTimestamp,
          secretToken,
        }),
      },
      secretToken,
      now,
    });
    expect(validation).toMatchObject({
      status: 200,
      code: 'URL_VALIDATION',
      body: {
        plainToken: 'plain_token_test',
        encryptedToken: zoomWebhookUrlValidationToken('plain_token_test', secretToken),
      },
    });
  });

  it('caps learner launch grants at five minutes even if config asks for longer', async () => {
    const now = new Date('2026-07-16T16:05:00.000Z');
    const capturedExpiresAt: Date[] = [];
    const service = createClassroomService({
      config: loadConfig({
        NODE_ENV: 'test',
        ZOOM_CLASSROOM_ENABLED: 'true',
        ZOOM_CLASSROOM_PROVIDER_MODE: 'sink',
        ZOOM_CLASSROOM_JOIN_GRANT_TTL_SECONDS: '999',
      }),
      repository: grantCapturingRepository((expiresAt) => {
        capturedExpiresAt.push(expiresAt);
      }),
      questionCodec: new DeterministicTestPayloadCodec(),
      clock: () => now,
    });

    await service.issuePortalLaunch({
      actor: {
        account_key: 'one_time',
        product_key: 'one_time_mishnah_class',
        actor_user_ref: 'student_user',
        actor_role: 'student',
        session_key: 'session_alpha',
        capabilities: ['student:class:launch'],
        authorized_households: [],
        student_learner: {
          learner_key: 'learner_alpha',
          household_key: 'household_alpha',
          access_state_key: 'access_alpha',
        },
      },
      learner: {
        learner_key: 'learner_alpha',
        household_key: 'household_alpha',
        display_name: 'Alpha Learner',
        hebrew_name: null,
        grade_label: '6',
        learner_status: 'active',
        version: 1,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      class_key: 'class_occurrence_alpha',
      idempotency_key: 'launch_ttl_cap',
    });

    expect(capturedExpiresAt[0]?.getTime()).toBe(now.getTime() + 5 * 60_000);
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function grantCapturingRepository(onGrant: (expiresAt: Date) => void): ClassroomRepository {
  const occurrence = {
    occurrence_key: 'class_occurrence_alpha',
    class_series_key: 'class_series_alpha',
    title: 'Daily One Time Mishnayos',
    local_class_date: '2026-07-16',
    timezone: 'Asia/Jerusalem' as const,
    starts_at: '2026-07-16T16:00:00.000Z',
    reminder_due_at: '2026-07-16T15:30:00.000Z',
    join_opens_at: '2026-07-16T15:45:00.000Z',
    scheduled_ends_at: '2026-07-16T17:00:00.000Z',
    join_closes_at: '2026-07-16T17:15:00.000Z',
    occurrence_state: 'scheduled' as const,
    access_state: 'ready',
  };
  const eligibility = {
    account_key: 'one_time',
    product_key: 'one_time_mishnah_class',
    household_key: 'household_alpha',
    learner_key: 'learner_alpha',
    display_name: 'Alpha Learner',
    learner_status: 'active' as const,
    household_status: 'active' as const,
    student_access_status: 'active',
    entitlement_state: 'active' as const,
    consent_status: 'granted' as const,
    active_learner_count: 1,
  };
  return {
    ensureDailyOccurrence: async () => occurrence,
    getOccurrence: async () => occurrence,
    getLearnerEligibility: async () => eligibility,
    issueLaunchGrant: async (args) => {
      onGrant(args.expires_at);
      return {
        grant_key: args.grant_key,
        account_key: args.actor.account_key,
        product_key: args.actor.product_key,
        household_key: args.eligibility.household_key,
        learner_key: args.eligibility.learner_key,
        occurrence_key: args.occurrence.occurrence_key,
        actor_user_ref: args.actor.actor_user_ref,
        session_key_digest: args.session_key_digest,
        status: 'issued',
        idempotency_key: args.idempotency_key,
        provider_mode: args.provider_mode,
        expires_at: args.expires_at.toISOString(),
        consumed_at: null,
      };
    },
    consumeLaunchGrant: fail,
    upsertAttendanceAttempt: fail,
    recordAttendanceEvent: fail,
    submitQuestion: fail,
    listOwnQuestions: fail,
    moderateQuestion: fail,
    enqueueActionGatewayEvent: fail,
    scheduleDueReminders: fail,
    recordAudit: async () => undefined,
  };
}

async function fail(): Promise<never> {
  throw new Error('unexpected repository call');
}
