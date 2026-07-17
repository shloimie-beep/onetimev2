import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  activateOt110aPromptVersion,
  admitContentOutcome,
  createAccountUser,
  createOt110aGeneratedArtifact,
  createOt110aIntegratedProviderPorts,
  createOt110aPromptPatch,
  decryptAuthEmailChallengeDeliveryPayloadForTests,
  getOt110aContentCreateWorkspace,
  getOt110aContentWorkspaceOverview,
  grantOt110aContentAdminCapability,
  listOt110aPromptTemplates,
  previewOt110aPromptPatch,
  registerOt109Source,
  resolveOt110aContentAdminActor,
  rollbackOt110aPromptVersion,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;

const contentOutcome = {
  idempotency_key: 'ot110a-content-outcome-001',
  item_key: 'rabbi_source_2026_07_16',
  title: 'Rabbi Scheller source July 16',
  item_type: 'video' as const,
  revision_number: 1,
  lifecycle_state: 'review_needed' as const,
  transcript_metadata: {
    summary: 'Safe transcript summary for OT-110A tests.',
  },
  source_metadata: {
    source_label: 'Provider-off test source',
  },
  review_sheet_metadata: {},
  playback_metadata: {
    provider: 'sink',
  },
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

describe('OT-110A admin Content workspace domain', () => {
  it('uses explicit capabilities, integrated provider ports, and immutable prompt versions', async () => {
    const ownerUserKey = await createAccountUser({
      pool,
      config,
      email: 'ot110a-owner@example.test',
      password: 'OwnerPass!234',
      displayName: 'Owner User',
      role: 'owner',
      mfaCapable: false,
    });
    const adminUserKey = await createAccountUser({
      pool,
      config,
      email: 'ot110a-admin@example.test',
      password: 'AdminPass!234',
      displayName: 'Admin User',
      role: 'admin',
      mfaCapable: false,
    });
    await admitContentOutcome({
      pool,
      config,
      payload: contentOutcome,
      actorUserKey: ownerUserKey,
    });
    const ot109Source = await registerOt109Source({
      pool,
      source: {
        idempotency_key: 'idem_ot110a_ot109_bridge_001',
        source_kind: 'private_vimeo_reference',
        source_reference: 'vimeo:private-bridge-001',
        source_sha256: digest('ot110a-ot109-bridge-source'),
        original_name: 'OT-109 bridge source.mp4',
        byte_length: null,
        submitted_by_actor_id: 'actor_owner_admin_001',
        provenance: {
          intake_channel: 'ops04c_bridge_test',
        },
      },
    });

    const owner = await resolveOt110aContentAdminActor({
      pool,
      config,
      user: { user_key: ownerUserKey, role: 'owner' },
    });
    const admin = await resolveOt110aContentAdminActor({
      pool,
      config,
      user: { user_key: adminUserKey, role: 'admin' },
    });
    expect(owner.capabilities).toContain('prompt.manage');
    expect(admin.capabilities).toContain('artifact.generate');
    expect(admin.capabilities).not.toContain('prompt.manage');

    await expect(listOt110aPromptTemplates({ pool, config, actor: admin })).resolves.toHaveLength(
      8,
    );
    await expect(
      createOt110aPromptPatch({
        pool,
        config,
        actor: admin,
        templateKey: 'ot110a.lesson_summary',
        payload: {
          parent_version_key: 'missing',
          patch: { find: 'approved transcript', replace: 'approved transcript with citations' },
          reason: 'Should be blocked.',
        },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await grantOt110aContentAdminCapability({
      pool,
      config,
      userKey: adminUserKey,
      capability: 'prompt.manage',
      grantedByUserKey: ownerUserKey,
    });
    const explicitAdmin = await resolveOt110aContentAdminActor({
      pool,
      config,
      user: { user_key: adminUserKey, role: 'admin' },
    });
    expect(explicitAdmin.capabilities).toContain('prompt.manage');

    const overview = await getOt110aContentWorkspaceOverview({
      pool,
      config,
      actor: owner,
      ports: createOt110aIntegratedProviderPorts(config),
    });
    expect(overview.provider_ports.every((port) => port.can_mutate_provider === false)).toBe(true);
    expect(new Set(overview.provider_ports.map((port) => port.port))).toEqual(
      new Set(['vimeo', 'generation', 'knowledge_index', 'buffer', 'telegram']),
    );
    expect(overview.provider_ports.find((port) => port.port === 'knowledge_index')).toMatchObject({
      mode: 'ready',
      state: 'available',
    });
    expect(
      overview.sources.find((source) => source.source_key === contentOutcome.item_key),
    ).toMatchObject({
      source_key: contentOutcome.item_key,
      lifecycle_stage: 'transcript_review',
    });
    const ot109Summary = overview.sources.find(
      (source) => source.source_key === ot109Source.source_key,
    );
    expect(ot109Summary).toMatchObject({
      lifecycle_stage: 'private_source',
      provider_state: 'ot109_private_reference',
      latest_revision_key: null,
    });

    const createWorkspace = await getOt110aContentCreateWorkspace({
      pool,
      config,
      actor: owner,
    });
    expect(createWorkspace.eligible_sources.map((source) => source.source_key)).not.toContain(
      ot109Source.source_key,
    );
    const lessonTemplate = createWorkspace.prompt_templates.find(
      (template) => template.template_key === 'ot110a.lesson_summary',
    );
    expect(lessonTemplate?.active_version_key).toBeTruthy();

    const artifact = await createOt110aGeneratedArtifact({
      pool,
      config,
      actor: owner,
      payload: {
        source_key: contentOutcome.item_key,
        artifact_kind: 'lesson_summary',
        prompt_version_key: String(lessonTemplate?.active_version_key),
        reason: 'Create review draft.',
      },
    });
    expect(artifact).toMatchObject({
      artifact_kind: 'lesson_summary',
      review_state: 'review_needed',
    });
    expect(JSON.stringify(artifact)).not.toMatch(/https?:\/\/|token|secret|password/i);

    const preview = await previewOt110aPromptPatch({
      pool,
      config,
      actor: owner,
      templateKey: 'ot110a.lesson_summary',
      payload: {
        parent_version_key: String(lessonTemplate?.active_version_key),
        patch: { find: 'approved transcript', replace: 'approved transcript with citations' },
        reason: 'Improve citation behavior.',
        source_key: contentOutcome.item_key,
      },
    });
    expect(preview.can_publish).toBe(false);
    expect(preview.candidate_checksum).not.toBe(preview.parent_checksum);

    const patch = await createOt110aPromptPatch({
      pool,
      config,
      actor: owner,
      templateKey: 'ot110a.lesson_summary',
      payload: {
        parent_version_key: String(lessonTemplate?.active_version_key),
        patch: { find: 'approved transcript', replace: 'approved transcript with citations' },
        reason: 'Improve citation behavior.',
      },
    });
    expect(patch.version.status).toBe('draft');

    const activated = await activateOt110aPromptVersion({
      pool,
      config,
      actor: owner,
      templateKey: 'ot110a.lesson_summary',
      versionKey: patch.version.version_key,
      reason: 'Use citation patch.',
    });
    expect(activated.template.active_version_key).toBe(patch.version.version_key);

    const rolledBack = await rollbackOt110aPromptVersion({
      pool,
      config,
      actor: owner,
      templateKey: 'ot110a.lesson_summary',
      targetVersionKey: String(lessonTemplate?.active_version_key),
      reason: 'Return to default prompt.',
    });
    expect(rolledBack.template.active_version_key).toBe(lessonTemplate?.active_version_key);
  });
});

describe('OT-110A admin Content workspace API', () => {
  it('denies parent users and serves owner workspace without provider secrets', async () => {
    await admitContentOutcome({ pool, config, payload: contentOutcome });
    await createAccountUser({
      pool,
      config,
      email: 'ot110a-api-owner@example.test',
      password: 'OwnerPass!234',
      displayName: 'Owner API',
      role: 'owner',
      mfaCapable: false,
    });
    await createAccountUser({
      pool,
      config,
      email: 'ot110a-parent@example.test',
      password: 'ParentPass!234',
      displayName: 'Parent User',
      role: 'parent',
      mfaCapable: false,
    });
    const server = await listenForTest(createApp({ config, pool }));
    try {
      const owner = await loginAs(server.baseUrl, 'ot110a-api-owner@example.test', 'OwnerPass!234');
      const parent = await loginAs(server.baseUrl, 'ot110a-parent@example.test', 'ParentPass!234');

      const denied = await fetch(`${server.baseUrl}/api/v1/admin/content/workspace`, {
        headers: { cookie: parent.cookies },
      });
      expect(denied.status).toBe(403);

      const workspace = await fetch(`${server.baseUrl}/api/v1/admin/content/workspace`, {
        headers: { cookie: owner.cookies },
      });
      const workspaceText = await workspace.text();
      expect(workspace.status, workspaceText).toBe(200);
      expect(workspace.headers.get('cache-control')).toContain('no-store');
      const json = JSON.parse(workspaceText) as {
        success: true;
        provider_ports: Array<{ port: string; mode: string; can_mutate_provider: boolean }>;
        sources: Array<{ source_key: string }>;
      };
      expect(json.provider_ports.every((port) => port.can_mutate_provider === false)).toBe(true);
      expect(json.provider_ports.map((port) => port.port).sort()).toEqual([
        'buffer',
        'generation',
        'knowledge_index',
        'telegram',
        'vimeo',
      ]);
      expect(json.sources.map((source) => source.source_key)).toContain(contentOutcome.item_key);
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

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
