import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Ot106PublicationManifest } from '../../../packages/contracts/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  cancelOt106Manifest,
  canonicalOt106Json,
  createOt106SinkAdapter,
  inspectOt106BufferReadiness,
  parseBufferGraphqlCreatePostResponse,
  parseOt106BufferChannelAliases,
  processOt106BufferQueueOnce,
  receiveOt106PublicationManifest,
  signOt106Manifest,
  withOt106ManifestChecksum,
  type Ot106BufferAdapter,
  type Ot106ProviderPostInput,
  type Ot106RuntimeConfig,
  type Ot106SigningSecret,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;

const secret: Ot106SigningSecret = {
  keyId: 'ot106-key-current',
  secret: 'test-only-ot106-buffer-social-secret-with-32-chars',
};

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('OT-106 signed manifest intake', () => {
  it('accepts approved alias-only manifests, dedupes identical replay, and rejects changed replay', async () => {
    const manifest = publicationManifest();
    const accepted = await receiveSigned(manifest);
    expect(accepted).toMatchObject({ status: 202, code: 'accepted', state: 'queued' });

    const duplicate = await receiveSigned(manifest);
    expect(duplicate).toMatchObject({ status: 200, code: 'duplicate' });

    const changed = publicationManifest({
      caption: { text: 'Changed approved caption.', hashtags: [] },
    });
    const conflict = await receiveSigned(changed, {
      deliveryId: manifest.manifest_id,
      rawOverride: JSON.stringify({ ...changed, manifest_id: manifest.manifest_id }),
    });
    expect(conflict).toMatchObject({ status: 409, code: 'conflict' });
    expect(await countRows('onetime.ot106_publication_manifests')).toBe(1);
  });

  it('rejects bad signature, wrong account/product, caller provider IDs, and missing approval', async () => {
    const manifest = publicationManifest();
    const rawBody = Buffer.from(JSON.stringify(manifest), 'utf8');
    const timestamp = '1767227045';
    const badSignature = await receiveOt106PublicationManifest({
      pool,
      rawBody,
      headers: headersFor(rawBody, manifest.manifest_id, timestamp, `v1=${'a'.repeat(64)}`),
      secrets: [secret],
      expectedAccountKey: 'one_time',
      expectedProductKey: 'one_time_mishnah_class',
      now: new Date(Number(timestamp) * 1000),
    });
    expect(badSignature.status).toBe(401);

    const wrongScope = await receiveSigned(publicationManifest({ account_key: 'other_account' }));
    expect(wrongScope).toMatchObject({ status: 422, code: 'unprocessable' });

    const withProviderIds = looseChecksum({
      ...manifest,
      manifest_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      idempotency_key: 'ot106:manifest:provider-ids',
      targets: [
        {
          alias: 'facebook-main',
          platform: 'facebook',
          organization_id: 'caller_org_forbidden',
          channel_id: 'caller_channel_forbidden',
        },
      ],
    });
    expect(await receiveSignedUnknown(withProviderIds)).toMatchObject({ status: 422 });

    const missingApproval = looseChecksum({
      ...manifest,
      manifest_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      idempotency_key: 'ot106:manifest:missing-approval',
      approval: undefined,
    });
    expect(await receiveSignedUnknown(missingApproval)).toMatchObject({ status: 422 });
  });

  it('rejects unsafe media URLs and learner-data sentinels before queueing', async () => {
    const unsafeUrl = publicationManifest({
      manifest_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      idempotency_key: 'ot106:manifest:unsafe-url',
      media: [
        {
          ...safeMedia(),
          url: 'https://drive.google.com/file/d/private-preview',
        },
      ],
    });
    expect(await receiveSigned(unsafeUrl)).toMatchObject({ status: 422 });

    const learnerData = looseChecksum({
      ...publicationManifest({
        manifest_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        idempotency_key: 'ot106:manifest:learner-data',
      }),
      privacy: {
        ...privacy(),
        contains_learner_question: true,
      },
    });
    expect(await receiveSignedUnknown(learnerData)).toMatchObject({ status: 422 });
    expect(await countRows('onetime.ot106_publication_manifests')).toBe(0);
  });
});

