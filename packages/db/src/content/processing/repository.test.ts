import { describe, expect, it } from 'vitest';

import type {
  ContentProcessingVersion,
  ControlledCaptureEvidence,
  ProcessingArtifact,
} from '../../../../contracts/src/content/processing/index.ts';
import { createContentProcessingRepository } from './repository.ts';
import {
  CONTENT_PROCESSING_SCHEMA_CONTRACT,
  CONTENT_PROCESSING_SCHEMA_CONTRACT_VERSION,
} from './schema-contract.ts';

describe('P20 content-processing persistence contract', () => {
  it('declares additive tables and the draft/approval/replay invariants for a migration steward', () => {
    expect(CONTENT_PROCESSING_SCHEMA_CONTRACT_VERSION).toBe('P20-CONTENT-PROCESSING-SCHEMA-001');
    expect(Object.values(CONTENT_PROCESSING_SCHEMA_CONTRACT).map(({ table }) => table)).toEqual([
      'onetime.content_processing_versions',
      'onetime.content_processing_artifacts',
      'onetime.content_processing_commands',
      'onetime.content_processing_capture_evidence',
    ]);
    expect(JSON.stringify(CONTENT_PROCESSING_SCHEMA_CONTRACT)).toContain('begin as drafts');
  });

  it('uses transactions and parameterized writes without issuing DDL', async () => {
    const queries: Array<{ sql: string; values: readonly unknown[] }> = [];
    const repository = createContentProcessingRepository({
      connect: async () => ({
        query: async (sql, values = []) => {
          queries.push({ sql, values });
          return { rows: [] };
        },
      }),
    });
    const version = fixtureVersion();
    const artifact = fixtureArtifact(version);
    const evidence = fixtureEvidence(version);

    await repository.inTransaction(async (unit) => {
      await unit.saveVersion(version);
      await unit.saveArtifact(artifact);
      await unit.saveCaptureEvidence(version, evidence);
      await unit.saveReceipt({
        accountKey: version.accountKey,
        productKey: version.productKey,
        idempotencyKey: 'process-1',
        requestHash: 'a'.repeat(64),
        operation: 'process_source',
        resultRef: version.id,
        resultVersion: version.version,
        committedAt: version.updatedAt,
      });
    });

    expect(queries[0]?.sql).toBe('BEGIN');
    expect(queries.at(-1)?.sql).toBe('COMMIT');
    expect(queries.some(({ sql }) => /\b(?:CREATE|ALTER|DROP)\b/i.test(sql))).toBe(false);
    expect(queries.filter(({ sql }) => sql.includes('INSERT INTO'))).toHaveLength(4);
    expect(queries.every(({ sql }) => !sql.includes(version.sourceSha256))).toBe(true);
    expect(queries.some(({ values }) => values.includes(version.sourceSha256))).toBe(true);
  });

  it('rolls back when an optimistic persistence transaction fails', async () => {
    const commands: string[] = [];
    const repository = createContentProcessingRepository({
      connect: async () => ({
        query: async (sql) => {
          commands.push(sql);
          if (sql.includes('INSERT INTO')) throw new Error('synthetic conflict');
          return { rows: [] };
        },
      }),
    });
    await expect(
      repository.inTransaction((unit) => unit.saveVersion(fixtureVersion())),
    ).rejects.toThrow('synthetic conflict');
    expect(commands.at(-1)).toBe('ROLLBACK');
  });

  it('reads publication evidence only through parameterized composite scope and latest artifact SQL', async () => {
    const queries: Array<{ sql: string; values: readonly unknown[] }> = [];
    const repository = createContentProcessingRepository({
      connect: async () => ({
        query: async (sql, values = []) => {
          queries.push({ sql, values });
          return { rows: [] };
        },
      }),
    });
    const params = {
      accountKey: 'account-1',
      productKey: 'one-time',
      contentVersionId: 'content-version-1',
    };

    await expect(repository.getApprovedForPublicationProjection(params)).resolves.toBeNull();

    expect(queries).toHaveLength(1);
    expect(queries[0]?.values).toEqual([
      params.accountKey,
      params.productKey,
      params.contentVersionId,
    ]);
    expect(queries[0]?.sql).toContain('account_key = $1');
    expect(queries[0]?.sql).toContain('product_key = $2');
    expect(queries[0]?.sql).toContain('content_version_key = $3');
    expect(queries[0]?.sql).toContain('ROW_NUMBER() OVER');
    expect(queries[0]?.sql).toContain('content_sources_v21');
    expect(queries[0]?.sql).toContain('content_processing_capture_evidence');
    expect(queries[0]?.sql).not.toContain(params.accountKey);
    expect(queries[0]?.sql).not.toContain(params.productKey);
    expect(queries[0]?.sql).not.toContain(params.contentVersionId);
    expect(queries[0]?.sql).not.toMatch(/\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\b/i);
  });

  it('returns no projection for legacy approved JSON without the source-complete seed evidence', async () => {
    const legacyVersion = {
      ...fixtureVersion(),
      contentId: undefined,
      state: 'approved',
      publicationApproval: {
        evidenceVersion: 'OT-PUBLICATION-APPROVAL-1',
        participantSnapshotDigest: 'd'.repeat(64),
        approvedByAdminId: 'admin-1',
        approvedAt: '2026-07-28T22:10:00.000Z',
        approvedArtifactSetDigest: 'e'.repeat(64),
        sourceEvidenceDigest: 'f'.repeat(64),
      },
    };
    const repository = createContentProcessingRepository({
      connect: async () => ({
        query: async () => ({
          rows: [
            {
              version_json: legacyVersion,
              source_json: {},
              evidence_json: {},
              artifacts_json: [],
            },
          ],
        }),
      }),
    });

    await expect(
      repository.getApprovedForPublicationProjection({
        accountKey: legacyVersion.accountKey,
        productKey: legacyVersion.productKey,
        contentVersionId: legacyVersion.id,
      }),
    ).resolves.toBeNull();
  });
});

