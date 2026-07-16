import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import {
  ot86bApprovedForSocialEventSchema,
  ot86bBufferPublishCommandSchema,
  ot86bSocialDraftRevisionSchema,
  type Ot86bApprovedForSocialEvent,
  type Ot86bBufferPublishCommand,
} from '../../../packages/contracts/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  Ot86bSocialPublishingError,
  approveAndScheduleOt86bDraft,
  dispatchNextOt86bSocialEvent,
  editOt86bDraftRevision,
  generateNextOt86bDraftJob,
  inspectOt86bBufferReadinessFromEnv,
  receiveOt86bSocialEvent,
  requestOt86bRetraction,
  runOt86bSchedulerOnce,
  sanitizeOt86bProviderError,
  signOt86Manifest,
  validateOt86bPublishCommand,
  validateOt86bSocialEventChecksum,
  type Ot86SigningSecret,
  type Ot86bBufferAdapter,
  type Ot86bProviderResult,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
const secret: Ot86SigningSecret = {
  keyId: 'ot86-social-key-current',
  secret: 'test-only-ot86b-social-signing-secret-with-32-chars',
};

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    OT86_PUBLISH_SIGNING_KEY_ID: secret.keyId,
    OT86_PUBLISH_SIGNING_SECRET: secret.secret,
  });
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('OT-86B contract schemas', () => {
  it('accepts valid fixtures and rejects privacy or revision mismatch cases', async () => {
    const root = path.resolve('contracts/social-publishing/v1/fixtures');
    const validEvent = withSocialChecksum(
      JSON.parse(
        await readFile(path.join(root, 'content-approved-for-social.valid.json'), 'utf8'),
      ) as Omit<Ot86bApprovedForSocialEvent, 'payload_sha256'>,
    );
    const invalidEvent = JSON.parse(
      await readFile(
        path.join(root, 'content-approved-for-social.learner-question.invalid.json'),
        'utf8',
      ),
    ) as unknown;
    const validDraft = JSON.parse(
      await readFile(path.join(root, 'social-draft.valid.json'), 'utf8'),
    ) as unknown;
    const invalidDraft = JSON.parse(
      await readFile(path.join(root, 'social-draft.privacy-failed.invalid.json'), 'utf8'),
    ) as unknown;
    const validCommand = JSON.parse(
      await readFile(path.join(root, 'buffer-publish-command.valid.json'), 'utf8'),
    ) as Ot86bBufferPublishCommand;
    const invalidCommand = JSON.parse(
      await readFile(
        path.join(root, 'buffer-publish-command.revision-mismatch.domain-invalid.json'),
        'utf8',
      ),
    ) as Ot86bBufferPublishCommand;

    expect(ot86bApprovedForSocialEventSchema.safeParse(validEvent).success).toBe(true);
    expect(validateOt86bSocialEventChecksum(validEvent)).toBe(true);
    expect(ot86bApprovedForSocialEventSchema.safeParse(invalidEvent).success).toBe(false);
    expect(ot86bSocialDraftRevisionSchema.safeParse(validDraft).success).toBe(true);
    expect(ot86bSocialDraftRevisionSchema.safeParse(invalidDraft).success).toBe(false);
    expect(ot86bBufferPublishCommandSchema.safeParse(validCommand).success).toBe(true);
    expect(() => validateOt86bPublishCommand(invalidCommand)).toThrow(Ot86bSocialPublishingError);
  });
});

