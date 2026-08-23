import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../../../../packages/config/src/index.ts';
import type { WorkerRunnerContext } from '../registry/index.ts';
import { runContentIngestWorker } from './composition.ts';
import type { DriveProviderFile } from './runner.ts';

describe('production-broad content ingest composition', () => {
  it('reads only one provider page per bounded cycle even when another page exists', async () => {
    const listPage = vi.fn(async ({ pageToken }: { pageToken?: string }) =>
      pageToken
        ? { files: [driveFile('second')] }
        : { files: [driveFile('first')], nextPageToken: 'next-page' },
    );
    const saveDriveObservation = vi.fn();
    const result = await runContentIngestWorker(context(), {
      repository: repository({ saveDriveObservation }),
      driveProvider: {
        listPage,
        openRange: unexpected,
      },
      staging: staging(),
    });

    expect(listPage).toHaveBeenCalledOnce();
    expect(saveDriveObservation).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      enabled: true,
      providerCallsPerformed: true,
      summary: {
        batchLimit: 2,
        providerCalls: 1,
        databaseWrites: 1,
        candidateCount: 1,
        truncated: true,
      },
    });
  });

  it('does not claim zero database writes after a broad cycle fails partway through', async () => {
    let transactions = 0;
    const base = {
      inTransaction: vi.fn(async (work: (unit: unknown) => Promise<unknown>) => {
        transactions += 1;
        if (transactions === 2) throw new Error('synthetic partial scan failure');
        return work({
          getDriveObservation: vi.fn().mockResolvedValue(null),
          saveDriveObservation: vi.fn(),
        });
      }),
    };

    const result = await runContentIngestWorker(context(), {
      repository: base as never,
      driveProvider: {
        listPage: vi.fn().mockResolvedValue({
          files: [driveFile('first'), driveFile('second')],
        }),
        openRange: unexpected,
      },
      staging: staging(),
    });

    expect(result).toMatchObject({
      enabled: true,
      providerCallsPerformed: true,
      summary: {
        stopped: true,
        stopReason: 'content_drive_broad_failed_closed',
        databaseWrites: 'unknown_after_failure',
      },
    });
  });
});

function context(): WorkerRunnerContext {
  return {
    config: loadConfig({
      NODE_ENV: 'production',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
      ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_broad',
      ONE_TIME_CONTENT_MEDIA_MODE: 'production_broad',
      ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID: 'authority-broad-test',
      GOOGLE_DRIVE_FOLDER_ID: 'incoming-folder',
      GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: '{}',
      ONE_TIME_FIRST_CLASS_AT: '2026-08-16T19:00:00+03:00',
      ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-09-11T18:00:00+03:00',
      AUTH_CSRF_SECRET: 'content-media-production-csrf-secret',
      PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'content-media-production-payload-key',
    }),
    pool: { query: vi.fn(), connect: vi.fn(), end: vi.fn() } as never,
    source: { NODE_ENV: 'production' },
    workerInstanceKey: 'worker-broad-test',
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

function repository(input: { saveDriveObservation: ReturnType<typeof vi.fn> }) {
  return {
    inTransaction: vi.fn((work) =>
      work({
        getDriveObservation: vi.fn().mockResolvedValue(null),
        saveDriveObservation: input.saveDriveObservation,
      }),
    ),
  } as never;
}

function driveFile(id: string): DriveProviderFile {
  return {
    fileId: id,
    parentFolderId: 'incoming-folder',
    displayFilename: `${id}.mp4`,
    mimeType: 'video/mp4',
    byteCount: 1024,
    changeMarker: `version-${id}`,
  };
}

function staging() {
  return {
    beginDriveTransfer: vi.fn(unexpected),
    putPart: vi.fn(unexpected),
    completeAndReadBack: vi.fn(unexpected),
  } as never;
}

async function* unexpected(): AsyncIterable<Uint8Array> {
  yield await Promise.reject<Uint8Array>(new Error('unexpected provider operation'));
}