function fixtureVersion(): ContentProcessingVersion {
  const now = '2026-07-28T22:00:00.000Z';
  return {
    id: 'content-version-1',
    contentId: 'occurrence-1',
    accountKey: 'account-1',
    productKey: 'one-time',
    sourceId: 'source-1',
    sourceSha256: 'b'.repeat(64),
    sourceObjectVersionId: 'object-version-1',
    runtimeTier: 'isolated_staging',
    state: 'needs_review',
    retryState: 'ready',
    attemptCount: 0,
    trim: {
      trimVersion: 'OT-TRIM-1',
      sourceDurationMs: 10_000,
      startMs: 1_000,
      endMs: 9_000,
      outputDurationMs: 8_000,
      selectedByAdminId: 'admin-1',
      selectedAt: now,
    },
    transcodePlan: {
      profile: {
        version: 'OT-VIDEO-1',
        container: 'mp4',
        videoCodec: 'h264',
        pixelFormat: 'yuv420p',
        maxWidth: 1920,
        maxHeight: 1080,
        maxFramesPerSecond: 30,
        crf: 23,
        preset: 'medium',
        audioCodec: 'aac-lc',
        audioSampleRateHz: 48_000,
        audioChannels: 2,
        audioBitrateBps: 128_000,
        fastStart: true,
        stripUnnecessaryMetadata: true,
        upscale: false,
      },
      sourceId: 'source-1',
      sourceSha256: 'b'.repeat(64),
      sourceObjectVersionId: 'object-version-1',
      trim: {
        trimVersion: 'OT-TRIM-1',
        sourceDurationMs: 10_000,
        startMs: 1_000,
        endMs: 9_000,
        outputDurationMs: 8_000,
        selectedByAdminId: 'admin-1',
        selectedAt: now,
      },
      targetWidth: 1280,
      targetHeight: 720,
      targetFramesPerSecond: 25,
      command: { executable: 'ffmpeg', args: [], shell: false },
      boundedMemory: true,
      replacesOriginal: false,
    },
    artifacts: [],
    version: 4,
    createdAt: now,
    updatedAt: now,
  };
}

function fixtureArtifact(version: ContentProcessingVersion): ProcessingArtifact {
  return {
    id: 'artifact-1',
    accountKey: version.accountKey,
    productKey: version.productKey,
    contentVersionId: version.id,
    kind: 'transcript',
    revision: 1,
    sourceId: version.sourceId,
    sourceSha256: version.sourceSha256,
    sourceObjectVersionId: version.sourceObjectVersionId,
    status: 'draft',
    payloadDigest: 'c'.repeat(64),
    payload: { text: 'safe fixture' },
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  };
}

function fixtureEvidence(version: ContentProcessingVersion): ControlledCaptureEvidence {
  return {
    evidenceVersion: 'OT-OBS-CAPTURE-1',
    sourceId: version.sourceId,
    occurrenceId: 'occurrence-1',
    captureMethod: 'obs',
    zoomCloudRecordingDisabled: true,
    controlledEncryptedDevice: true,
    accountOwnerConsentVersion: 'CONSENT-1',
    consentedParticipantSnapshotDigest: 'd'.repeat(64),
    recordingNotice: 'visible_and_verbal',
    capturedAt: version.createdAt,
    uploadConfirmedAt: version.updatedAt,
    durableChecksumReadbackReceiptId: 'receipt-1',
    linkedIngestSourceId: version.sourceId,
  };
}
