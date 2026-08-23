import { describe, expect, it } from 'vitest';
import {
  createZoomHostZakClient,
  createZoomRestClient,
  type ZoomFetch,
  type ZoomRestClientOptions,
} from '../../../packages/domain/src/providers/zoom-rest.ts';

const credentials = {
  accountId: 'account-reference',
  clientId: 'client-reference',
  clientSecret: 'client-secret-reference',
};

describe('production Zoom host ZAK capability', () => {
  it('permits only the fixed host ZAK GET after server-to-server authorization', async () => {
    const requests: Array<{ method: string; url: string }> = [];
    const fetchImpl: ZoomFetch = async (input, init) => {
      const url = String(input);
      requests.push({ method: init?.method ?? 'GET', url });
      if (url.startsWith('https://auth.zoom.test/oauth/token')) {
        return jsonResponse({ access_token: 'fake-access-token', expires_in: 3600 });
      }
      expect(init?.headers).toMatchObject({ authorization: 'Bearer fake-access-token' });
      return jsonResponse({ token: 'fake-host-zak-token-value' });
    };
    const client = createZoomHostZakClient({
      ...productionOptions(fetchImpl),
      apiBaseUrl: 'https://api.zoom.test/v2',
      oauthTokenUrl: 'https://auth.zoom.test/oauth/token',
      hostUserId: 'bound-host/reference',
    });

    await expect(client.getHostZakToken()).resolves.toBe('fake-host-zak-token-value');
    expect(Object.keys(client)).toEqual(['getHostZakToken']);
    expect(client).not.toHaveProperty('getMeeting');
    expect(client).not.toHaveProperty('createScheduledClassMeeting');
    expect(client).not.toHaveProperty('deleteMeeting');
    expect(requests).toEqual([
      {
        method: 'POST',
        url: 'https://auth.zoom.test/oauth/token?grant_type=account_credentials&account_id=account-reference',
      },
      {
        method: 'GET',
        url: 'https://api.zoom.test/v2/users/bound-host%2Freference/token?type=zak',
      },
    ]);
  });

  it('keeps every operation on the general Zoom REST client blocked in production', async () => {
    const requests: string[] = [];
    const client = createZoomRestClient(
      productionOptions(async (input) => {
        requests.push(String(input));
        throw new Error('production request must remain blocked');
      }),
    );
    expect(Object.keys(client)).toEqual([
      'createScheduledClassMeeting',
      'createIsolatedTestMeeting',
      'createDailyRecurringMeeting',
      'getMeeting',
      'addLearnerRegistrant',
      'enableMeetingRegistration',
      'disableMeetingRegistration',
      'deleteMeeting',
      'getHostZakToken',
    ]);
    const operations: Array<() => Promise<unknown>> = [
      () =>
        client.createScheduledClassMeeting({
          hostUserId: 'host',
          startsAt: new Date('2026-08-16T16:00:00.000Z'),
          topic: 'Class',
          durationMinutes: 60,
        }),
      () =>
        client.createIsolatedTestMeeting({
          hostUserId: 'host',
          startsAt: new Date('2026-08-16T16:00:00.000Z'),
          topic: 'Canary',
          durationMinutes: 60,
        }),
      () =>
        client.createDailyRecurringMeeting({
          hostUserId: 'host',
          localDate: '2026-08-16',
          topic: 'Class',
          durationMinutes: 60,
        }),
      () => client.getMeeting('meeting'),
      () =>
        client.addLearnerRegistrant({
          meetingId: 'meeting',
          learnerKey: 'learner',
          displayName: 'Learner',
          email: 'learner@example.test',
        }),
      () => client.enableMeetingRegistration('meeting'),
      () => client.disableMeetingRegistration('meeting'),
      () => client.deleteMeeting('meeting'),
      () => client.getHostZakToken('host'),
    ];

    for (const operation of operations) {
      await expect(operation()).rejects.toMatchObject({
        status: 503,
        code: 'ZOOM_PRODUCTION_BLOCKED',
      });
    }
    expect(requests).toEqual([]);
  });

  it('clamps provider authorization details into a safe host-ZAK code', async () => {
    const protectedProviderDetail = 'provider-detail-with-account-material';
    const client = createZoomHostZakClient({
      ...productionOptions(async (input) => {
        if (String(input).startsWith('https://zoom.us/oauth/token')) {
          return jsonResponse({ access_token: 'fake-access-token', expires_in: 3600 });
        }
        return jsonResponse(
          { code: protectedProviderDetail, message: protectedProviderDetail },
          403,
        );
      }),
      hostUserId: 'bound-host',
    });
    let serializedError = '';

    try {
      await client.getHostZakToken();
    } catch (error) {
      serializedError = JSON.stringify(error, Object.getOwnPropertyNames(error));
      expect(error).toMatchObject({
        status: 403,
        code: 'ZOOM_HOST_ZAK_NOT_AUTHORIZED',
        message: 'Zoom host authorization could not be issued.',
      });
    }
    expect(serializedError).not.toContain(protectedProviderDetail);
  });
});

function productionOptions(fetchImpl: ZoomFetch): ZoomRestClientOptions {
  return {
    credentials,
    environment: 'production',
    enabled: true,
    fetchImpl,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
