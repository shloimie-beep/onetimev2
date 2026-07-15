import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  ContentIdempotencyConflictError,
  activateTotpEnrollment,
  admitContentOutcome,
  createAccountUser,
  createContentPortalAccessAdapter,
  getContentItemDetail,
  listContentLibrary,
  provisionTotpEnrollment,
  totpCode,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;

const baseOutcome = {
  idempotency_key: 'content-outcome-001',
  item_key: 'recording_2026_07_15',
  title: 'July 15 recording',
  item_type: 'video' as const,
  revision_number: 1,
  lifecycle_state: 'published' as const,
  transcript_metadata: {
    summary: 'Safe transcript summary',
    transcript_url: 'https://vimeo.example.test/private/transcript',
  },
  source_metadata: {
    source_label: 'Local sink source',
    drive_url: 'https://drive.google.com/private/source',
  },
  review_sheet_metadata: {},
  playback_metadata: {
    provider: 'local_sink',
    provider_url: 'https://vimeo.example.test/private/play',
  },
  provider_event_ref: 'https://vimeo.example.test/events/private',
  source_ref: 'https://drive.google.com/private/source',
};

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('OT-71 content library outcome admission', () => {
  it('admits published content idempotently and stores only redacted provider metadata', async () => {
    const first = await admitContentOutcome({
      pool,
      config,
      payload: baseOutcome,
      actorUserKey: 'owner_user',
      now: new Date('2026-07-15T10:00:00.000Z'),
    });
    const replay = await admitContentOutcome({
      pool,
      config,
      payload: baseOutcome,
      actorUserKey: 'owner_user',
      now: new Date('2026-07-15T10:05:00.000Z'),
    });

    expect(first).toMatchObject({
      admission_state: 'accepted',
      lifecycle_state: 'published',
      raw_provider_target_present: false,
    });
    expect(first.redaction_count).toBeGreaterThan(0);
    expect(replay.admission_state).toBe('replayed');
    expect(replay.revision_key).toBe(first.revision_key);

    const detail = await getContentItemDetail({ pool, config, itemKey: baseOutcome.item_key });
    expect(detail?.latest_revision_number).toBe(1);
    expect(detail?.published_revision_key).toBe(first.revision_key);
    expect(JSON.stringify(detail)).not.toMatch(/https?:\/\/|vimeo|drive\.google/i);

    const providerRef = await pool.query(
      `SELECT provider_event_ref_digest, source_ref_digest
         FROM onetime.content_revisions
        WHERE revision_key = $1`,
      [first.revision_key],
    );
    expect(providerRef.rows[0].provider_event_ref_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(providerRef.rows[0].source_ref_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(providerRef.rows)).not.toMatch(/https?:\/\/|vimeo|drive/i);

    await expect(
      admitContentOutcome({
        pool,
        config,
        payload: { ...baseOutcome, title: 'Changed title' },
      }),
    ).rejects.toBeInstanceOf(ContentIdempotencyConflictError);
  });

  it('keeps newer revisions authoritative and records older arrivals as stale superseded outcomes', async () => {
    const revision2 = await admitContentOutcome({
      pool,
      config,
      payload: {
        ...baseOutcome,
        idempotency_key: 'content-revision-002',
        item_key: 'recording_revision_order',
        revision_number: 2,
      },
      now: new Date('2026-07-15T10:00:00.000Z'),
    });
    const staleRevision1 = await admitContentOutcome({
      pool,
      config,
      payload: {
        ...baseOutcome,
        idempotency_key: 'content-revision-001-late',
        item_key: 'recording_revision_order',
        revision_number: 1,
      },
      now: new Date('2026-07-15T10:10:00.000Z'),
    });
    const revision3 = await admitContentOutcome({
      pool,
      config,
      payload: {
        ...baseOutcome,
        idempotency_key: 'content-revision-003',
        item_key: 'recording_revision_order',
        revision_number: 3,
        lifecycle_state: 'review_needed',
      },
      now: new Date('2026-07-15T10:20:00.000Z'),
    });

    expect(revision2.admission_state).toBe('accepted');
    expect(staleRevision1).toMatchObject({
      admission_state: 'ignored_stale',
      lifecycle_state: 'superseded',
    });
    expect(revision3.admission_state).toBe('accepted');

    const detail = await getContentItemDetail({
      pool,
      config,
      itemKey: 'recording_revision_order',
    });
    expect(detail).toMatchObject({
      lifecycle_state: 'review_needed',
      latest_revision_number: 3,
      published_revision_key: revision2.revision_key,
    });
    const revisionStates = await pool.query(
      `SELECT revision_number, lifecycle_state
         FROM onetime.content_revisions
        WHERE content_item_key = 'recording_revision_order'
        ORDER BY revision_number`,
    );
    expect(
      revisionStates.rows.map((row) => `${row.revision_number}:${row.lifecycle_state}`),
    ).toEqual(['1:superseded', '2:superseded', '3:review_needed']);
  });

  it('returns only published entitled portal items with protected local actions', async () => {
    await admitContentOutcome({
      pool,
      config,
      payload: { ...baseOutcome, idempotency_key: 'portal-video-001', item_key: 'portal_video' },
    });
    await admitContentOutcome({
      pool,
      config,
      payload: {
        ...baseOutcome,
        idempotency_key: 'portal-review-001',
        item_key: 'portal_review',
        title: 'Review sheet',
        item_type: 'review',
      },
    });
    await admitContentOutcome({
      pool,
      config,
      payload: {
        ...baseOutcome,
        idempotency_key: 'portal-hidden-001',
        item_key: 'portal_hidden',
        entitlement_scope: 'none',
      },
    });
    await admitContentOutcome({
      pool,
      config,
      payload: {
        ...baseOutcome,
        idempotency_key: 'portal-draft-001',
        item_key: 'portal_draft',
        lifecycle_state: 'review_needed',
      },
    });

    const adapter = createContentPortalAccessAdapter({ pool, config });
    const actor = {
      account_key: config.accountKey,
      product_key: config.productKey,
      actor_user_ref: 'student_user_alpha',
      actor_role: 'student' as const,
      session_key: 'student_session_alpha',
      capabilities: ['student:dashboard:read' as const],
      authorized_households: [],
      student_learner: {
        learner_key: 'learner_alpha',
        household_key: 'household_alpha',
        access_state_key: 'access_alpha',
      },
    };
    const learner = {
      learner_key: 'learner_alpha',
      household_key: 'household_alpha',
      display_name: 'Alpha Learner',
      hebrew_name: null,
      grade_label: null,
      learner_status: 'active' as const,
      version: 1,
      created_at: '2026-07-15T09:00:00.000Z',
      updated_at: '2026-07-15T09:00:00.000Z',
    };
    const library = await adapter.publishedLibraryForLearner({ actor, learner });
    const reviews = await adapter.reviewSheetsForLearner({ actor, learner });

    expect(library.map((item) => item.item_key)).toEqual(['portal_video']);
    expect(reviews.map((item) => item.item_key)).toEqual(['portal_review']);
    expect(JSON.stringify({ library, reviews })).not.toMatch(/https?:\/\/|vimeo|drive|zoom/i);
    expect(library[0]?.open_action?.href).toBe('/api/v1/content/library/portal_video/open');
    expect(reviews[0]?.open_action?.kind).toBe('review_sheet_open');
  });

  it('bounds owner library reads even when the library has more records', async () => {
    for (let index = 0; index < 55; index += 1) {
      await admitContentOutcome({
        pool,
        config,
        payload: {
          ...baseOutcome,
          idempotency_key: `bounded-content-${index.toString().padStart(2, '0')}`,
          item_key: `bounded_content_${index.toString().padStart(2, '0')}`,
          title: `Bounded content ${index}`,
        },
      });
    }

    const limited = await listContentLibrary({ pool, config, query: { limit: 50 } });
    const tiny = await listContentLibrary({ pool, config, query: { limit: 2 } });
    expect(limited).toHaveLength(50);
    expect(tiny).toHaveLength(2);
  });
});

describe('OT-71 content library APIs', () => {
  it('requires owner/admin sessions and CSRF for local outcome admission', async () => {
    const ownerUserKey = await createAccountUser({
      pool,
      config,
      email: 'owner@example.test',
      password: 'OwnerPass!234',
      displayName: 'Owner User',
      role: 'owner',
      mfaCapable: true,
    });
    const ownerEnrollment = await provisionTotpEnrollment({
      pool,
      config,
      userKey: ownerUserKey,
    });
    const ownerActivation = await activateTotpEnrollment({
      pool,
      config,
      enrollmentToken: ownerEnrollment.enrollmentToken,
      code: totpCode(ownerEnrollment.secret),
    });
    expect(ownerActivation).not.toBe(false);
    await createAccountUser({
      pool,
      config,
      email: 'viewer@example.test',
      password: 'ViewerPass!234',
      displayName: 'Viewer User',
      role: 'viewer',
      mfaCapable: false,
    });
    const server = await listenForTest(createApp({ config, pool }));
    try {
      const owner = await loginAs(server.baseUrl, 'owner@example.test', 'OwnerPass!234', {
        totpSecret: ownerEnrollment.secret,
      });
      const missingCsrf = await fetch(`${server.baseUrl}/api/v1/content/outcomes`, {
        method: 'POST',
        headers: {
          cookie: owner.cookies,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ...baseOutcome, idempotency_key: 'api-content-missing-csrf' }),
      });
      expect(missingCsrf.status).toBe(403);

      const admitted = await fetch(`${server.baseUrl}/api/v1/content/outcomes`, {
        method: 'POST',
        headers: {
          cookie: owner.cookies,
          'content-type': 'application/json',
          'x-csrf-token': owner.json.csrf_token,
        },
        body: JSON.stringify({ ...baseOutcome, idempotency_key: 'api-content-001' }),
      });
      const admittedText = await admitted.text();
      expect(admitted.status, admittedText).toBe(202);
      expect(admitted.headers.get('cache-control')).toContain('no-store');
      const admittedJson = JSON.parse(admittedText) as {
        success: true;
        outcome: { admission_state: string; item_key: string };
      };
      expect(admittedJson.outcome).toMatchObject({
        admission_state: 'accepted',
        item_key: baseOutcome.item_key,
      });

      const list = await fetch(`${server.baseUrl}/api/v1/content/library?limit=2`, {
        headers: { cookie: owner.cookies },
      });
      expect(list.status).toBe(200);
      const listJson = (await list.json()) as { success: true; items: Array<{ item_key: string }> };
      expect(listJson.items.map((item) => item.item_key)).toEqual([baseOutcome.item_key]);

      const detail = await fetch(
        `${server.baseUrl}/api/v1/content/library/${encodeURIComponent(baseOutcome.item_key)}`,
        { headers: { cookie: owner.cookies } },
      );
      expect(detail.status).toBe(200);
      const detailJson = await detail.json();
      expect(JSON.stringify(detailJson)).not.toMatch(/https?:\/\/|vimeo|drive\.google/i);

      const conflict = await fetch(`${server.baseUrl}/api/v1/content/outcomes`, {
        method: 'POST',
        headers: {
          cookie: owner.cookies,
          'content-type': 'application/json',
          'x-csrf-token': owner.json.csrf_token,
        },
        body: JSON.stringify({
          ...baseOutcome,
          idempotency_key: 'api-content-001',
          title: 'Changed title',
        }),
      });
      expect(conflict.status).toBe(409);

      const viewer = await loginAs(server.baseUrl, 'viewer@example.test', 'ViewerPass!234');
      const denied = await fetch(`${server.baseUrl}/api/v1/content/library`, {
        headers: { cookie: viewer.cookies },
      });
      expect(denied.status).toBe(403);
    } finally {
      await server.close();
    }
  });
});

