import { Buffer } from 'node:buffer';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createOt104rRealVimeoAdapter,
  createZoomRestClient,
} from '../../../packages/domain/src/index.ts';

type FakeProviderServer = {
  baseUrl: string;
  requests: Array<{
    method: string;
    path: string;
    authorization: string | null;
    body: unknown;
  }>;
  close(): Promise<void>;
};

const servers: FakeProviderServer[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await server.close();
  }
});

describe('W12-100 provider protocol fake servers', () => {
  it('exercises Zoom OAuth, meeting, and registrant calls without exposing raw provider URLs', async () => {
    const fake = await startZoomFakeServer();
    servers.push(fake);
    const client = createZoomRestClient({
      enabled: true,
      environment: 'staging',
      apiBaseUrl: `${fake.baseUrl}/v2`,
      oauthTokenUrl: `${fake.baseUrl}/oauth/token`,
      credentials: {
        accountId: 'acct_zoom_protocol',
        clientId: 'zoom_protocol_client',
        clientSecret: 'zoom_protocol_credential',
      },
    });

    const meeting = await client.createDailyRecurringMeeting({
      hostUserId: 'host_protocol_user',
      localDate: '2026-07-16',
      topic: 'Daily One Time Mishnayos',
      durationMinutes: 60,
    });
    const registrant = await client.addLearnerRegistrant({
      meetingId: meeting.meeting_id,
      occurrenceId: meeting.occurrences[0]?.occurrence_id ?? '',
      learnerKey: 'learner_protocol_alpha',
      displayName: 'Alpha Protocol',
      email: 'alpha.protocol@example.test',
    });

    expect(fake.requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      'POST /oauth/token?grant_type=account_credentials&account_id=acct_zoom_protocol',
      'POST /v2/users/host_protocol_user/meetings',
      'POST /v2/meetings/987654321/registrants?occurrence_ids=occurrence_protocol_20260716',
    ]);
    expect(meeting).toMatchObject({
      provider: 'zoom',
      timezone: 'Asia/Jerusalem',
      local_time: '19:00',
      raw_start_url_present: false,
      raw_join_url_present: false,
    });
    expect(registrant).toMatchObject({
      provider: 'zoom',
      learner_key: 'learner_protocol_alpha',
      registrant_token: 'REGISTRANT_PROTOCOL_TOKEN',
      raw_join_url_present: false,
    });
    expect(JSON.stringify({ meeting, registrant })).not.toMatch(
      /"(?:start_url|join_url)"|https?:\/\/[^"]*zoom\.us|pwd=|access_token|zoom_protocol_credential/i,
    );
    expect(
      JSON.stringify(fake.requests.map(({ authorization: _authorization, ...request }) => request)),
    ).not.toMatch(
      /"(?:start_url|join_url)"|https?:\/\/[^"]*zoom\.us|pwd=|access_token|zoom_protocol_credential/i,
    );
  });

  it('exercises Vimeo readiness, private video, upload intent, and text-track calls without leaking provider URLs', async () => {
    const fake = await startVimeoFakeServer();
    servers.push(fake);
    const adapter = createOt104rRealVimeoAdapter({
      apiBaseUrl: fake.baseUrl,
      env: {
        OT104R_VIMEO_PROVIDER_MODE: 'real',
        VIMEO_ACCESS_TOKEN: 'vimeo_protocol_access_fixture',
        VIMEO_CLIENT_ID: 'vimeo_protocol_client',
        VIMEO_CLIENT_SECRET: 'vimeo_protocol_credential',
        VIMEO_ACCOUNT_ID: 'vimeo_account_protocol',
        VIMEO_WEBHOOK_SECRET: 'vimeo_webhook_protocol_fixture',
      },
    });

    const readiness = await adapter.readiness();
    const inspected = await adapter.registerExistingPrivateVideo({
      account_key: 'rabbi_sheller_provider',
      product_key: 'one_time_mishnah_class',
      content_id: 'protocol_content_001',
      source_record_id: 'protocol_source_001',
      registration_mode: 'existing_private_video',
      provider_video_id: 'video_protocol_private',
      title: 'Protocol private class',
      source_sha256: 'a'.repeat(64),
      byte_length: 12345,
      submitted_by_actor_id: 'actor_protocol_owner',
      idempotency_key: 'protocol-vimeo-existing-001',
      correlation_id: 'corr_protocol_vimeo_existing',
    });
    const uploadIntent = await adapter.createUploadIntent({
      account_key: 'rabbi_sheller_provider',
      product_key: 'one_time_mishnah_class',
      content_id: 'protocol_content_upload',
      source_record_id: 'protocol_source_upload',
      registration_mode: 'controlled_upload',
      upload_filename: 'protocol-private-class.mp4',
      upload_size_bytes: 1024,
      title: 'Protocol upload class',
      source_sha256: 'b'.repeat(64),
      byte_length: 1024,
      submitted_by_actor_id: 'actor_protocol_owner',
      idempotency_key: 'protocol-vimeo-upload-001',
      correlation_id: 'corr_protocol_vimeo_upload',
    });
    const tracks = await adapter.listTextTracks('video_protocol_private');
    const track = await adapter.downloadTextTrack(
      'video_protocol_private',
      tracks[0]?.providerTextTrackId ?? '',
    );

    expect(fake.requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      'GET /me',
      'GET /videos/video_protocol_private',
      'POST /me/videos',
      'GET /videos/video_protocol_private/texttracks',
      'GET /videos/video_protocol_private/texttracks',
      'GET /videos/video_protocol_private/texttracks/track_protocol_001',
    ]);
    expect(readiness).toMatchObject({
      provider: 'vimeo',
      mode: 'real',
      state: 'ready',
      safe_reason_code: 'vimeo_account_readback_ready',
    });
    expect(inspected).toMatchObject({
      providerVideoId: 'video_protocol_private',
      privacyState: 'private',
      processingState: 'available',
    });
    expect(uploadIntent).toMatchObject({
      providerVideoId: 'video_protocol_upload',
      processingState: 'upload_authorized',
    });
    expect(track).toMatchObject({
      providerTextTrackId: 'track_protocol_001',
      mimeType: 'text/vtt',
    });
    expect(JSON.stringify({ readiness, inspected, uploadIntent, tracks, track })).not.toMatch(
      /https?:\/\/|Bearer|vimeo_protocol_access_fixture|vimeo_protocol_credential|upload_link|download_link/i,
    );
    expect(
      JSON.stringify(fake.requests.map(({ authorization: _authorization, ...request }) => request)),
    ).not.toMatch(
      /https?:\/\/|Bearer|vimeo_protocol_access_fixture|vimeo_protocol_credential|upload_link|download_link/i,
    );
  });
});