describe('OT-106 queue processing and alias mapping', () => {
  it('creates auditable sink drafts with no external writes and maps aliases server-side', async () => {
    const manifest = publicationManifest();
    await receiveSigned(manifest);
    const config = runtimeConfig('sink');
    const readiness = inspectOt106BufferReadiness(config);
    expect(readiness).toMatchObject({ state: 'sink_ready', can_create_draft: true });

    const result = await processOt106BufferQueueOnce({
      pool,
      config,
      adapter: createOt106SinkAdapter(),
      now: new Date('2026-07-16T20:01:00Z'),
    });
    expect(result).toMatchObject({
      inspected: 1,
      provider_writes: 0,
      provider_drafts: 1,
      failed: 0,
    });
    expect(await manifestState(manifest.manifest_id)).toBe('provider_draft_created');
    const target = await pool.query(
      `SELECT target_alias, channel_id, provider_post_id, target_state
         FROM onetime.ot106_publication_targets
        WHERE manifest_id = $1`,
      [manifest.manifest_id],
    );
    expect(target.rows[0]).toMatchObject({
      target_alias: 'facebook-main',
      channel_id: 'buffer_channel_facebook_001',
      target_state: 'provider_draft_created',
    });
    expect(String(target.rows[0]?.provider_post_id)).toMatch(/^ot106_sink_post_/);
  });

  it('supports explicit scheduled mode through scheduled runtime authorization', async () => {
    const manifest = publicationManifest({
      manifest_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      idempotency_key: 'ot106:manifest:scheduled',
      mode: 'scheduled',
      due_at_utc: '2026-07-17T15:00:00Z',
      runtime_authorization: {
        authorization_id: 'authz_ot106_schedule_001',
        authorized_by_actor_id: 'actor_owner_001',
        authorized_at: '2026-07-16T19:00:00Z',
        authorization_phrase: 'APPROVE_OT106_BUFFER_SCHEDULE',
      },
    });
    await receiveSigned(manifest, { now: new Date('2026-07-16T19:00:10Z') });
    const adapter = recordingAdapter({
      status: 'scheduled',
      provider_post_id: 'buffer_post_scheduled_001',
      sanitized_code: 'buffer_scheduled',
      retryable: false,
      response_sha256: digest('scheduled'),
      http_status: 200,
      external_write_performed: true,
    });
    const result = await processOt106BufferQueueOnce({
      pool,
      config: runtimeConfig('buffer_scheduled'),
      adapter,
      now: new Date('2026-07-16T20:01:00Z'),
    });
    expect(result).toMatchObject({ scheduled: 1, provider_writes: 1 });
    expect(adapter.inputs[0]?.operation).toBe('scheduled');
    expect(adapter.inputs[0]?.binding.channel_id).toBe('buffer_channel_facebook_001');
    expect(await manifestState(manifest.manifest_id)).toBe('scheduled');
  });

  it('retries only failed target aliases without duplicating successful Buffer drafts', async () => {
    const manifest = publicationManifest({
      manifest_id: '22222222-2222-4222-8222-222222222222',
      idempotency_key: 'ot106:manifest:partial-retry',
      targets: [
        { alias: 'facebook-main', platform: 'facebook' },
        { alias: 'instagram-main', platform: 'instagram' },
      ],
    });
    await receiveSigned(manifest);
    const inputs: Ot106ProviderPostInput[] = [];
    const adapter: Ot106BufferAdapter = {
      createPost: async (input) => {
        inputs.push(input);
        if (input.targetAlias === 'instagram-main' && inputs.length === 2) {
          return {
            status: 'retryable_failure',
            sanitized_code: 'buffer_rate_limit_exceeded',
            retryable: true,
            retry_after_seconds: 60,
            response_sha256: digest('retryable-instagram'),
            http_status: 429,
            external_write_performed: false,
          };
        }
        return {
          status: 'created',
          provider_post_id: `buffer_post_${input.targetAlias}_${inputs.length}`,
          sanitized_code: 'buffer_draft_created',
          retryable: false,
          response_sha256: digest(`created-${input.targetAlias}-${inputs.length}`),
          http_status: 200,
          external_write_performed: true,
        };
      },
    };
    const first = await processOt106BufferQueueOnce({
      pool,
      config: multiChannelRuntimeConfig('buffer_draft'),
      adapter,
      now: new Date('2026-07-16T20:01:00Z'),
    });
    expect(first).toMatchObject({ provider_drafts: 1, failed: 1, provider_writes: 1 });
    expect(await manifestState(manifest.manifest_id)).toBe('retryable_failure');

    const second = await processOt106BufferQueueOnce({
      pool,
      config: multiChannelRuntimeConfig('buffer_draft'),
      adapter,
      now: new Date('2026-07-16T20:02:01Z'),
    });
    expect(second).toMatchObject({ provider_drafts: 1, failed: 0, provider_writes: 1 });
    expect(inputs.map((input) => input.targetAlias)).toEqual([
      'facebook-main',
      'instagram-main',
      'instagram-main',
    ]);
    expect(await providerAttemptCount(manifest.manifest_id, 'facebook-main')).toBe(1);
    expect(await providerAttemptCount(manifest.manifest_id, 'instagram-main')).toBe(2);
    expect(await manifestState(manifest.manifest_id)).toBe('provider_draft_created');
  });

  it('records missing aliases as dead letters and can cancel queued work', async () => {
    const manifest = publicationManifest({
      manifest_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      idempotency_key: 'ot106:manifest:missing-alias',
      targets: [{ alias: 'unknown-alias' }],
    });
    await receiveSigned(manifest);
    const result = await processOt106BufferQueueOnce({
      pool,
      config: runtimeConfig('sink'),
      adapter: createOt106SinkAdapter(),
      now: new Date('2026-07-16T20:01:00Z'),
    });
    expect(result.failed).toBe(1);
    expect(await manifestState(manifest.manifest_id)).toBe('dead_lettered');

    const cancelable = publicationManifest({
      manifest_id: '11111111-1111-4111-8111-111111111111',
      idempotency_key: 'ot106:manifest:cancelable',
    });
    await receiveSigned(cancelable);
    await cancelOt106Manifest({
      pool,
      manifestId: cancelable.manifest_id,
      actorId: 'actor_owner_001',
      reasonCode: 'operator_cancelled',
    });
    expect(await manifestState(cancelable.manifest_id)).toBe('canceled');
  });
});

