import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  OT104R_ACCOUNT_KEY,
  OT104R_PRODUCT_KEY,
  OT104R_TRANSCRIPT_MAX_BYTES,
  Ot104rVimeoRuntimeError,
  createOt104rSinkVimeoAdapter,
  importOt104rVimeoTextTrack,
  inspectOt104rVimeoReadinessFromEnv,
  projectOt104rPlaybackAccess,
  receiveOt104rVimeoWebhook,
  reconcileNextOt104rVimeoSource,
  registerOt104rVimeoSource,
  retryOt104rVimeoSource,
  signOt104rVimeoWebhook,
  type Ot104rVimeoAdapter,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;

const WEBHOOK_SECRET = 'test-only-ot104r-vimeo-webhook-secret';
const now = new Date('2026-07-16T12:00:00.000Z');

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('OT-104R Vimeo private runtime registration and projections', () => {
  it('registers existing private videos and controlled uploads in the One Time scope without returning raw provider credentials', async () => {
    const adapter = createOt104rSinkVimeoAdapter();
    const registered = await registerOt104rVimeoSource({
      pool,
      adapter,
      command: sourceCommand(),
      now,
    });
    const replay = await registerOt104rVimeoSource({
      pool,
      adapter,
      command: sourceCommand(),
      now: new Date('2026-07-16T12:01:00.000Z'),
    });
    const upload = await registerOt104rVimeoSource({
      pool,
      adapter,
      command: sourceCommand({
        idempotency_key: 'idem_ot104r_upload_001',
        content_id: 'ot104r_content_upload_001',
        source_record_id: 'ot104r_source_upload_001',
        registration_mode: 'controlled_upload',
        provider_video_id: undefined,
        upload_filename: 'rabbi-class-private.mp4',
        upload_size_bytes: 1_048_576,
      }),
      now,
    });

    expect(registered).toMatchObject({
      duplicate: false,
      account_key: OT104R_ACCOUNT_KEY,
      product_key: OT104R_PRODUCT_KEY,
      processing_state: 'available',
      provider_video_id_present: true,
    });
    expect(replay).toMatchObject({ duplicate: true, source_key: registered.source_key });
    expect(upload).toMatchObject({
      registration_mode: 'controlled_upload',
      processing_state: 'upload_authorized',
      provider_upload_id_present: true,
    });
    expect(JSON.stringify({ registered, replay, upload })).not.toMatch(
      /https?:\/\/|Bearer|upload_link|vimeo\.com/i,
    );

    const projection = await projectOt104rPlaybackAccess({
      pool,
      sourceKey: registered.source_key,
      principalId: 'student_learner_001',
      now,
    });
    expect(projection).toMatchObject({
      playback_kind: 'server_authorized_vimeo_playback',
      playback_route: `/api/v1/content/vimeo/${registered.source_key}/playback`,
      provider_video_id_present: true,
    });
    expect(JSON.stringify(projection)).not.toMatch(/video_private_001|https?:\/\//i);

    const rows = await pool.query(
      `SELECT account_key, product_key, provider_video_id, provider_upload_id
         FROM onetime.ot104r_vimeo_sources
        ORDER BY created_at ASC`,
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.every((row) => row.account_key === OT104R_ACCOUNT_KEY)).toBe(true);
    expect(rows.rows.every((row) => row.product_key === OT104R_PRODUCT_KEY)).toBe(true);

    await expect(
      registerOt104rVimeoSource({
        pool,
        adapter,
        command: sourceCommand({ product_key: 'academy_content' }),
      }),
    ).rejects.toThrow();
    await expect(
      registerOt104rVimeoSource({
        pool,
        adapter,
        command: sourceCommand({ provider_video_id: 'https://vimeo.com/123456789' }),
      }),
    ).rejects.toMatchObject({ code: 'RAW_PROVIDER_URL_REJECTED' });
  });

  it('reports provider-off readiness with exact missing Vimeo variable names', () => {
    const readiness = inspectOt104rVimeoReadinessFromEnv({
      OT104R_VIMEO_PROVIDER_MODE: 'off',
    });
    expect(readiness).toMatchObject({
      provider: 'vimeo',
      mode: 'off',
      state: 'off',
      configured: false,
      safe_reason_code: 'real_vimeo_provider_mode_disabled',
    });
    expect(readiness.missing_variable_names.sort()).toEqual(
      [
        'VIMEO_ACCESS_TOKEN',
        'VIMEO_ACCOUNT_ID',
        'VIMEO_CLIENT_ID',
        'VIMEO_CLIENT_SECRET',
        'VIMEO_WEBHOOK_SECRET',
      ].sort(),
    );
  });
});

describe('OT-104R Vimeo webhook verification and receipt handling', () => {
  it('rejects signature, replay, content-type, size, and scope failures while safely acknowledging unknown events', async () => {
    const adapter = createOt104rSinkVimeoAdapter();
    const registered = await registerOt104rVimeoSource({
      pool,
      adapter,
      command: sourceCommand(),
      now,
    });
    const payload = webhookPayload({
      id: 'evt_ot104r_001',
      type: 'video.transcode.complete',
    });
    const rawBody = Buffer.from(JSON.stringify(payload));
    const headers = signedHeaders(rawBody);

    const badSignature = await receiveOt104rVimeoWebhook({
      pool,
      rawBody,
      headers: { ...headers, signature: `v1=${'0'.repeat(64)}` },
      secret: WEBHOOK_SECRET,
      expectedAccountId: 'vimeo_account_001',
      now,
    });
    expect(badSignature).toMatchObject({ status: 401, code: 'unauthorized' });
    expect(await countRows('onetime.ot104r_vimeo_webhook_receipts')).toBe(0);

    const accepted = await receiveOt104rVimeoWebhook({
      pool,
      rawBody,
      headers,
      secret: WEBHOOK_SECRET,
      expectedAccountId: 'vimeo_account_001',
      now,
    });
    expect(accepted).toMatchObject({ status: 202, receipt_state: 'processed' });
    const sourceAfterWebhook = await sourceRow(registered.source_key);
    expect(sourceAfterWebhook.processing_state).toBe('available');

    const duplicate = await receiveOt104rVimeoWebhook({
      pool,
      rawBody,
      headers,
      secret: WEBHOOK_SECRET,
      expectedAccountId: 'vimeo_account_001',
      now,
    });
    expect(duplicate).toMatchObject({ status: 200, receipt_state: 'duplicate' });

    const changedRaw = Buffer.from(
      JSON.stringify(webhookPayload({ id: 'evt_ot104r_001', type: 'video.transcode.error' })),
    );
    const conflict = await receiveOt104rVimeoWebhook({
      pool,
      rawBody: changedRaw,
      headers: signedHeaders(changedRaw),
      secret: WEBHOOK_SECRET,
      expectedAccountId: 'vimeo_account_001',
      now,
    });
    expect(conflict).toMatchObject({ status: 409, receipt_state: 'conflict' });

    const unknownRaw = Buffer.from(
      JSON.stringify(webhookPayload({ id: 'evt_ot104r_unknown_001', type: 'comment.created' })),
    );
    const unknown = await receiveOt104rVimeoWebhook({
      pool,
      rawBody: unknownRaw,
      headers: signedHeaders(unknownRaw),
      secret: WEBHOOK_SECRET,
      expectedAccountId: 'vimeo_account_001',
      now,
    });
    expect(unknown).toMatchObject({ status: 200, code: 'unknown_event_recorded' });

    const wrongAccountRaw = Buffer.from(
      JSON.stringify(
        webhookPayload({
          id: 'evt_ot104r_wrong_account_001',
          type: 'video.upload.complete',
          account_id: 'other_vimeo_account',
        }),
      ),
    );
    const wrongAccount = await receiveOt104rVimeoWebhook({
      pool,
      rawBody: wrongAccountRaw,
      headers: signedHeaders(wrongAccountRaw),
      secret: WEBHOOK_SECRET,
      expectedAccountId: 'vimeo_account_001',
      now,
    });
    expect(wrongAccount).toMatchObject({ status: 202, code: 'wrong_account_ignored' });
    expect((await sourceRow(registered.source_key)).processing_state).toBe('available');

    const staleHeaders = signedHeaders(rawBody, '1784202000');
    const stale = await receiveOt104rVimeoWebhook({
      pool,
      rawBody,
      headers: staleHeaders,
      secret: WEBHOOK_SECRET,
      expectedAccountId: 'vimeo_account_001',
      now,
    });
    expect(stale).toMatchObject({ status: 401 });

    const wrongType = await receiveOt104rVimeoWebhook({
      pool,
      rawBody,
      headers: { ...headers, contentType: 'text/plain' },
      secret: WEBHOOK_SECRET,
      expectedAccountId: 'vimeo_account_001',
      now,
    });
    expect(wrongType).toMatchObject({ status: 415 });

    const tooLarge = await receiveOt104rVimeoWebhook({
      pool,
      rawBody: Buffer.alloc(300 * 1024, 'a'),
      headers,
      secret: WEBHOOK_SECRET,
      expectedAccountId: 'vimeo_account_001',
      now,
    });
    expect(tooLarge).toMatchObject({ status: 413 });

    const receipts = await pool.query(`SELECT * FROM onetime.ot104r_vimeo_webhook_receipts`);
    expect(JSON.stringify(receipts.rows)).not.toMatch(/https?:\/\/|Bearer|webhook-secret/i);
  });
});

describe('OT-104R Vimeo reconciliation leases and text-track imports', () => {
  it('polls with bounded backoff, clears leases, dead-letters terminal failures, and supports operator retry', async () => {
    const adapter = createOt104rSinkVimeoAdapter({
      inspections: [
        inspection('video_retry_001', 'transcoding'),
        inspection('video_retry_001', 'transcoding'),
        inspection('video_retry_001', 'available'),
      ],
    });
    const registered = await registerOt104rVimeoSource({
      pool,
      adapter,
      command: sourceCommand({
        idempotency_key: 'idem_ot104r_retry_001',
        content_id: 'ot104r_content_retry_001',
        source_record_id: 'ot104r_source_retry_001',
        provider_video_id: 'video_retry_001',
      }),
      now,
    });

    const first = await reconcileNextOt104rVimeoSource({ pool, adapter, now });
    expect(first).toMatchObject({ inspected: 1, retrying: 1, ready: 0 });
    const waiting = await sourceRow(registered.source_key);
    expect(waiting.processing_state).toBe('transcoding');
    expect(waiting.lease_owner).toBe(null);
    expect(new Date(String(waiting.next_reconcile_at)).getTime()).toBeGreaterThan(now.getTime());

    const second = await reconcileNextOt104rVimeoSource({
      pool,
      adapter,
      now: new Date('2026-07-16T12:02:00.000Z'),
    });
    expect(second).toMatchObject({ inspected: 1, ready: 1 });
    expect((await sourceRow(registered.source_key)).processing_state).toBe('available');

    const failingRegistrationAdapter = createOt104rSinkVimeoAdapter({
      inspections: [inspection('video_dead_001', 'transcoding')],
    });
    const failingAdapter = throwingAdapter();
    const failing = await registerOt104rVimeoSource({
      pool,
      adapter: failingRegistrationAdapter,
      command: sourceCommand({
        idempotency_key: 'idem_ot104r_dead_001',
        content_id: 'ot104r_content_dead_001',
        source_record_id: 'ot104r_source_dead_001',
        provider_video_id: 'video_dead_001',
      }),
      now,
    });
    const dead = await reconcileNextOt104rVimeoSource({
      pool,
      adapter: failingAdapter,
      now,
      maxAttempts: 1,
    });
    expect(dead).toMatchObject({ inspected: 1, dead_lettered: 1 });
    expect((await sourceRow(failing.source_key)).processing_state).toBe('dead_lettered');

    const retry = await retryOt104rVimeoSource({
      pool,
      sourceKey: failing.source_key,
      actorId: 'actor_owner_admin_001',
      reasonCode: 'operator_checked_fixture',
      correlationId: 'corr_ot104r_retry_dead_001',
      now,
    });
    expect(retry).toMatchObject({ retry_scheduled: true });
    expect((await sourceRow(failing.source_key)).processing_state).toBe('retry_wait');
  });

  it('imports approved text tracks with size, type, UTF-8, revision, and leakage checks', async () => {
    const adapter = createOt104rSinkVimeoAdapter({
      textTracks: [
        {
          providerTextTrackId: 'track_private_001',
          language: 'en',
          kind: 'captions',
          mimeType: 'text/vtt',
          revision: 'rev_track_001',
          body: 'WEBVTT\r\n\r\n00:00.000 --> 00:10.000\r\nRabbi Scheller opens the Mishnah.   \r\n',
          safeMetadata: {
            download_url: 'https://vimeo.example.test/private-caption.vtt',
          },
        },
      ],
    });
    const registered = await registerOt104rVimeoSource({
      pool,
      adapter,
      command: sourceCommand(),
      now,
    });
    const imported = await importOt104rVimeoTextTrack({
      pool,
      adapter,
      sourceKey: registered.source_key,
      providerTextTrackId: 'track_private_001',
      actorId: 'actor_owner_admin_001',
      correlationId: 'corr_ot104r_track_001',
      now,
    });
    expect(imported).toMatchObject({
      provider_text_track_id_present: true,
      byte_length: expect.any(Number),
    });
    expect((await sourceRow(registered.source_key)).processing_state).toBe('transcript_ready');
    const tracks = await pool.query(`SELECT * FROM onetime.ot104r_vimeo_text_tracks`);
    expect(tracks.rows[0].normalized_text).toContain('Rabbi Scheller opens the Mishnah.');
    expect(tracks.rows[0].normalized_text).not.toContain('\r');
    expect(JSON.stringify(tracks.rows)).not.toMatch(/https?:\/\/|vimeo\.example|Bearer/i);

    const badType = createOt104rSinkVimeoAdapter({
      textTracks: [
        {
          providerTextTrackId: 'track_bad_type',
          language: 'en',
          kind: 'captions',
          mimeType: 'application/json',
          revision: 'rev_bad_type',
          body: '{"not":"captions"}',
        },
      ],
    });
    await expect(
      importOt104rVimeoTextTrack({
        pool,
        adapter: badType,
        sourceKey: registered.source_key,
        providerTextTrackId: 'track_bad_type',
        actorId: 'actor_owner_admin_001',
        correlationId: 'corr_bad_type',
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_TRANSCRIPT_CONTENT_TYPE' });

    const tooLarge = createOt104rSinkVimeoAdapter({
      textTracks: [
        {
          providerTextTrackId: 'track_too_large',
          language: 'en',
          kind: 'captions',
          mimeType: 'text/plain',
          revision: 'rev_too_large',
          body: Buffer.alloc(OT104R_TRANSCRIPT_MAX_BYTES + 1, 'a'),
        },
      ],
    });
    await expect(
      importOt104rVimeoTextTrack({
        pool,
        adapter: tooLarge,
        sourceKey: registered.source_key,
        providerTextTrackId: 'track_too_large',
        actorId: 'actor_owner_admin_001',
        correlationId: 'corr_too_large',
      }),
    ).rejects.toMatchObject({ code: 'TRANSCRIPT_TOO_LARGE' });

    const invalidUtf8 = createOt104rSinkVimeoAdapter({
      textTracks: [
        {
          providerTextTrackId: 'track_bad_utf8',
          language: 'en',
          kind: 'captions',
          mimeType: 'text/vtt',
          revision: 'rev_bad_utf8',
          body: Buffer.from([0xff, 0xfe, 0xfd]),
        },
      ],
    });
    await expect(
      importOt104rVimeoTextTrack({
        pool,
        adapter: invalidUtf8,
        sourceKey: registered.source_key,
        providerTextTrackId: 'track_bad_utf8',
        actorId: 'actor_owner_admin_001',
        correlationId: 'corr_bad_utf8',
      }),
    ).rejects.toMatchObject({ code: 'TRANSCRIPT_ENCODING_INVALID' });
  });
});

function sourceCommand(overrides: Record<string, unknown> = {}) {
  return {
    account_key: OT104R_ACCOUNT_KEY,
    product_key: OT104R_PRODUCT_KEY,
    idempotency_key: 'idem_ot104r_existing_001',
    content_id: 'ot104r_content_existing_001',
    source_record_id: 'ot104r_source_existing_001',
    title: 'Private Rabbi class recording',
    source_sha256: digest('private rabbi class source'),
    byte_length: 1_048_576,
    submitted_by_actor_id: 'actor_owner_admin_001',
    registration_mode: 'existing_private_video',
    provider_video_id: 'video_private_001',
    correlation_id: 'corr_ot104r_existing_001',
    ...overrides,
  };
}

function webhookPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_ot104r_base',
    type: 'video.transcode.complete',
    account_id: 'vimeo_account_001',
    video: {
      uri: '/videos/video_private_001',
      modified_time: '2026-07-16T12:00:00.000Z',
    },
    ...overrides,
  };
}

function signedHeaders(rawBody: Buffer, timestamp = String(Math.floor(now.getTime() / 1000))) {
  return {
    contentType: 'application/json',
    timestamp,
    signature: signOt104rVimeoWebhook({ secret: WEBHOOK_SECRET, timestamp, rawBody }),
  };
}

function inspection(
  providerVideoId: string,
  processingState: 'uploading' | 'transcoding' | 'available' | 'failed',
) {
  return {
    providerVideoId,
    privacyState: 'private' as const,
    processingState,
    durationMs: processingState === 'available' ? 90_000 : null,
    width: 1280,
    height: 720,
    revision: `rev_${providerVideoId}_${processingState}`,
    safeMetadata: { status: processingState },
  };
}

function throwingAdapter(): Ot104rVimeoAdapter {
  const base = createOt104rSinkVimeoAdapter();
  return {
    ...base,
    async inspectVideo() {
      const credentialLikeText = ['Bearer', 'abcdefghijklmnopqrstuvwxyz0123456789'].join(' ');
      throw new Ot104rVimeoRuntimeError(
        'VIMEO_TRANSIENT_FAILURE',
        `${credentialLikeText} https://vimeo.example/private`,
        503,
      );
    },
  };
}

async function sourceRow(sourceKey: string) {
  const result = await pool.query(
    `SELECT *
       FROM onetime.ot104r_vimeo_sources
      WHERE source_key = $1`,
    [sourceKey],
  );
  if (!result.rowCount) throw new Error(`missing source ${sourceKey}`);
  return result.rows[0] as Record<string, unknown>;
}

async function countRows(tableAndPredicate: string) {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${tableAndPredicate}`);
  const count = Array.isArray(result.rows[0]?.count)
    ? result.rows[0]?.count[0]
    : result.rows[0]?.count;
  return Number(count ?? 0);
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
