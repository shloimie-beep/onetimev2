import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  ExistingVimeoAdoptionError,
  adoptExistingPrivateVimeo,
  createAccountUser,
  createContentPortalAccessAdapter,
  createExistingVimeoProtectionReader,
  decryptAuthEmailChallengeDeliveryPayloadForTests,
  getExistingPrivateVimeoPlayback,
  unpublishExistingPrivateVimeo,
  type ExistingVimeoProtectionReadback,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;

const now = new Date('2026-08-12T12:00:00.000Z');
const command = {
  provider_video_id: '1234567890',
  title: 'Mishnayos Sunday class',
  source_sha256: 'a'.repeat(64),
  reviewed_source_digest: 'b'.repeat(64),
  idempotency_key: 'existing-vimeo-sunday-001',
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

describe('existing protected Vimeo adoption', () => {
  it('materializes the existing Student Library idempotently without a raw provider target', async () => {
    const reader = { inspect: vi.fn(async () => protectedReadback()) };
    const adopted = await adoptExistingPrivateVimeo({
      pool,
      config,
      actorUserKey: 'rabbi_operator',
      actorRole: 'rabbi',
      command,
      reader,
      now,
    });
    const replay = await adoptExistingPrivateVimeo({
      pool,
      config,
      actorUserKey: 'rabbi_operator',
      actorRole: 'rabbi',
      command,
      reader,
      now: new Date('2026-08-12T12:05:00.000Z'),
    });

    expect(adopted).toMatchObject({
      state: 'published',
      replay: false,
      privacy_contract: 'embed_only_domain_whitelist',
      entitled_audience: 'all_active_learners',
      raw_provider_url_present: false,
    });
    expect(replay).toMatchObject({ item_key: adopted.item_key, replay: true });
    expect(JSON.stringify({ adopted, replay })).not.toMatch(/1234567890|https?:\/\//i);

    const visibleRows = await pool.query(
      `SELECT item.metadata, revision.source_metadata, revision.playback_descriptor,
              revision.provider_event_ref_digest, revision.raw_provider_target_present,
              entitlement.audience, entitlement.entitlement_state
         FROM onetime.content_items AS item
         JOIN onetime.content_revisions AS revision
           ON revision.revision_key = item.published_revision_key
         JOIN onetime.content_item_entitlements AS entitlement
           ON entitlement.content_item_key = item.content_item_key
        WHERE item.content_item_key = $1`,
      [adopted.item_key],
    );
    expect(visibleRows.rows).toHaveLength(1);
    expect(visibleRows.rows[0]).toMatchObject({
      raw_provider_target_present: false,
      audience: 'all_active_learners',
      entitlement_state: 'active',
    });
    expect(JSON.stringify(visibleRows.rows)).not.toMatch(/1234567890|https?:\/\/|vimeo\.com/i);

    const providerSource = await pool.query(
      `SELECT account_key, product_key, provider_video_id, sanitized_metadata_json
         FROM onetime.ot104r_vimeo_sources
        WHERE source_key = $1`,
      [adopted.item_key],
    );
    expect(providerSource.rows[0]).toMatchObject({
      account_key: 'rabbi_sheller_provider',
      product_key: 'one_time_mishnah_class',
      provider_video_id: command.provider_video_id,
    });
    expect(JSON.stringify(providerSource.rows[0].sanitized_metadata_json)).not.toMatch(
      /1234567890|https?:\/\//i,
    );

    await expect(
      getExistingPrivateVimeoPlayback({
        pool,
        config,
        itemKey: adopted.item_key,
        actor: studentActor(),
        now,
      }),
    ).rejects.toMatchObject({ code: 'CONTENT_UNAVAILABLE', httpStatus: 404 });

    await grantHouseholdCurrentAccess('household_alpha');
    const actor = studentActor();
    const learner = {
      learner_key: 'learner_alpha',
      household_key: 'household_alpha',
      display_name: 'Alpha Learner',
      hebrew_name: null,
      grade_label: null,
      learner_status: 'active' as const,
      version: 1,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const adapter = createContentPortalAccessAdapter({ pool, config });
    const library = await adapter.publishedLibraryForLearner({ actor, learner });
    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({
      item_key: adopted.item_key,
      protected_vimeo: {
        playback_route: adopted.playback_route,
        privacy_contract: 'embed_only_domain_whitelist',
        raw_provider_url_present: false,
      },
      open_action: {
        href: `/api/v1/portals/student/content/${adopted.item_key}/open`,
      },
    });
    expect(JSON.stringify(library)).not.toMatch(/1234567890|https?:\/\/|player\.vimeo/i);

    const playback = await getExistingPrivateVimeoPlayback({
      pool,
      config,
      itemKey: adopted.item_key,
      actor,
      now,
    });
    expect(playback).toMatchObject({
      providerVideoId: command.provider_video_id,
      playbackRoute: `/api/v1/content/vimeo/${adopted.item_key}/playback`,
    });

    await unpublishExistingPrivateVimeo({
      pool,
      config,
      actorUserKey: 'admin_operator',
      actorRole: 'admin',
      itemKey: adopted.item_key,
      now: new Date('2026-08-12T12:10:00.000Z'),
    });
    await expect(
      getExistingPrivateVimeoPlayback({ pool, config, itemKey: adopted.item_key, actor, now }),
    ).rejects.toMatchObject({ code: 'CONTENT_UNAVAILABLE', httpStatus: 404 });
    expect(await adapter.publishedLibraryForLearner({ actor, learner })).toEqual([]);
  });

  it('refuses to publish a replayed source when the verified protection binding changed', async () => {
    const first = await adoptExistingPrivateVimeo({
      pool,
      config,
      actorUserKey: 'admin_operator',
      actorRole: 'admin',
      command,
      reader: { inspect: async () => protectedReadback() },
      now,
    });
    await pool.query(`DELETE FROM onetime.content_item_entitlements WHERE content_item_key = $1`, [
      first.item_key,
    ]);
    await pool.query(`DELETE FROM onetime.content_revisions WHERE content_item_key = $1`, [
      first.item_key,
    ]);
    await pool.query(`DELETE FROM onetime.content_items WHERE content_item_key = $1`, [
      first.item_key,
    ]);

    await expect(
      adoptExistingPrivateVimeo({
        pool,
        config,
        actorUserKey: 'admin_operator',
        actorRole: 'admin',
        command,
        reader: { inspect: async () => protectedReadback({ accountTier: 'standard' }) },
        now: new Date('2026-08-12T12:05:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'EXISTING_VIMEO_SOURCE_BINDING_CONFLICT',
      httpStatus: 409,
    });
    expect(await countRows('onetime.content_items')).toBe(0);
  });

  it.each([
    ['Free account', { accountTier: 'free' }],
    ['unlisted view', { privacyView: 'unlisted' }],
    ['private-only view', { privacyView: 'nobody' }],
    ['public embedding', { privacyEmbed: 'public' }],
    ['wrong domains', { allowedEmbedDomains: ['app.onetimeonetime.com'] }],
    ['downloads enabled', { downloadsAllowed: true }],
    ['comments enabled', { commentsAllowed: true }],
    ['collection adds enabled', { collectionAddsAllowed: true }],
    ['processing incomplete', { available: false }],
    ['transcode incomplete', { transcodeComplete: false }],
    ['unplayable video', { playable: false }],
    ['cold privacy restriction', { coldPrivacyRestricted: true }],
    ['cold storage', { coldStorage: true }],
    ['copyright restriction', { copyrightRestricted: true }],
    ['active unreviewed captions', { captionsActive: true }],
  ])(
    'refuses %s before creating any library or provider-source record',
    async (_label, overrides) => {
      await expect(
        adoptExistingPrivateVimeo({
          pool,
          config,
          actorUserKey: 'admin_operator',
          actorRole: 'admin',
          command,
          reader: { inspect: async () => protectedReadback(overrides) },
          now,
        }),
      ).rejects.toBeInstanceOf(ExistingVimeoAdoptionError);
      expect(await countRows('onetime.content_items')).toBe(0);
      expect(await countRows('onetime.ot104r_vimeo_sources')).toBe(0);
    },
  );

  it('refuses non-operator roles and raw Vimeo URLs before readback', async () => {
    const inspect = vi.fn(async () => protectedReadback());
    await expect(
      adoptExistingPrivateVimeo({
        pool,
        config,
        actorUserKey: 'viewer_user',
        actorRole: 'viewer',
        command,
        reader: { inspect },
        now,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
    await expect(
      adoptExistingPrivateVimeo({
        pool,
        config,
        actorUserKey: 'admin_user',
        actorRole: 'admin',
        command: { ...command, provider_video_id: 'https://vimeo.com/1234567890' },
        reader: { inspect },
        now,
      }),
    ).rejects.toThrow();
    expect(inspect).not.toHaveBeenCalled();
  });

  it('mounts a Rabbi/Admin route with session CSRF and a first-party player page', async () => {
    await createAccountUser({
      pool,
      config,
      email: 'admin@example.test',
      password: 'AdminPass!234',
      displayName: 'Content Admin',
      role: 'admin',
      mfaCapable: true,
    });
    const inspect = vi.fn(async () => protectedReadback());
    const server = await listenForTest(
      createApp({
        config,
        pool,
        existingVimeoProtectionReader: { inspect },
      }),
    );
    try {
      const admin = await loginAs(server.baseUrl, 'admin@example.test', 'AdminPass!234');
      const withoutCsrf = await fetch(
        `${server.baseUrl}/api/v1/admin/content/existing-vimeo/adopt`,
        {
          method: 'POST',
          headers: { cookie: admin.cookies, 'content-type': 'application/json' },
          body: JSON.stringify(command),
        },
      );
      expect(withoutCsrf.status).toBe(403);
      expect(inspect).not.toHaveBeenCalled();

      const adoptedResponse = await fetch(
        `${server.baseUrl}/api/v1/admin/content/existing-vimeo/adopt`,
        {
          method: 'POST',
          headers: {
            cookie: admin.cookies,
            'content-type': 'application/json',
            'x-csrf-token': admin.json.csrf_token,
          },
          body: JSON.stringify(command),
        },
      );
      const adoptedText = await adoptedResponse.text();
      expect(adoptedResponse.status, adoptedText).toBe(201);
      expect(adoptedResponse.headers.get('cache-control')).toContain('no-store');
      expect(adoptedText).not.toMatch(/1234567890|https?:\/\/|vimeo\.com/i);
      const adopted = JSON.parse(adoptedText) as {
        adopted: { item_key: string; playback_route: string };
      };

      const player = await fetch(`${server.baseUrl}${adopted.adopted.playback_route}`, {
        headers: { cookie: admin.cookies },
      });
      const playerHtml = await player.text();
      expect(player.status).toBe(200);
      expect(playerHtml).toContain(`/api/v1/content/vimeo/${adopted.adopted.item_key}/playback`);
      expect(playerHtml).not.toMatch(/1234567890|https?:\/\/player\.vimeo/i);
      expect(player.headers.get('content-security-policy')).toContain('https://player.vimeo.com');

      const anonymousPlayback = await fetch(
        `${server.baseUrl}/api/v1/content/vimeo/${adopted.adopted.item_key}/playback`,
        { redirect: 'manual' },
      );
      expect(anonymousPlayback.status).toBe(401);
    } finally {
      await server.close();
    }
  });
});

describe('Vimeo protection reader', () => {
  it('uses read-only calls and returns the exact protection fields used by the gate', async () => {
    const fetchImpl = vi.fn(async (request: string | URL | Request, _init?: RequestInit) => {
      const url = String(request);
      if (url.includes('/privacy/domains')) {
        return jsonResponse({
          data: [{ domain: 'join.onetimeonetime.com' }, { domain: 'app.onetimeonetime.com' }],
          paging: { next: null },
        });
      }
      if (url.includes('/texttracks')) {
        return jsonResponse({ data: [{ active: false }], paging: { next: null } });
      }
      if (url.includes('/users/777?fields=')) {
        return jsonResponse({
          uri: '/users/777',
          resource_key: 'rabbi-paid-owner',
          membership: { type: 'starter' },
        });
      }
      return jsonResponse({
        uri: '/videos/1234567890',
        name: 'Protected class',
        duration: 91,
        status: 'available',
        is_playable: true,
        transcode: { status: 'complete' },
        privacy: {
          view: 'disable',
          embed: 'whitelist',
          download: false,
          comments: 'nobody',
          add: false,
        },
        user: { uri: '/users/777', resource_key: 'rabbi-paid-owner' },
        metadata: { connections: { texttracks: { total: 1 } } },
      });
    });
    const reader = createExistingVimeoProtectionReader({
      env: {
        VIMEO_ACCESS_TOKEN: 'test-only-vimeo-token',
        VIMEO_ACCOUNT_ID: '777',
      },
      fetchImpl: fetchImpl as typeof fetch,
      apiBaseUrl: 'https://vimeo.example.test',
    });

    await expect(reader.inspect('1234567890')).resolves.toMatchObject({
      providerVideoId: '1234567890',
      ownerAccountVerified: true,
      accountTier: 'starter',
      privacyView: 'disable',
      privacyEmbed: 'whitelist',
      playable: true,
      transcodeComplete: true,
      coldPrivacyRestricted: null,
      coldStorage: null,
      copyrightRestricted: null,
      downloadsAllowed: false,
      commentsAllowed: false,
      collectionAddsAllowed: false,
      allowedEmbedDomains: ['app.onetimeonetime.com', 'join.onetimeonetime.com'],
      captionsActive: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls.every((call) => call[1]?.method === 'GET')).toBe(true);
  });

  it('rejects an active Vimeo AI subtitle even when every other protection is valid', async () => {
    const reader = createExistingVimeoProtectionReader({
      env: {
        VIMEO_ACCESS_TOKEN: 'test-only-vimeo-token',
        VIMEO_ACCOUNT_ID: '777',
      },
      fetchImpl: protectedVimeoFetch({ tracks: [{ active: true }] }) as typeof fetch,
      apiBaseUrl: 'https://vimeo.example.test',
    });
    await expect(
      adoptExistingPrivateVimeo({
        pool,
        config,
        actorUserKey: 'admin_operator',
        actorRole: 'admin',
        command,
        reader,
        now,
      }),
    ).rejects.toMatchObject({ code: 'VIMEO_PROTECTION_CONTRACT_MISMATCH' });
    expect(await countRows('onetime.content_items')).toBe(0);
  });

  it('fully paginates disabled text tracks without treating their count as active captions', async () => {
    const baseFetch = protectedVimeoFetch({ tracks: [{ active: false }, { active: false }] });
    const fetchImpl = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      if (url.includes('/texttracks') && url.includes('page=2')) {
        return jsonResponse({ data: [{ active: false }], paging: { next: null } });
      }
      if (url.includes('/texttracks')) {
        return jsonResponse({
          data: [{ active: false }],
          paging: {
            next: 'https://vimeo.example.test/videos/1234567890/texttracks?page=2&per_page=100&fields=active',
          },
        });
      }
      return baseFetch(request);
    });
    const reader = createExistingVimeoProtectionReader({
      env: {
        VIMEO_ACCESS_TOKEN: 'test-only-vimeo-token',
        VIMEO_ACCOUNT_ID: '777',
      },
      fetchImpl: fetchImpl as typeof fetch,
      apiBaseUrl: 'https://vimeo.example.test',
    });
    await expect(reader.inspect('1234567890')).resolves.toMatchObject({ captionsActive: false });
    expect(
      fetchImpl.mock.calls.filter(([request]) => String(request).includes('/texttracks')),
    ).toHaveLength(2);
  });

  it.each([
    ['missing activation state', [{}], {}],
    ['malformed activation state', [{ active: 'false' }], {}],
    ['malformed optional restriction', [{ active: false }], { is_cold_storage: 'false' }],
  ])('fails closed on %s', async (_label, tracks, videoOverrides) => {
    const reader = createExistingVimeoProtectionReader({
      env: {
        VIMEO_ACCESS_TOKEN: 'test-only-vimeo-token',
        VIMEO_ACCOUNT_ID: '777',
      },
      fetchImpl: protectedVimeoFetch({ tracks, videoOverrides }) as typeof fetch,
      apiBaseUrl: 'https://vimeo.example.test',
    });
    await expect(reader.inspect('1234567890')).rejects.toMatchObject({
      code: expect.stringMatching(/^VIMEO_(?:TEXT_TRACK_)?READBACK_INVALID$/u),
      httpStatus: 503,
    });
  });

  it('does not let a completed transcode mask a non-available video', async () => {
    const reader = createExistingVimeoProtectionReader({
      env: {
        VIMEO_ACCESS_TOKEN: 'test-only-vimeo-token',
        VIMEO_ACCOUNT_ID: '777',
      },
      fetchImpl: protectedVimeoFetch({ videoOverrides: { status: 'uploading' } }) as typeof fetch,
      apiBaseUrl: 'https://vimeo.example.test',
    });
    await expect(
      adoptExistingPrivateVimeo({
        pool,
        config,
        actorUserKey: 'admin_operator',
        actorRole: 'admin',
        command,
        reader,
        now,
      }),
    ).rejects.toMatchObject({ code: 'VIMEO_PROTECTION_CONTRACT_MISMATCH' });
  });

  it('refuses when the configured video owner readback is Free', async () => {
    const fetchImpl = vi.fn(async (request: string | URL | Request) => {
      if (String(request).includes('/users/777?fields=')) {
        return jsonResponse({
          uri: '/users/777',
          resource_key: 'rabbi-paid-owner',
          membership: { type: 'free' },
        });
      }
      return jsonResponse({
        uri: '/videos/1234567890',
        user: { uri: '/users/777', resource_key: 'rabbi-paid-owner' },
      });
    });
    const reader = createExistingVimeoProtectionReader({
      env: {
        VIMEO_ACCESS_TOKEN: 'test-only-vimeo-token',
        VIMEO_ACCOUNT_ID: '777',
      },
      fetchImpl: fetchImpl as typeof fetch,
      apiBaseUrl: 'https://vimeo.example.test',
    });
    await expect(reader.inspect('1234567890')).rejects.toMatchObject({
      code: 'VIMEO_PROTECTED_EMBED_PLAN_REQUIRED',
      httpStatus: 409,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('refuses an accessible video owned by a different Vimeo account', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        uri: '/videos/1234567890',
        user: { uri: '/users/999', resource_key: 'someone-else' },
      }),
    );
    const reader = createExistingVimeoProtectionReader({
      env: {
        VIMEO_ACCESS_TOKEN: 'test-only-vimeo-token',
        VIMEO_ACCOUNT_ID: '777',
      },
      fetchImpl: fetchImpl as typeof fetch,
      apiBaseUrl: 'https://vimeo.example.test',
    });
    await expect(reader.inspect('1234567890')).rejects.toMatchObject({
      code: 'VIMEO_OWNER_ACCOUNT_MISMATCH',
      httpStatus: 409,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails closed before a provider request when the owner account is not configured', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const reader = createExistingVimeoProtectionReader({
      env: { VIMEO_ACCESS_TOKEN: 'test-only-vimeo-token' },
      fetchImpl: fetchImpl as typeof fetch,
      apiBaseUrl: 'https://vimeo.example.test',
    });
    await expect(reader.inspect('1234567890')).rejects.toMatchObject({
      code: 'VIMEO_OWNER_ACCOUNT_UNCONFIGURED',
      httpStatus: 503,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function protectedReadback(
  overrides: Partial<ExistingVimeoProtectionReadback> = {},
): ExistingVimeoProtectionReadback {
  return {
    providerVideoId: command.provider_video_id,
    ownerAccountVerified: true,
    ownerAccountIdDigest: 'd'.repeat(64),
    accountTier: 'starter',
    title: command.title,
    durationMs: 91_000,
    available: true,
    transcodeComplete: true,
    playable: true,
    coldPrivacyRestricted: false,
    coldStorage: false,
    copyrightRestricted: false,
    privacyView: 'disable',
    privacyEmbed: 'whitelist',
    downloadsAllowed: false,
    commentsAllowed: false,
    collectionAddsAllowed: false,
    allowedEmbedDomains: ['app.onetimeonetime.com', 'join.onetimeonetime.com'],
    captionsActive: false,
    ...overrides,
  };
}

function studentActor() {
  return {
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
}

async function grantHouseholdCurrentAccess(householdKey: string) {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ($1,$2,$3,'Existing Vimeo fixture household')`,
    [householdKey, config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, access_version,
        last_event_key)
     VALUES ('existing_vimeo_access',$1,$2,$3,'active','free_pilot',
       '2026-08-12T11:00:00.000Z','2027-01-15T12:00:00.000Z',
       'existing_vimeo_free_pilot',1,'2026-08-12T11:00:01.000Z',
       'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
       'content-current-access-v1',1,'existing_vimeo_access_seed')`,
    [config.accountKey, config.productKey, householdKey],
  );
}

async function countRows(table: string) {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function protectedVimeoFetch(
  input: {
    tracks?: Array<Record<string, unknown>>;
    videoOverrides?: Record<string, unknown>;
  } = {},
) {
  const tracks = input.tracks ?? [{ active: false }];
  return vi.fn(async (request: string | URL | Request) => {
    const url = String(request);
    if (url.includes('/privacy/domains')) {
      return jsonResponse({
        data: [{ domain: 'join.onetimeonetime.com' }, { domain: 'app.onetimeonetime.com' }],
        paging: { next: null },
      });
    }
    if (url.includes('/texttracks')) {
      return jsonResponse({ data: tracks, paging: { next: null } });
    }
    if (url.includes('/users/777?fields=')) {
      return jsonResponse({
        uri: '/users/777',
        resource_key: 'rabbi-paid-owner',
        membership: { type: 'starter' },
      });
    }
    return jsonResponse({
      uri: '/videos/1234567890',
      name: 'Protected class',
      duration: 91,
      status: 'available',
      is_playable: true,
      transcode: { status: 'complete' },
      privacy: {
        view: 'disable',
        embed: 'whitelist',
        download: false,
        comments: 'nobody',
        add: false,
      },
      user: { uri: '/users/777', resource_key: 'rabbi-paid-owner' },
      metadata: { connections: { texttracks: { total: tracks.length } } },
      ...input.videoOverrides,
    });
  });
}

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

async function loginAs(baseUrl: string, email: string, password: string) {
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
  if (response.status === 403) {
    const challenge = (await response.json()) as { code?: string; challenge_token?: string };
    expect(challenge.code).toBe('EMAIL_CHALLENGE_REQUIRED');
    expect(challenge.challenge_token).toBeTruthy();
    const payload = await latestEmailChallengePayload();
    const verified = await fetch(`${baseUrl}/api/v1/auth/email-challenge/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        challenge_token: challenge.challenge_token,
        code: String(payload.code),
      }),
    });
    expect(verified.status).toBe(200);
    return {
      cookies: mergeCookies(csrf.cookies, cookieHeader(verified.headers)),
      json: (await verified.json()) as { csrf_token: string },
    };
  }
  expect(response.status).toBe(200);
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    json: (await response.json()) as { csrf_token: string },
  };
}

async function latestEmailChallengePayload() {
  const result = await pool.query(
    `SELECT nonce, ciphertext, auth_tag
       FROM onetime.auth_email_challenge_delivery_outbox
      WHERE nonce IS NOT NULL
        AND ciphertext IS NOT NULL
        AND auth_tag IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) throw new Error('missing auth email challenge payload');
  return decryptAuthEmailChallengeDeliveryPayloadForTests(config, {
    nonce: String(row.nonce),
    ciphertext: String(row.ciphertext),
    auth_tag: String(row.auth_tag),
  });
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
