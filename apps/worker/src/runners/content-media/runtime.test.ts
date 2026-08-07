import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../../../../packages/config/src/index.ts';
import { runContentPublicationWorker } from '../content-publication/composition.ts';
import {
  createCanaryBoundPublicationRepositories,
  AwsProcessingMediaStore,
  createBroadBoundPublicationRepositories,
  createContentMediaWorkerRuntime,
} from './runtime.ts';

describe('createContentMediaWorkerRuntime', () => {
  it('creates no provider runtime and performs zero provider/database calls while mode is off', () => {
    const pool = { query: vi.fn(() => Promise.reject(new Error('database call forbidden'))) };
    const dependencies = new Proxy(
      {},
      {
        get() {
          throw new Error('provider dependency touched while off');
        },
      },
    );

    expect(
      createContentMediaWorkerRuntime({
        config: loadConfig({ NODE_ENV: 'test', ONE_TIME_CONTENT_MEDIA_MODE: 'off' }),
        pool: pool as never,
        source: {},
        dependencies: dependencies as never,
      }),
    ).toBeUndefined();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('fails closed without touching providers when production-broad provider bindings are incomplete', () => {
    const pool = { query: vi.fn(() => Promise.reject(new Error('database call forbidden'))) };
    const dependencies = new Proxy(
      {},
      {
        get() {
          throw new Error('provider dependency touched while broad runtime is incomplete');
        },
      },
    );
    const config = loadConfig({
      NODE_ENV: 'production',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
      ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_broad',
      ONE_TIME_CONTENT_MEDIA_MODE: 'production_broad',
      ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID: 'broad-authority-test',
      ONE_TIME_FIRST_CLASS_AT: '2026-08-16T19:00:00+03:00',
      ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-09-11T18:00:00+03:00',
      AUTH_CSRF_SECRET: 'content-media-production-csrf-secret',
      PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'content-media-production-payload-key',
    });

    expect(
      createContentMediaWorkerRuntime({
        config,
        pool: pool as never,
        source: {},
        dependencies: dependencies as never,
      }),
    ).toBeUndefined();
    expect(pool.query).not.toHaveBeenCalled();
    expect(JSON.stringify(config)).not.toMatch(/vimeo_access_token|openai_api_key/iu);
  });

  it('claims multiple broad publication jobs only inside the account, approval, and batch fences', async () => {
    const query = vi.fn(async (sql: string, values?: unknown[]) => {
      expect(sql).toContain('publication.account_key = $4');
      expect(sql).toContain("publication.state = 'pending'");
      expect(sql).toContain("publication.intent_json->'approvalEvidence' IS NOT NULL");
      expect(sql).toContain("processing.processing_state = 'approved'");
      expect(sql).toContain('job.unknown_effect = false');
      expect(sql).toContain('FOR UPDATE OF job SKIP LOCKED');
      expect(values?.[3]).toBe('account-broad');
      expect(values?.[6]).toBe(2);
      return {
        rows: [providerJobRow('job-one'), providerJobRow('job-two')],
        rowCount: 2,
      };
    });
    const repositories = createBroadBoundPublicationRepositories({
      pool: { query } as never,
      accountKey: 'account-broad',
      maxBatchSize: 2,
      jobRepository: {
        heartbeat: vi.fn(),
        markInFlight: vi.fn(),
        recordDispatchOutcome: vi.fn(),
        claimDueJobs: vi.fn(),
      } as never,
      publicationRepository: {
        inTransaction: vi.fn(),
        reopenDispatchContext: vi.fn(),
        listAcceptanceUnknownOperations: vi.fn(),
        listAcceptedPendingWork: vi.fn(),
      } as never,
    });
    const claim = {
      owner: 'worker-broad',
      now: new Date('2026-08-07T12:00:00.000Z'),
      limit: 9,
      scope: {
        product: 'one_time_mishnayos' as const,
        runtime_tier: 'production' as const,
        verification_environment_id: 'production_broad' as const,
      },
      operation_types: ['publish_private'],
    };

    await expect(repositories.jobRepository.claimDueJobs(claim)).resolves.toHaveLength(2);
    await expect(
      repositories.jobRepository.claimDueJobs({
        ...claim,
        scope: { ...claim.scope, verification_environment_id: 'production_operator_canary' },
      }),
    ).rejects.toThrow('content_publication_broad_scope_mismatch');
    expect(query).toHaveBeenCalledOnce();
  });

  it('leaves non-canary and same-canary non-publication decoys untouched with zero provider calls', async () => {
    const canaryId = 'recording-canary-1';
    const dueNonCanary = {
      job_id: 'job-other',
      aggregate_ref: 'recording-other',
      state: 'not_started',
      version: 1,
      lease_owner: null,
    };
    const sameCanaryWrongRegistry = {
      job_id: 'job-wrong-registry',
      aggregate_ref: canaryId,
      provider: 'vimeo',
      publication_state: 'pending',
      binding_registry_key: 'vimeo_publication_secondary',
      binding_effect_kind: 'mutation',
      state: 'not_started',
      version: 1,
      lease_owner: null,
    };
    const sameCanaryWrongEffect = {
      job_id: 'job-wrong-effect',
      aggregate_ref: canaryId,
      provider: 'vimeo',
      publication_state: 'pending',
      binding_registry_key: 'vimeo_publication_primary',
      binding_effect_kind: 'readback',
      state: 'not_started',
      version: 1,
      lease_owner: null,
    };
    const before = JSON.stringify({
      dueNonCanary,
      sameCanaryWrongRegistry,
      sameCanaryWrongEffect,
    });
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      expect(text).toContain('aggregate_ref = $4');
      expect(values?.[3]).toBe(canaryId);
      expect(text).toContain("binding.registry_binding_key = 'vimeo_publication_primary'");
      expect(text).toContain("binding.effect_kind = 'mutation'");
      if (text.includes('WITH candidate AS')) {
        expect(text).toContain('content_publication_outbox');
        expect(text).toContain('provider_operation_binding');
        expect(text).toContain("job.provider = 'vimeo'");
        expect(text).toContain("publication.state = 'pending'");
        expect(text).toContain('publication.content_version_id = job.payload_ref');
        expect(text).toContain('publication.publication_generation = job.source_version');
        expect(text).toContain('publication.request_hash = job.canonical_request_hash');
      }
      return {
        rows: [],
        rowCount: 0,
      };
    });
    const baseJob = {
      claimDueJobs: vi.fn(async () => {
        throw new Error('broad job claim must not run');
      }),
      heartbeat: vi.fn(),
      markInFlight: vi.fn(),
      recordDispatchOutcome: vi.fn(),
    };
    const basePublication = {
      inTransaction: vi.fn(),
      reopenDispatchContext: vi.fn(),
      listAcceptanceUnknownOperations: vi.fn(async () => {
        throw new Error('broad unknown selector must not run');
      }),
      listAcceptedPendingWork: vi.fn(async () => {
        throw new Error('broad finalization selector must not run');
      }),
    };
    const bounded = createCanaryBoundPublicationRepositories({
      pool: { query } as never,
      canaryId,
      jobRepository: baseJob as never,
      publicationRepository: basePublication as never,
    });
    const providerCalls = {
      dispatch: vi.fn(),
      reconcile: vi.fn(),
      finalize: vi.fn(),
    };

    const result = await runContentPublicationWorker(
      {
        config: {
          contentMediaEnabled: true,
          contentMediaMode: 'provider_canary',
          contentMediaCanaryId: canaryId,
          oneTimeRuntimeTier: 'production',
          oneTimeVerificationEnvironmentId: 'production_operator_canary',
        },
        workerInstanceKey: 'worker-1',
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      } as never,
      {
        jobRepository: bounded.jobRepository,
        publicationRepository: bounded.publicationRepository,
        approvedProjectionRepository: {} as never,
        providerRepository: { persistReconciliation: vi.fn() } as never,
        registry: { readActiveRegistryBinding: vi.fn() } as never,
        authority: { getPreapprovedRequest: vi.fn() },
        vimeoBinding: {
          registry_binding_key: 'vimeo_publication_primary',
          provider: 'vimeo',
          scope: {
            product: 'one_time_mishnayos',
            runtime_tier: 'production',
            verification_environment_id: 'production_operator_canary',
          },
          provider_account_ref_hash: '1'.repeat(64),
          allowed_operation_types: ['publish_private', 'revoke_private'],
          mutation_policy: 'allowed',
          active: true,
        },
        dispatchAdapter: { dispatch: providerCalls.dispatch },
        reconciliationAdapter: { provider: 'vimeo', readCanonical: providerCalls.reconcile },
        finalizationReadbackAdapter: { readCanonical: providerCalls.finalize },
        createId: () => 'unused',
        options: { batchSize: 1, clock: () => new Date('2026-08-04T00:00:00.000Z') },
      } as never,
    );

    expect(result.providerCallsPerformed).toBe(false);
    expect(JSON.stringify({ dueNonCanary, sameCanaryWrongRegistry, sameCanaryWrongEffect })).toBe(
      before,
    );
    expect(baseJob.claimDueJobs).not.toHaveBeenCalled();
    expect(basePublication.listAcceptanceUnknownOperations).not.toHaveBeenCalled();
    expect(basePublication.listAcceptedPendingWork).not.toHaveBeenCalled();
    expect(providerCalls.dispatch).not.toHaveBeenCalled();
    expect(providerCalls.reconcile).not.toHaveBeenCalled();
    expect(providerCalls.finalize).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('rejects a source readback whose provider VersionId differs before writing bytes', async () => {
    const sourceKey = `source_${'d'.repeat(32)}`;
    const bytes = Buffer.from('correct bytes from the wrong object version');
    const directory = await mkdtemp(path.join(tmpdir(), 'source-download-test-'));
    const destinationPath = path.join(directory, 'source.mp4');
    const store = derivativeStore({
      poolQuery: async () => ({
        rows: [{ upload_json: { opaqueObjectKey: sourceKey } }],
        rowCount: 1,
      }),
      s3Send: async (command) => {
        expect(commandName(command)).toBe('GetObjectCommand');
        return { VersionId: 'wrong-version', Body: Readable.from([bytes]) };
      },
    });

    try {
      await expect(
        store.downloadSource(
          {
            accountKey: 'account-1',
            productKey: 'one-time',
            id: 'source-1',
            objectKeyDigest: sha(sourceKey),
            objectVersionId: 'expected-version',
            byteCount: bytes.byteLength,
            sha256: sha(bytes),
          } as never,
          destinationPath,
        ),
      ).rejects.toThrow('content_processing_original_version_readback_mismatch');
      await expect(stat(destinationPath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects forged derivative metadata instead of reconstructing asserted codec proof', async () => {
    const operationId = 'a'.repeat(64);
    const bytes = Buffer.from('measured derivative bytes');
    const store = derivativeStore({
      s3Send: async (command) => {
        switch (commandName(command)) {
          case 'ListObjectVersionsCommand':
            return { Versions: [{ Key: `derivative_${operationId}`, VersionId: 'version-1' }] };
          case 'HeadObjectCommand':
            return derivativeHead(operationId, 'version-1', bytes, 'f'.repeat(64));
          case 'GetObjectCommand':
            return { VersionId: 'version-1', Body: Readable.from([bytes]) };
          default:
            throw new Error(`unexpected ${commandName(command)}`);
        }
      },
    });
    store.bindDerivativeVerifier(async (filePath, versionId) =>
      measuredDerivative(versionId, await readFile(filePath)),
    );

    await expect(store.readDerivative(operationId)).rejects.toThrow(
      'content_processing_derivative_measured_readback_mismatch',
    );
  });

  it('fails closed on same-key derivative version ambiguity after unknown Put completion', async () => {
    const operationId = 'b'.repeat(64);
    const directory = await mkdtemp(path.join(tmpdir(), 'derivative-upload-test-'));
    const filePath = path.join(directory, 'derivative.mp4');
    const bytes = Buffer.from('new derivative');
    await writeFile(filePath, bytes);
    let scans = 0;
    const store = derivativeStore({
      s3Send: async (command) => {
        if (commandName(command) === 'ListObjectVersionsCommand') {
          scans += 1;
          return scans === 1
            ? { Versions: [] }
            : {
                Versions: [
                  { Key: `derivative_${operationId}`, VersionId: 'version-1' },
                  { Key: `derivative_${operationId}`, VersionId: 'version-2' },
                ],
              };
        }
        if (commandName(command) === 'PutObjectCommand') {
          throw new Error('simulated timeout after unknown acceptance');
        }
        throw new Error(`unexpected ${commandName(command)}`);
      },
    });
    store.bindDerivativeVerifier(async (_path, versionId) => measuredDerivative(versionId, bytes));
    try {
      await expect(
        store.uploadDerivative({
          operationId,
          source: {} as never,
          filePath,
          readback: measuredDerivative('local-version', bytes),
        }),
      ).rejects.toThrow('content_processing_derivative_version_ambiguous');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('binds a Vimeo pull URL to the measured derivative version despite a later current version', async () => {
    const operationId = 'c'.repeat(64);
    const bytes = Buffer.from('verified version one');
    let currentVersion = 'version-1';
    const signedVersions: string[] = [];
    const store = derivativeStore({
      poolQuery: async () => ({
        rows: [
          {
            record_json: {
              transcodePlan: { command: { args: ['-i', 'source', `derivative_${operationId}`] } },
            },
          },
        ],
        rowCount: 1,
      }),
      s3Send: async (command) => {
        switch (commandName(command)) {
          case 'ListObjectVersionsCommand':
            return {
              Versions: [{ Key: `derivative_${operationId}`, VersionId: 'version-1' }],
            };
          case 'HeadObjectCommand':
            return derivativeHead(operationId, 'version-1', bytes, sha(bytes));
          case 'GetObjectCommand':
            currentVersion = 'version-2';
            return { VersionId: 'version-1', Body: Readable.from([bytes]) };
          default:
            throw new Error(`unexpected ${commandName(command)}`);
        }
      },
      signPrivateGet: async (_client, command) => {
        signedVersions.push(command.input.VersionId!);
        expect(currentVersion).toBe('version-2');
        return 'https://signed.invalid/version-1';
      },
    });
    store.bindDerivativeVerifier(async (filePath, versionId) =>
      measuredDerivative(versionId, await readFile(filePath)),
    );

    await expect(store.createPrivatePullUrl('content-version-1')).resolves.toBe(
      'https://signed.invalid/version-1',
    );
    expect(signedVersions).toEqual(['version-1']);
  });
});

function derivativeStore(input: {
  s3Send: (command: unknown) => Promise<unknown>;
  poolQuery?: (text: string, values?: unknown[]) => Promise<unknown>;
  signPrivateGet?: (client: never, command: { input: { VersionId?: string } }) => Promise<string>;
}) {
  const config = {
    ...loadConfig({ NODE_ENV: 'test', ONE_TIME_CONTENT_MEDIA_MODE: 'off' }),
    accountKey: 'account-1',
    productKey: 'one-time',
    contentS3Bucket: 'private-derivatives',
    contentS3KmsKeyArn: 'kms-version-1',
    contentS3StorageClass: 'STANDARD' as const,
  };
  return new AwsProcessingMediaStore({
    config,
    pool: {
      query: vi.fn(
        input.poolQuery ??
          (async () => {
            throw new Error('unexpected database query');
          }),
      ),
    } as never,
    s3: { send: vi.fn(input.s3Send) } as never,
    registry: {
      readActiveRegistryBinding: vi.fn(async () => ({ binding: {}, observed_at: '' })),
    } as never,
    registryProof: {
      expected_provider_account_ref_hash: '1'.repeat(64),
      expected_registry_evidence_digest: '2'.repeat(64),
      expected_provider_readback_evidence_digest: '3'.repeat(64),
      expected_version: 1,
      observed_not_before: '2026-08-04T00:00:00.000Z',
    },
    identity: { readIdentity: vi.fn(async () => ({})) } as never,
    ...(input.signPrivateGet ? { signPrivateGet: input.signPrivateGet as never } : {}),
  });
}

function derivativeHead(
  operationId: string,
  versionId: string,
  bytes: Uint8Array,
  metadataSha: string,
) {
  return {
    VersionId: versionId,
    ContentLength: bytes.byteLength,
    ChecksumSHA256: Buffer.from(sha(bytes), 'hex').toString('base64'),
    ServerSideEncryption: 'aws:kms',
    SSEKMSKeyId: 'kms-version-1',
    StorageClass: 'STANDARD',
    Metadata: {
      'ot-operation-id': operationId,
      'ot-byte-count': String(bytes.byteLength),
      'ot-sha256': metadataSha,
    },
  };
}

function measuredDerivative(versionId: string, bytes: Uint8Array) {
  return {
    profileVersion: 'OT-VIDEO-1' as const,
    objectVersionId: versionId,
    byteCount: bytes.byteLength,
    sha256: sha(bytes),
    container: 'mp4' as const,
    durationMs: 1_000,
    width: 1280,
    height: 720,
    framesPerSecond: 30,
    videoCodec: 'h264' as const,
    pixelFormat: 'yuv420p' as const,
    audioCodec: 'aac' as const,
    audioProfile: 'LC' as const,
    audioSampleRateHz: 48_000 as const,
    audioChannels: 2 as const,
    audioBitrateBps: 128_000 as const,
    fastStart: true as const,
    decodeFailure: false as const,
    sourceMetadataRemoved: true as const,
  };
}

function commandName(command: unknown) {
  return (command as { constructor: { name: string } }).constructor.name;
}

function sha(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function providerJobRow(jobId: string) {
  return {
    job_id: jobId,
    operation_type: 'publish_private',
    aggregate_ref: `content-${jobId}`,
    source_version: 1,
    provider: 'vimeo',
    product: 'one_time_mishnayos',
    runtime_tier: 'production',
    verification_environment_id: 'production_broad',
    idempotency_key: `idempotency-${jobId}`,
    canonical_request_hash: 'a'.repeat(64),
    payload_ref: `version-${jobId}`,
    payload_digest: 'b'.repeat(64),
    compensation_for_job_id: null,
    state: 'leased',
    version: 2,
    recovery_generation: 0,
    dispatch_attempts: 0,
    lifetime_dispatch_attempts: 0,
    reconciliation_attempts: 0,
    lease_owner: 'worker-broad',
    lease_generation: 1,
    lease_expires_at: '2026-08-07T12:01:00.000Z',
    last_heartbeat_at: '2026-08-07T12:00:00.000Z',
    next_attempt_at: null,
    unknown_effect: false,
    provider_acceptance_digest: null,
    reconciliation_digest: null,
    safe_error_code: null,
    created_at: '2026-08-07T11:00:00.000Z',
    updated_at: '2026-08-07T12:00:00.000Z',
  };
}