describe('OT-106 Buffer response parsing', () => {
  it('classifies GraphQL, typed mutation, auth, rate-limit, and server errors truthfully', () => {
    expect(
      parseBufferGraphqlCreatePostResponse({
        httpStatus: 200,
        bodyText: JSON.stringify({
          data: { createPost: { post: { id: 'post_001', status: 'draft' } } },
        }),
        operation: 'draft',
      }),
    ).toMatchObject({
      status: 'created',
      provider_post_id: 'post_001',
      external_write_performed: true,
    });

    expect(
      parseBufferGraphqlCreatePostResponse({
        httpStatus: 200,
        bodyText: JSON.stringify({
          data: null,
          errors: [{ message: 'No auth', extensions: { code: 'UNAUTHORIZED' } }],
        }),
        operation: 'draft',
      }),
    ).toMatchObject({ status: 'dead_lettered', sanitized_code: 'buffer_graphql_unauthorized' });

    expect(
      parseBufferGraphqlCreatePostResponse({
        httpStatus: 200,
        bodyText: JSON.stringify({ data: { createPost: { message: 'Text is required' } } }),
        operation: 'draft',
      }),
    ).toMatchObject({ status: 'dead_lettered', sanitized_code: 'buffer_mutation_error' });

    expect(
      parseBufferGraphqlCreatePostResponse({
        httpStatus: 429,
        retryAfter: '120',
        bodyText: JSON.stringify({ errors: [{ extensions: { code: 'RATE_LIMIT_EXCEEDED' } }] }),
        operation: 'draft',
      }),
    ).toMatchObject({
      status: 'retryable_failure',
      retry_after_seconds: 120,
      sanitized_code: 'buffer_rate_limit_exceeded',
    });

    expect(
      parseBufferGraphqlCreatePostResponse({
        httpStatus: 503,
        bodyText: 'temporarily unavailable',
        operation: 'draft',
      }),
    ).toMatchObject({ status: 'retryable_failure', sanitized_code: 'buffer_server_error' });
  });
});