describe('OT-86B signed event inbox and draft generation', () => {
  it('authenticates, records durable receipts, rejects replay conflicts, and never calls Buffer', async () => {
    const event = socialEvent();
    const rawBody = rawEvent(event);
    const headers = signedHeaders(rawBody, event.event_id);

    const badSignature = await receiveOt86bSocialEvent({
      pool,
      rawBody,
      headers: { ...headers, signature: `v1=${'a'.repeat(64)}` },
      secrets: [secret],
      now: new Date(Number(headers.timestamp) * 1000),
    });
    expect(badSignature.status).toBe(401);
    expect(await countRows('onetime.ot86b_social_event_inbox')).toBe(0);

    const accepted = await receiveOt86bSocialEvent({
      pool,
      rawBody,
      headers,
      secrets: [secret],
      now: new Date(Number(headers.timestamp) * 1000),
    });
    expect(accepted).toMatchObject({ status: 202, receipt_state: 'queued' });

    const duplicate = await receiveOt86bSocialEvent({
      pool,
      rawBody,
      headers,
      secrets: [secret],
      now: new Date(Number(headers.timestamp) * 1000),
    });
    expect(duplicate).toMatchObject({ status: 200, receipt_state: 'duplicate' });

    const changed = rawEvent(withSocialChecksum({ ...event, sequence: 2 }));
    const conflict = await receiveOt86bSocialEvent({
      pool,
      rawBody: changed,
      headers: {
        ...headers,
        signature: signOt86Manifest({
          keyId: secret.keyId,
          secret: secret.secret,
          timestamp: headers.timestamp,
          rawBody: changed,
        }),
      },
      secrets: [secret],
      now: new Date(Number(headers.timestamp) * 1000),
    });
    expect(conflict).toMatchObject({ status: 409, receipt_state: 'conflict' });

    const dispatch = await dispatchNextOt86bSocialEvent({ pool });
    expect(dispatch).toMatchObject({ dispatched: true });
    const generator = await generateNextOt86bDraftJob({ pool });
    expect(generator.generated).toBe(true);
    if (generator.generated) expect(generator.revisions).toHaveLength(4);
    expect(await countRows('onetime.ot86b_social_draft_revisions')).toBe(4);
    expect(await countRows('onetime.ot86b_social_provider_attempts')).toBe(0);
  });

  it('rejects wrong type, origin, learner privacy, and unsafe media before drafts', async () => {
    const wrongType = withLooseSocialChecksum({
      ...socialEvent(),
      event_type: 'content.publication_manifest',
    });
    const wrongOrigin = withLooseSocialChecksum({
      ...socialEvent({ event_id: '77777777-7777-4777-8777-777777777777' }),
      origin: 'other-origin',
    });
    const learnerQuestion = withLooseSocialChecksum({
      ...socialEvent({ event_id: '88888888-8888-4888-8888-888888888888' }),
      privacy: {
        contains_learner_name: false,
        contains_learner_voice: false,
        contains_learner_face: false,
        contains_learner_question: true,
        contains_private_data: false,
      },
    });
    const unsafeMediaBase = socialEvent({
      event_id: '99999999-9999-4999-8999-999999999999',
    });
    const unsafeMediaItem = unsafeMediaBase.content.media[0];
    if (!unsafeMediaItem) throw new Error('missing media fixture');
    const unsafeMedia = withLooseSocialChecksum({
      ...unsafeMediaBase,
      content: {
        ...unsafeMediaBase.content,
        media: [
          {
            asset_id: unsafeMediaItem.asset_id,
            kind: unsafeMediaItem.kind,
            uri: unsafeMediaItem.uri,
            mime_type: unsafeMediaItem.mime_type,
            sha256: unsafeMediaItem.sha256,
            privacy: unsafeMediaItem.privacy,
            subject_classification: 'student_face',
          },
        ],
      },
    });

    for (const event of [wrongType, wrongOrigin, learnerQuestion, unsafeMedia]) {
      const response = await receiveSignedUnknown(event);
      expect(response.status).toBe(422);
    }
    expect(await countRows('onetime.ot86b_social_event_inbox')).toBe(0);
  });
});

