import { describe, expect, it } from 'vitest';
import {
  type ContentIngestCommandReceipt,
  type ContentIngestRepository,
  type ContentIngestUnitOfWork,
  type ContentSourceLinkRecord,
  type ContentSourceRecord,
  type DriveFileObservation,
  type UploadPartRecord,
  type UploadSessionRecord,
} from '../../../../../../../packages/contracts/src/content/ingest/index.ts';
import { createContentIngestService } from './service.ts';

const hash = (digit: string) => digit.repeat(64);
const actor = {
  accountKey: 'account-1',
  productKey: 'one-time',
  principalId: 'admin-1',
  role: 'admin' as const,
};
const now = '2026-07-28T22:00:00.000Z';

type State = {
  sessions: UploadSessionRecord[];
  parts: UploadPartRecord[];
  sources: ContentSourceRecord[];
  links: ContentSourceLinkRecord[];
  observations: DriveFileObservation[];
  receipts: ContentIngestCommandReceipt[];
};

function emptyState(): State {
  return { sessions: [], parts: [], sources: [], links: [], observations: [], receipts: [] };
}

function repository(state: State, failSourceLink = false): ContentIngestRepository {
  return {
    inTransaction: async (run) => {
      const working = structuredClone(state);
      const unit: ContentIngestUnitOfWork = {
        getUploadSession: async (_scope, id) =>
          working.sessions.find((item) => item.id === id) ?? null,
        saveUploadSession: async (record) => upsert(working.sessions, record),
        listUploadParts: async (_scope, id) =>
          working.parts.filter((item) => item.uploadSessionId === id),
        saveUploadPart: async (record) => {
          if (
            !working.parts.some(
              (item) =>
                item.uploadSessionId === record.uploadSessionId &&
                item.partNumber === record.partNumber,
            )
          ) {
            working.parts.push(record);
          }
        },
        findSourceByChecksum: async (_scope, sha256) =>
          working.sources.find((item) => item.sha256 === sha256) ?? null,
        getSource: async (_scope, id) => working.sources.find((item) => item.id === id) ?? null,
        saveSource: async (record) => upsert(working.sources, record),
        saveSourceLink: async (record) => {
          if (failSourceLink) throw new Error('injected after source save');
          upsert(working.links, record);
        },
        getDriveObservation: async (_scope, digest) =>
          working.observations.find((item) => item.driveFileRefDigest === digest) ?? null,
        saveDriveObservation: async (record) =>
          upsert(working.observations, record, 'driveFileRefDigest'),
        getReceipt: async (_scope, key) =>
          working.receipts.find((item) => item.idempotencyKey === key) ?? null,
        saveReceipt: async (record) => upsert(working.receipts, record, 'idempotencyKey'),
      };
      const result = await run(unit);
      Object.assign(state, working);
      return result;
    },
  };
}

function beginCommand() {
  return {
    actor,
    runtimeTier: 'isolated_staging' as const,
    verificationEnvironmentId: 'ci-1',
    displayFilename: 'recording.mp4',
    mimeType: 'video/mp4',
    declaredByteCount: 10,
    idempotencyKey: 'begin-1',
    requestHash: hash('a'),
    occurredAt: now,
  };
}

function confirmCommand(session: UploadSessionRecord) {
  return {
    actor,
    uploadSessionId: session.id,
    expectedVersion: session.version,
    fullSha256: hash('f'),
    idempotencyKey: 'confirm-1',
    requestHash: hash('b'),
    readback: {
      runtimeTier: session.runtimeTier,
      verificationEnvironmentId: session.verificationEnvironmentId,
      region: 'eu-central-1' as const,
      bucketRef: 'bucket-ref',
      objectKeyDigest: hash('e'),
      objectVersionId: 'version-1',
      byteCount: 10,
      sha256: hash('f'),
      kmsKeyVersionRef: 'kms-1',
      blockPublicAccess: true as const,
      bucketOwnerEnforced: true as const,
    },
    journalReceipt: {
      receiptId: 'journal-1',
      uploadSessionId: session.id,
      runtimeTier: session.runtimeTier,
      verificationEnvironmentId: session.verificationEnvironmentId,
      objectVersionId: 'version-1',
      byteCount: 10,
      sha256: hash('f'),
      writtenAt: now,
      readBackAt: '2026-07-28T22:00:01.000Z',
    },
    retentionDueAt: '2026-10-26T22:00:00.000Z',
    occurredAt: '2026-07-28T22:00:01.000Z',
  };
}

async function stagedUpload(state: State, service: ReturnType<typeof createContentIngestService>) {
  const began = await service.beginDirectUpload(beginCommand());
  await service.recordUploadPart({
    actor,
    uploadSessionId: began.session!.id,
    expectedVersion: began.session!.version,
    partNumber: 1,
    byteCount: 10,
    partSha256: hash('1'),
    providerPartRefDigest: hash('2'),
    occurredAt: now,
  });
  return state.sessions[0]!;
}

describe('P19 content ingest transaction service', () => {
  it('OTV2-CONTENT-190 replays begin exactly and rejects a changed request hash', async () => {
    const state = emptyState();
    const service = createContentIngestService(repository(state));
    const first = await service.beginDirectUpload(beginCommand());
    expect(first.session?.state).toBe('initiated');
    expect((await service.beginDirectUpload(beginCommand())).replay).toBe(true);
    expect(state.sessions).toHaveLength(1);
    await expect(
      service.beginDirectUpload({ ...beginCommand(), requestHash: hash('c') }),
    ).rejects.toThrow(/different upload/);
  });

  it('OTV2-CONTENT-083 rolls back source, link, session, and receipt together', async () => {
    const state = emptyState();
    const goodService = createContentIngestService(repository(state));
    const session = await stagedUpload(state, goodService);
    const before = structuredClone(state);
    const failingService = createContentIngestService(repository(state, true));
    await expect(failingService.confirmDirectUpload(confirmCommand(session))).rejects.toThrow(
      /injected/,
    );
    expect(state).toEqual(before);
  });

  it('OTV2-CONTENT-192 confirms once and replays without duplicate source processing', async () => {
    const state = emptyState();
    const service = createContentIngestService(repository(state));
    const session = await stagedUpload(state, service);
    const first = await service.confirmDirectUpload(confirmCommand(session));
    expect(first).toMatchObject({ deduplicated: false, replay: false });
    expect(state.sources).toHaveLength(1);
    expect(state.links).toHaveLength(1);
    const replay = await service.confirmDirectUpload(confirmCommand(session));
    expect(replay.replay).toBe(true);
    expect(state.sources).toHaveLength(1);
    expect(state.links).toHaveLength(1);
  });
});

function upsert<T>(records: T[], record: T, key = 'id') {
  const index = records.findIndex(
    (item) => (item as Record<string, unknown>)[key] === (record as Record<string, unknown>)[key],
  );
  if (index >= 0) records[index] = record;
  else records.push(record);
}