function publicationManifest(
  overrides: Partial<Ot106PublicationManifest> = {},
): Ot106PublicationManifest {
  const base: Omit<Ot106PublicationManifest, 'manifest_sha256'> = {
    schema_version: 1,
    event_type: 'ot106.social_publication_manifest',
    manifest_id: '33333333-3333-4333-8333-333333333333',
    idempotency_key: 'ot106:manifest:approved-001',
    account_key: 'one_time',
    product_key: 'one_time_mishnah_class',
    source: {
      pipeline: 'one_time_content_pipeline',
      content_id: 'content_ot106_001',
      derivative_batch_id: 'derivatives_ot106_001',
      source_sha256: digest('source-content'),
      provenance_url: 'https://join.onetimeonetime.com/library/content_ot106_001',
    },
    caption: {
      text: 'Approved One Time class highlight with no private learner material.',
      hashtags: ['#OneTime', '#Mishnah'],
    },
    targets: [{ alias: 'facebook-main', platform: 'facebook' }],
    mode: 'draft',
    approval: {
      approval_id: 'approval_ot106_001',
      approved_by_actor_id: 'actor_owner_001',
      approved_by_role: 'owner',
      approved_at: '2026-07-16T18:00:00Z',
      policy_version: 'ot106-social-v1',
    },
    media: [safeMedia()],
    privacy: privacy(),
    checksum_algorithm: 'sha256',
    created_at: '2026-07-16T18:00:10Z',
    ...overrides,
  };
  return withOt106ManifestChecksum(base);
}

function safeMedia() {
  return {
    derivative_id: 'derivative_image_001',
    kind: 'image' as const,
    url: 'https://cdn.onetime.example/approved/derivative-image-001.png',
    mime_type: 'image/png',
    sha256: digest('derivative-image'),
    byte_length: 120_000,
    alt_text: 'Approved class graphic',
    subject_classification: 'graphics_only' as const,
    privacy: privacy(),
    public_safety: {
      stable_https_url: true,
      direct_public_url: true,
      not_signed_or_expiring: true,
      no_authentication_required: true,
      privacy_review_passed: true,
    } as const,
  };
}

function privacy() {
  return {
    source_scope: 'approved_one_time_social_derivative' as const,
    contains_learner_name: false,
    contains_learner_voice: false,
    contains_learner_face: false,
    contains_learner_question: false,
    contains_private_data: false,
    approved_for_social: true,
  } as const;
}

function runtimeConfig(mode: Ot106RuntimeConfig['mode']): Ot106RuntimeConfig {
  return {
    accountKey: 'one_time',
    productKey: 'one_time_mishnah_class',
    mode,
    ...(mode === 'sink'
      ? {}
      : { bufferAccessToken: 'test_buffer_token_abcdefghijklmnopqrstuvwxyz' }),
    bufferOrganizationId: 'buffer_org_001',
    channels: parseOt106BufferChannelAliases(
      'facebook-main=buffer_channel_facebook_001:facebook:Facebook Main',
      'buffer_org_001',
    ),
    maxAttempts: 5,
  };
}