describe('OT-86B approval, scheduler, and retraction gates', () => {
  it('requires destination and future schedule, invalidates approval after edit, and blocks early writes', async () => {
    await acceptAndGenerate();
    const draft = await firstDraft();
    await expect(
      approveAndScheduleOt86bDraft({
        pool,
        draftId: draft.draft_id,
        revisionId: String(draft.current_revision_id),
        approvedByActorId: 'actor_owner_001',
        destinations: [],
        scheduledFor: new Date(Date.now() + 60_000),
        timezone: 'Asia/Jerusalem',
        policyVersion: 'ot86-social-v1',
        correlationId: 'corr_no_destination',
      }),
    ).rejects.toMatchObject({ code: 'DESTINATION_REQUIRED' });

    const destination = destinationFixture(draft.platform);
    await expect(
      approveAndScheduleOt86bDraft({
        pool,
        draftId: draft.draft_id,
        revisionId: String(draft.current_revision_id),
        approvedByActorId: 'actor_owner_001',
        destinations: [destination],
        scheduledFor: new Date(Date.now() - 60_000),
        timezone: 'Asia/Jerusalem',
        policyVersion: 'ot86-social-v1',
        correlationId: 'corr_past_schedule',
      }),
    ).rejects.toMatchObject({ code: 'FUTURE_SCHEDULE_REQUIRED' });

    await expect(
      approveAndScheduleOt86bDraft({
        pool,
        draftId: draft.draft_id,
        revisionId: String(draft.current_revision_id),
        approvedByActorId: 'actor_owner_001',
        destinations: [destinationFixture(draft.platform === 'facebook' ? 'linkedin' : 'facebook')],
        scheduledFor: new Date(Date.now() + 60_000),
        timezone: 'Asia/Jerusalem',
        policyVersion: 'ot86-social-v1',
        correlationId: 'corr_platform_mismatch',
      }),
    ).rejects.toMatchObject({ code: 'DESTINATION_PLATFORM_MISMATCH' });

    const scheduledFor = new Date(Date.now() + 60 * 60_000);
    const approval = await approveAndScheduleOt86bDraft({
      pool,
      draftId: draft.draft_id,
      revisionId: String(draft.current_revision_id),
      approvedByActorId: 'actor_owner_001',
      destinations: [destination],
      scheduledFor,
      timezone: 'Asia/Jerusalem',
      policyVersion: 'ot86-social-v1',
      correlationId: 'corr_schedule_001',
    });
    expect(approval.commands).toHaveLength(1);

    const adapter = readyAdapter();
    const early = await runOt86bSchedulerOnce({ pool, adapter, now: new Date() });
    expect(early.provider_writes).toBe(0);
    expect(adapter.created).toBe(0);

    await editOt86bDraftRevision({
      pool,
      draftId: draft.draft_id,
      actorId: 'actor_owner_001',
      text: '<script>alert(1)</script> Updated approved text',
      correlationId: 'corr_edit_001',
    });
    const commands = await pool.query(
      `SELECT command_state FROM onetime.ot86b_social_publish_commands`,
    );
    expect(commands.rows.map((row) => row.command_state)).toEqual(['cancelled']);
    const latest = await firstDraft();
    expect(latest.workflow_state).toBe('review_needed');
    const revision = await pool.query(
      `SELECT text FROM onetime.ot86b_social_draft_revisions
        WHERE revision_id = $1`,
      [latest.current_revision_id],
    );
    expect(String(revision.rows[0]?.text)).not.toContain('<script>');
  });

  it('reconciles before create, prevents duplicate posts, and records unsupported delete as manual', async () => {
    await acceptAndGenerate();
    const draft = await firstDraft();
    const approvalNow = new Date('2026-01-02T00:00:00Z');
    const scheduledFor = new Date('2026-01-02T00:01:00Z');
    await approveAndScheduleOt86bDraft({
      pool,
      draftId: draft.draft_id,
      revisionId: String(draft.current_revision_id),
      approvedByActorId: 'actor_owner_001',
      destinations: [destinationFixture(draft.platform)],
      scheduledFor,
      timezone: 'Asia/Jerusalem',
      policyVersion: 'ot86-social-v1',
      correlationId: 'corr_schedule_due_001',
      now: approvalNow,
    });

    const adapter = readyAdapter({
      reconcileResult: {
        status: 'exists',
        provider_post_id: 'buffer_post_existing',
        sanitized_code: 'existing_post_found',
      },
    });
    const result = await runOt86bSchedulerOnce({
      pool,
      adapter,
      now: new Date('2026-01-02T00:02:00Z'),
    });
    expect(result).toMatchObject({ inspected: 1, provider_writes: 0, published: 1 });
    expect(adapter.created).toBe(0);

    const command = await pool.query(
      `SELECT command_id FROM onetime.ot86b_social_publish_commands`,
    );
    const retraction = await requestOt86bRetraction({
      pool,
      adapter: readyAdapter({ supportsDelete: false }),
      commandId: String(command.rows[0]?.command_id),
      actorId: 'actor_owner_001',
      correlationId: 'corr_retract_001',
    });
    expect(retraction.state).toBe('retraction_manual_required');
  });

  it('reports missing Buffer accounts honestly and redacts token-shaped provider errors', () => {
    const readiness = inspectOt86bBufferReadinessFromEnv({});
    expect(readiness).toMatchObject({
      state: 'unconfigured',
      can_schedule: false,
      missing_capability_classes: ['access_token', 'organization_id', 'destination_ids'],
    });
    const accessToken = ['buffer', 'abcdefghijklmnopqrstuvwxyz123456'].join('_');
    expect(
      sanitizeOt86bProviderError(`Buffer failed with Authorization: Bearer ${accessToken}`),
    ).not.toContain(accessToken);
  });
});