async function listenForTest(app: ReturnType<typeof createApp>) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function loginAs(
  baseUrl: string,
  email: string,
  password: string,
  options: { totpSecret?: string } = {},
) {
  const csrf = await getLoginCsrf(baseUrl);
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      cookie: csrf.cookies,
      'content-type': 'application/json',
      'x-csrf-token': csrf.token,
    },
    body: JSON.stringify({ email, password, csrf_token: csrf.token }),
  });
  if (response.status === 403 && options.totpSecret) {
    const challenge = (await response.json()) as { code?: string; challenge_token?: string };
    expect(challenge.code).toBe('MFA_REQUIRED');
    expect(challenge.challenge_token).toBeTruthy();
    const mfa = await fetch(`${baseUrl}/api/v1/auth/mfa/challenge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        challenge_token: challenge.challenge_token,
        totp_code: totpCode(options.totpSecret),
      }),
    });
    expect(mfa.status).toBe(200);
    return {
      cookies: mergeCookies(csrf.cookies, cookieHeader(mfa.headers)),
      json: (await mfa.json()) as { csrf_token: string },
    };
  }
  expect(response.status).toBe(200);
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    json: (await response.json()) as { csrf_token: string },
  };
}

async function getLoginCsrf(baseUrl: string) {
  const page = await fetch(`${baseUrl}/login`);
  const html = await page.text();
  const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error('missing csrf token');
  return { token, cookies: cookieHeader(page.headers) };
}

function cookieHeader(headers: Headers) {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

function mergeCookies(...headers: string[]) {
  const cookies = new Map<string, string>();
  for (const header of headers) {
    for (const part of header.split(';')) {
      const [key, value] = part.trim().split('=');
      if (key && value) cookies.set(key, value);
    }
  }
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}