async function startZoomFakeServer(): Promise<FakeProviderServer> {
  const requests: FakeProviderServer['requests'] = [];
  const server = createServer(async (request, response) => {
    try {
      const path = request.url ?? '/';
      const body = await readRequestJson(request);
      requests.push({
        method: request.method ?? 'GET',
        path,
        authorization: request.headers.authorization ?? null,
        body,
      });

      if (request.method === 'POST' && path.startsWith('/oauth/token')) {
        expect(path).toContain('account_id=acct_zoom_protocol');
        expect(request.headers.authorization).toBe(
          `Basic ${Buffer.from('zoom_protocol_client:zoom_protocol_credential').toString('base64')}`,
        );
        return writeJson(response, {
          access_token: 'zoom_protocol_access_token',
          expires_in: 3600,
        });
      }

      if (request.method === 'POST' && path === '/v2/users/host_protocol_user/meetings') {
        expect(request.headers.authorization).toBe('Bearer zoom_protocol_access_token');
        expect(body).toMatchObject({
          type: 8,
          timezone: 'Asia/Jerusalem',
          start_time: '2026-07-16T16:00:00.000Z',
          settings: {
            registration_type: 2,
            registrants_confirmation_email: false,
            registrants_email_notification: false,
          },
        });
        return writeJson(response, {
          id: 987654321,
          type: 8,
          start_url: 'https://zoom.us/s/private-host-start',
          join_url: 'https://zoom.us/j/private-join',
          occurrences: [
            {
              occurrence_id: 'occurrence_protocol_20260716',
              start_time: '2026-07-16T16:00:00Z',
              status: 'available',
            },
          ],
        });
      }

      if (
        request.method === 'POST' &&
        path === '/v2/meetings/987654321/registrants?occurrence_ids=occurrence_protocol_20260716'
      ) {
        expect(request.headers.authorization).toBe('Bearer zoom_protocol_access_token');
        expect(body).toMatchObject({
          email: 'alpha.protocol@example.test',
          first_name: 'Alpha',
          last_name: 'Protocol',
          auto_approve: true,
        });
        return writeJson(response, {
          registrant_id: 'registrant_protocol_alpha',
          join_url: 'https://example.zoom.us/w/987654321?tk=REGISTRANT_PROTOCOL_TOKEN&pwd=private',
        });
      }

      return writeJson(response, { error: 'unexpected_zoom_route' }, 404);
    } catch (error) {
      return writeJson(response, { error: String(error) }, 500);
    }
  });
  return listen(server, requests);
}