describe('OT-86B internal HTTP endpoint', () => {
  it('records a signed approved-for-social event without user session and never publishes', async () => {
    const server = await listenForTest(createApp({ config, pool }));
    try {
      const event = socialEvent({ event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
      const rawBody = rawEvent(event);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const response = await fetch(`${server.baseUrl}/internal/social-publishing/v1/events`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ot86-key-id': secret.keyId,
          'x-ot86-timestamp': timestamp,
          'x-ot86-delivery-id': event.event_id,
          'x-ot86-signature': signOt86Manifest({
            keyId: secret.keyId,
            secret: secret.secret,
            timestamp,
            rawBody,
          }),
        },
        body: rawBody,
      });
      expect(response.status).toBe(202);
      expect(await countRows('onetime.ot86b_social_event_inbox')).toBe(1);
      expect(await countRows('onetime.ot86b_social_provider_attempts')).toBe(0);
    } finally {
      await server.close();
    }
  });
});

function socialEvent(overrides: Partial<Ot86bApprovedForSocialEvent> = {}) {
  const base: Omit<Ot86bApprovedForSocialEvent, 'payload_sha256'> = {
    schema_version: 1,
    event_type: 'content.approved_for_social',
    origin: 'ot86a-content-pipeline',
    event_id: '33333333-3333-4333-8333-333333333333',
    idempotency_key: 'tenant_demo_001:cnt_social_001:ver_social_001:social',
    tenant_id: 'tenant_demo_001',
    content_id: 'cnt_social_001',
    version_id: 'ver_social_001',
    sequence: 1,
    occurred_at: '2026-01-02T03:05:00Z',
    approval: {
      approval_id: 'approval_social_001',
      approved_for_social: true,
      approved_by_actor_id: 'actor_rabbi_001',
      approved_at: '2026-01-02T03:00:00Z',
      policy_version: 'ot86-social-v1',
    },
    content: {
      canonical_title: 'Approved class fixture',
      canonical_url: 'https://one-time.example.invalid/library/classes/cnt_social_001',
      summary: 'Approved non-private class summary for social drafting.',
      approved_excerpts: [
        {
          excerpt_id: 'excerpt_001',
          section_id: 'section_001',
          text: 'An approved excerpt containing no learner identity or private information.',
          deep_link:
            'https://one-time.example.invalid/library/classes/cnt_social_001#section-section_001',
          text_sha256: digest(
            'An approved excerpt containing no learner identity or private information.',
          ),
        },
      ],
      media: [
        {
          asset_id: 'asset_graphic_001',
          kind: 'graphic',
          uri: 'https://objects.example.invalid/ot86/graphic-001.png',
          mime_type: 'image/png',
          sha256: '2'.repeat(64),
          subject_classification: 'graphics_only',
          privacy: privacy(),
        },
      ],
    },
    privacy: privacy(),
    ...overrides,
  };
  return withSocialChecksum(base);
}

function withSocialChecksum(
  event: Omit<Ot86bApprovedForSocialEvent, 'payload_sha256'> | Ot86bApprovedForSocialEvent,
): Ot86bApprovedForSocialEvent {
  const withoutHash = { ...event } as Omit<Ot86bApprovedForSocialEvent, 'payload_sha256'> & {
    payload_sha256?: string;
  };
  delete withoutHash.payload_sha256;
  return ot86bApprovedForSocialEventSchema.parse({
    ...withoutHash,
    payload_sha256: digest(canonicalJson(withoutHash)),
  });
}

