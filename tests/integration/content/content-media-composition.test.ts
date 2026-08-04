import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../../packages/config/src/index.ts';
import { runWorkerRunners } from '../../../apps/worker/src/runners/registry/index.ts';
import {
  AwsS3ManagedOriginalAdapter,
  S3_CONTENT_ORIGINAL_REGISTRY_KEY,
} from '../../../packages/db/src/content/ingest/s3-managed-original-adapter.ts';

describe('OT-LIVE-004 shared media composition', () => {
  it('proves the default-off synthetic canary performs zero database and provider effects', async () => {
    const calls: string[] = [];
    const results = await runWorkerRunners({
      context: {
        config: loadConfig({ NODE_ENV: 'test' }),
        pool: {
          query: vi.fn(async () => {
            calls.push('database');
            throw new Error('unexpected_database_effect');
          }),
          connect: vi.fn(async () => {
            calls.push('database');
            throw new Error('unexpected_database_effect');
          }),
          end: vi.fn(),
        } as never,
        source: { NODE_ENV: 'test' },
        workerInstanceKey: 'synthetic-default-off',
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      },
    });

    expect(calls).toEqual([]);
    expect(results['content.media-ingest']).toMatchObject({
      enabled: false,
      providerCallsPerformed: false,
      summary: { canaryBudget: 1, providerCalls: 0, databaseWrites: 0 },
    });
    expect(results['content.media-processing']).toMatchObject({
      enabled: false,
      providerCallsPerformed: false,
      summary: { canaryBudget: 1, providerCalls: 0, commandsSelected: 0 },
    });
    expect(results['content.p21-publication']).toMatchObject({
      enabled: false,
      providerCallsPerformed: false,
      summary: { canaryBudget: 1, mediaMode: 'off', providerCalls: 0 },
    });
  });

  it('keeps synthetic mode source-only when no runtime adapters are injected', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      ONE_TIME_CONTENT_MEDIA_MODE: 'synthetic_canary',
      ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID: 'authorization-ot-live-004',
      ONE_TIME_CONTENT_CANARY_ID: 'one-operator-recording',
    });
    const results = await runWorkerRunners({
      context: {
        config,
        pool: { query: vi.fn(), connect: vi.fn(), end: vi.fn() } as never,
        source: { NODE_ENV: 'test' },
        workerInstanceKey: 'synthetic-enabled-no-adapters',
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      },
    });

    expect(results['content.media-ingest']).toMatchObject({
      enabled: false,
      providerCallsPerformed: false,
      summary: { disabledReason: 'content_drive_optional_provider_off', driveNonblocking: true },
    });
    expect(results['content.media-processing']).toMatchObject({
      enabled: false,
      providerCallsPerformed: false,
      summary: { disabledReason: 'content_processing_runtime_unavailable' },
    });
    expect(results['content.p21-publication']).toMatchObject({
      enabled: false,
      providerCallsPerformed: false,
      summary: { disabledReason: 'content_publication_authority_unavailable' },
    });
  });

  it('reads the accepted schema migrations without creating or applying a successor', async () => {
    const migrations = await Promise.all(
      [
        '2245_v21_content_ingest.sql',
        '2246_v21_content_processing.sql',
        '2252_v21_content_publication.sql',
        '2253_v21_content_publication_projection_v2.sql',
      ].map((name) => readFile(`packages/db/migrations/${name}`, 'utf8')),
    );
    expect(migrations.every((migration) => migration.length > 1_000)).toBe(true);
    expect(migrations.join('\n')).toMatch(/content_ingest_upload_sessions/u);
    expect(migrations.join('\n')).toMatch(/content_processing_versions/u);
    expect(migrations.join('\n')).toMatch(/onetime\.content_publications/u);
  });

  it('accepts only identity-bound, checksum-consistent managed-original readback', async () => {
    const sha = 'a'.repeat(64);
    const objectKeyDigest = 'b'.repeat(64);
    const completed = {
      readback: {
        runtimeTier: 'isolated_staging' as const,
        verificationEnvironmentId: 'ci',
        region: 'eu-central-1' as const,
        bucketRef: 'one-time-private-media',
        objectKeyDigest,
        objectVersionId: 'version-one',
        byteCount: 1_024,
        durabilityEvidenceVersion: 'OT-MANAGED-ORIGINAL-1' as const,
        checksumAlgorithm: 'sha256' as const,
        sha256: sha,
        kmsKeyVersionRef: 'kms-version-one',
        storageClass: 'STANDARD',
        blockPublicAccess: true as const,
        bucketOwnerEnforced: true as const,
      },
      journalReceipt: {
        receiptId: 'receipt-one',
        uploadSessionId: 'upload-one',
        runtimeTier: 'isolated_staging' as const,
        verificationEnvironmentId: 'ci',
        durabilityEvidenceVersion: 'OT-MANAGED-ORIGINAL-1' as const,
        bucketRef: 'one-time-private-media',
        objectKeyDigest,
        objectVersionId: 'version-one',
        byteCount: 1_024,
        checksumAlgorithm: 'sha256' as const,
        sha256: sha,
        kmsKeyVersionRef: 'kms-version-one',
        storageClass: 'STANDARD',
        writtenAt: '2026-08-04T13:00:00.000Z',
        readBackAt: '2026-08-04T13:00:01.000Z',
      },
    };
    const client = {
      readIdentity: vi.fn(async () => ({
        registryBindingKey: S3_CONTENT_ORIGINAL_REGISTRY_KEY,
        providerAccountRefHash: 'c'.repeat(64),
        principalArnHash: 'd'.repeat(64),
        region: 'eu-central-1' as const,
        bucketRef: 'one-time-private-media',
        kmsKeyVersionRef: 'kms-version-one',
        versioningEnabled: true as const,
        blockPublicAccess: true as const,
        bucketOwnerEnforced: true as const,
        browserCredentialsExposed: false as const,
        corsAllowedOrigins: ['http://localhost:3000'],
        corsAllowedMethods: ['PUT'] as const,
        corsExposedHeaders: ['ETag'] as const,
        observedAt: '2026-08-04T13:00:00.000Z',
      })),
      createMultipart: vi.fn(),
      authorizePart: vi.fn(),
      recordCompletedPart: vi.fn(),
      completeAndReadBack: vi.fn(async () => completed),
      abortMultipart: vi.fn(),
      putStreamPart: vi.fn(),
    };
    const adapter = new AwsS3ManagedOriginalAdapter(
      {
        enabled: true,
        region: 'eu-central-1',
        bucketRef: 'one-time-private-media',
        kmsKeyVersionRef: 'kms-version-one',
        storageClass: 'STANDARD',
        browserOrigin: 'http://localhost:3000',
      },
      client,
    );

    await expect(
      adapter.completeAndReadBack({
        uploadSessionId: 'upload-one',
        fullSha256: sha,
        orderedProviderPartRefDigests: ['e'.repeat(64)],
      }),
    ).resolves.toEqual(completed);
    expect(client.completeAndReadBack).toHaveBeenCalledTimes(1);
  });
});