async function startVimeoFakeServer(): Promise<FakeProviderServer> {
  const requests: FakeProviderServer['requests'] = [];
  const server = createServer(async (request, response) => {
    try {
      const path = request.url ?? '/';
      const body = await readRequestJson(request);
      requests.push({
        method: request.method ?? 'GET',
        path,
        authorization: request.headers.authorization ?? null,
        body,
      });
      expect(request.headers.authorization).toBe('Bearer vimeo_protocol_access_fixture');

      if (request.method === 'GET' && path === '/me') {
        return writeJson(response, { uri: '/users/vimeo_account_protocol' });
      }

      if (request.method === 'GET' && path === '/videos/video_protocol_private') {
        return writeJson(response, vimeoVideoPayload('video_protocol_private'));
      }

      if (request.method === 'POST' && path === '/me/videos') {
        expect(body).toMatchObject({
          upload: { approach: 'tus', size: 1024 },
          privacy: { view: 'nobody' },
        });
        return writeJson(response, {
          uri: '/videos/video_protocol_upload',
          upload: {
            approach: 'tus',
            upload_link: 'https://uploads.vimeo.example.test/private-ticket',
          },
        });
      }

      if (request.method === 'GET' && path === '/videos/video_protocol_private/texttracks') {
        return writeJson(response, {
          data: [
            {
              uri: '/videos/video_protocol_private/texttracks/track_protocol_001',
              language: 'en',
              type: 'captions',
              mime_type: 'text/vtt',
              modified_time: 'rev_track_protocol_001',
              link: 'https://vimeo.example.test/texttracks/private',
            },
          ],
        });
      }

      if (
        request.method === 'GET' &&
        path === '/videos/video_protocol_private/texttracks/track_protocol_001'
      ) {
        return writeJson(response, {
          text: 'WEBVTT\n\n00:00.000 --> 00:03.000\nApproved protocol caption.',
        });
      }

      return writeJson(response, { error: 'unexpected_vimeo_route' }, 404);
    } catch (error) {
      return writeJson(response, { error: String(error) }, 500);
    }
  });
  return listen(server, requests);
}

function vimeoVideoPayload(providerVideoId: string) {
  return {
    uri: `/videos/${providerVideoId}`,
    link: `https://vimeo.example.test/${providerVideoId}`,
    privacy: { view: 'nobody' },
    transcode: { status: 'complete' },
    duration: 61,
    width: 1280,
    height: 720,
    modified_time: 'rev_video_protocol_001',
  };
}

function listen(
  server: ReturnType<typeof createServer>,
  requests: FakeProviderServer['requests'],
): Promise<FakeProviderServer> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('missing fake provider port'));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        requests,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

async function readRequestJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? (JSON.parse(text) as unknown) : {};
}

function writeJson(response: ServerResponse, body: unknown, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}