function withLooseSocialChecksum(event: Record<string, unknown>): Record<string, unknown> {
  const withoutHash = { ...event };
  delete withoutHash.payload_sha256;
  return {
    ...withoutHash,
    payload_sha256: digest(canonicalJson(withoutHash)),
  };
}

function rawEvent(event: Ot86bApprovedForSocialEvent) {
  expect(validateOt86bSocialEventChecksum(event)).toBe(true);
  return Buffer.from(JSON.stringify(event), 'utf8');
}

function signedHeaders(rawBody: Buffer, eventId: string) {
  const timestamp = '1767227045';
  return {
    contentType: 'application/json',
    keyId: secret.keyId,
    timestamp,
    deliveryId: eventId,
    signature: signOt86Manifest({
      keyId: secret.keyId,
      secret: secret.secret,
      timestamp,
      rawBody,
    }),
  };
}

async function receiveSigned(event: Ot86bApprovedForSocialEvent) {
  const rawBody = rawEvent(event);
  const headers = signedHeaders(rawBody, event.event_id);
  return receiveOt86bSocialEvent({
    pool,
    rawBody,
    headers,
    secrets: [secret],
    now: new Date(Number(headers.timestamp) * 1000),
  });
}

async function receiveSignedUnknown(event: Record<string, unknown>) {
  const rawBody = Buffer.from(JSON.stringify(event), 'utf8');
  const eventId = String(event.event_id ?? '33333333-3333-4333-8333-333333333333');
  const headers = signedHeaders(rawBody, eventId);
  return receiveOt86bSocialEvent({
    pool,
    rawBody,
    headers,
    secrets: [secret],
    now: new Date(Number(headers.timestamp) * 1000),
  });
}

async function acceptAndGenerate() {
  await receiveSigned(socialEvent());
  await dispatchNextOt86bSocialEvent({ pool });
  await generateNextOt86bDraftJob({ pool });
}

async function firstDraft() {
  const result = await pool.query(
    `SELECT draft_id, platform, workflow_state, current_revision_id
       FROM onetime.ot86b_social_drafts
      ORDER BY platform ASC
      LIMIT 1`,
  );
  if (!result.rowCount) throw new Error('missing draft');
  return {
    draft_id: String(result.rows[0]?.draft_id),
    platform: result.rows[0]?.platform as 'facebook' | 'instagram' | 'linkedin' | 'x',
    workflow_state: String(result.rows[0]?.workflow_state),
    current_revision_id: String(result.rows[0]?.current_revision_id),
  };
}

function destinationFixture(platform: 'facebook' | 'instagram' | 'linkedin' | 'x') {
  return {
    provider: 'buffer' as const,
    organization_id: 'buffer_org_001',
    destination_id: `buffer_destination_${platform}`,
    label: `Buffer ${platform}`,
    platform,
    capability_version: 'buffer-capabilities-v1',
    timezone: 'Asia/Jerusalem',
    supports_update: false,
    supports_delete: false,
    max_text_length: 3000,
    media_required: false,
  };
}

function readyAdapter(
  options: { reconcileResult?: Ot86bProviderResult; supportsDelete?: boolean } = {},
) {
  let created = 0;
  const destination = destinationFixture('facebook');
  const adapter: Ot86bBufferAdapter & { created: number } = {
    get created() {
      return created;
    },
    readiness: async () => ({
      provider: 'buffer',
      state: 'ready',
      missing_capability_classes: [],
      destinations: [destination],
      can_schedule: true,
      safe_reason_code: 'ready',
    }),
    listDestinations: async () => [destination],
    reconcile: async () =>
      options.reconcileResult ?? {
        status: 'not_found',
        sanitized_code: 'not_found',
      },
    createScheduledPost: async () => {
      created += 1;
      return {
        status: 'created',
        provider_post_id: 'buffer_post_001',
        sanitized_code: 'created',
      };
    },
  };
  if (options.supportsDelete) {
    adapter.deletePublishedPost = async () => ({
      status: 'deleted',
      sanitized_code: 'deleted',
    });
  }
  return adapter;
}

async function countRows(table: string) {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

function privacy() {
  return {
    contains_learner_name: false,
    contains_learner_voice: false,
    contains_learner_face: false,
    contains_learner_question: false,
    contains_private_data: false,
  } as const;
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  throw new Error(`Cannot canonicalize ${typeof value}`);
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
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