function multiChannelRuntimeConfig(mode: Ot106RuntimeConfig['mode']): Ot106RuntimeConfig {
  return {
    ...runtimeConfig(mode),
    channels: parseOt106BufferChannelAliases(
      [
        'facebook-main=buffer_channel_facebook_001:facebook:Facebook Main',
        'instagram-main=buffer_channel_instagram_001:instagram:Instagram Main',
      ].join(','),
      'buffer_org_001',
    ),
  };
}

function recordingAdapter(result: Awaited<ReturnType<Ot106BufferAdapter['createPost']>>) {
  const inputs: Ot106ProviderPostInput[] = [];
  return {
    inputs,
    createPost: async (input: Ot106ProviderPostInput) => {
      inputs.push(input);
      return result;
    },
  } satisfies Ot106BufferAdapter & { inputs: Ot106ProviderPostInput[] };
}

async function receiveSigned(
  manifest: Ot106PublicationManifest,
  options: { deliveryId?: string; rawOverride?: string; now?: Date } = {},
) {
  const rawBody = Buffer.from(options.rawOverride ?? JSON.stringify(manifest), 'utf8');
  const timestamp = String(
    Math.floor((options.now ?? new Date('2026-07-16T19:00:00Z')).getTime() / 1000),
  );
  return receiveOt106PublicationManifest({
    pool,
    rawBody,
    headers: headersFor(
      rawBody,
      options.deliveryId ?? manifest.manifest_id,
      timestamp,
      signOt106Manifest({ secret: secret.secret, timestamp, rawBody }),
    ),
    secrets: [secret],
    expectedAccountKey: 'one_time',
    expectedProductKey: 'one_time_mishnah_class',
    now: new Date(Number(timestamp) * 1000),
  });
}

async function receiveSignedUnknown(manifest: Record<string, unknown>) {
  const parsed = manifest as { manifest_id?: string };
  const rawBody = Buffer.from(JSON.stringify(manifest), 'utf8');
  const timestamp = String(Math.floor(new Date('2026-07-16T19:00:00Z').getTime() / 1000));
  return receiveOt106PublicationManifest({
    pool,
    rawBody,
    headers: headersFor(
      rawBody,
      parsed.manifest_id ?? '33333333-3333-4333-8333-333333333333',
      timestamp,
      signOt106Manifest({ secret: secret.secret, timestamp, rawBody }),
    ),
    secrets: [secret],
    expectedAccountKey: 'one_time',
    expectedProductKey: 'one_time_mishnah_class',
    now: new Date(Number(timestamp) * 1000),
  });
}

function headersFor(rawBody: Buffer, deliveryId: string, timestamp: string, signature: string) {
  void rawBody;
  return {
    contentType: 'application/json',
    keyId: secret.keyId,
    timestamp,
    deliveryId,
    signature,
  };
}

function looseChecksum(manifest: Record<string, unknown>) {
  const clone = { ...manifest };
  delete clone.manifest_sha256;
  return {
    ...clone,
    manifest_sha256: digest(canonicalOt106Json(clone)),
  };
}

async function manifestState(manifestId: string) {
  const result = await pool.query(
    `SELECT state FROM onetime.ot106_publication_manifests WHERE manifest_id = $1`,
    [manifestId],
  );
  return String(result.rows[0]?.state ?? '');
}

async function countRows(table: string) {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function providerAttemptCount(manifestId: string, targetAlias: string) {
  const result = await pool.query(
    `SELECT count(*)::int AS count
       FROM onetime.ot106_provider_attempts
      WHERE manifest_id = $1
        AND target_alias = $2`,
    [manifestId, targetAlias],
  );
  return Number(result.rows[0]?.count ?? 0);
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
