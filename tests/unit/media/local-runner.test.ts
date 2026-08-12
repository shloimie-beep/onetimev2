import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyLocalMediaSignature } from '../../../packages/domain/src/index.ts';
import {
  sanitizeLocalMediaError,
  type LocalMediaSettings,
} from '../../../scripts/media/local-runner/contracts.ts';
import {
  LocalVimeoTusClient,
  OneTimeLocalMediaClient,
} from '../../../scripts/media/local-runner/providers.ts';
import type { LocalMediaSecretStore } from '../../../scripts/media/local-runner/secret-store.ts';
import { LocalMediaJobStore } from '../../../scripts/media/local-runner/store.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('local Windows media job store', () => {
  it('resets the stability clock only when size or mtime changes', async () => {
    const store = await createStore();
    const first = store.upsertObservation({
      sourcePath: 'C:\\media\\class.mkv',
      displayName: 'class.mkv',
      size: 100,
      mtimeMs: 1_000,
      birthtimeMs: 900,
      now: new Date('2026-08-11T10:00:00.000Z'),
    });
    const unchanged = store.upsertObservation({
      sourcePath: first.sourcePath,
      displayName: first.displayName,
      size: 100,
      mtimeMs: 1_000,
      birthtimeMs: 900,
      now: new Date('2026-08-11T10:01:00.000Z'),
    });
    const changed = store.upsertObservation({
      sourcePath: first.sourcePath,
      displayName: first.displayName,
      size: 101,
      mtimeMs: 2_000,
      birthtimeMs: 900,
      now: new Date('2026-08-11T10:02:00.000Z'),
    });

    expect(unchanged.stableSince).toBe(first.stableSince);
    expect(changed.stableSince).toBe('2026-08-11T10:02:00.000Z');
    store.close();
  });

  it('deduplicates on source SHA-256 plus selected occurrence', async () => {
    const store = await createStore();
    const first = hashedObservation(store, 'C:\\media\\one.mkv', 'a'.repeat(64));
    const second = hashedObservation(store, 'C:\\media\\two.mkv', 'a'.repeat(64));

    expect(store.assignOccurrence(first.jobId, 'occurrence_1').duplicateOf).toBeNull();
    const duplicate = store.assignOccurrence(second.jobId, 'occurrence_1');
    expect(duplicate.duplicateOf?.jobId).toBe(first.jobId);
    expect(store.assignOccurrence(second.jobId, 'occurrence_2').duplicateOf).toBeNull();
    store.close();
  });

  it('recovers interrupted processing and import without duplicating provider work', async () => {
    const store = await createStore();
    const processing = hashedObservation(store, 'C:\\media\\processing.mkv', 'b'.repeat(64));
    const importing = hashedObservation(store, 'C:\\media\\importing.mkv', 'c'.repeat(64));
    store.save({ ...processing, state: 'transcribing' });
    store.save({ ...importing, state: 'importing' });

    store.recoverInterrupted(new Date('2026-08-11T12:00:00.000Z'));

    expect(store.require(processing.jobId).state).toBe('retry_wait');
    expect(store.require(importing.jobId).state).toBe('ready_for_import');
    store.close();
  });
});

describe('local media provider boundaries', () => {
  it('signs the exact occurrence request target and sends no provider secret in the body', async () => {
    const hmacKey = 'h'.repeat(48);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers);
      expect(init?.body).toBeUndefined();
      expect(
        verifyLocalMediaSignature({
          key: hmacKey,
          request: {
            method: 'GET',
            requestTarget: `${url.pathname}${url.search}`,
            timestamp: headers.get('x-one-time-media-timestamp') ?? '',
            nonce: headers.get('x-one-time-media-nonce') ?? '',
            body: '',
          },
          signature: headers.get('x-one-time-media-signature') ?? '',
        }),
      ).toBe(true);
      return Response.json({ success: true, occurrences: [] });
    }) as unknown as typeof fetch;
    const client = new OneTimeLocalMediaClient(
      settings({ oneTimeBaseUrl: 'https://one-time.example' }),
      { read: vi.fn(async () => hmacKey) } as unknown as LocalMediaSecretStore,
      fetchMock,
    );

    await expect(
      client.listOccurrences('2026-08-11T18:00:00.000Z', 'nonce-value'),
    ).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reconciles an exact Vimeo operation marker before creating a new upload', async () => {
    const marker = `ONE_TIME_LOCAL_MEDIA_V1:${'d'.repeat(64)}`;
    const fetchSpy = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      Response.json({
        data: [
          {
            uri: '/videos/12345',
            description: marker,
            privacy: { view: 'nobody' },
            status: 'available',
            upload: { status: 'complete', upload_link: 'https://upload.example/tus' },
          },
        ],
      }),
    );
    const fetchMock = fetchSpy as unknown as typeof fetch;
    const client = new LocalVimeoTusClient(
      { accessToken: 'protected-token', expectedAccountId: 'owner', timeoutMs: 1_000 },
      fetchMock,
    );

    await expect(
      client.ensureUploadTicket({ marker, displayName: 'class.mkv', byteLength: 50 }),
    ).resolves.toMatchObject({ videoId: '12345', privacy: 'nobody' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('redacts credentials, URLs, and local paths from durable error codes', () => {
    const safe = sanitizeLocalMediaError(
      new Error(
        `Bearer token-value ${['sk', 'proj', 'abcdefghijklmnop'].join('-')} https://private.example/path C:\\Users\\owner\\video.mkv`,
      ),
    );
    expect(safe).not.toContain('token-value');
    expect(safe).not.toContain('abcdefghijklmnop');
    expect(safe).not.toContain('private.example');
    expect(safe).not.toContain('Users');
  });
});

async function createStore() {
  const directory = await mkdtemp(path.join(tmpdir(), 'one-time-local-runner-'));
  temporaryDirectories.push(directory);
  return new LocalMediaJobStore(path.join(directory, 'state.sqlite3'));
}

function hashedObservation(store: LocalMediaJobStore, sourcePath: string, sourceSha256: string) {
  const observed = store.upsertObservation({
    sourcePath,
    displayName: path.basename(sourcePath),
    size: 100,
    mtimeMs: 1_000,
    birthtimeMs: 900,
    now: new Date('2026-08-11T10:00:00.000Z'),
  });
  const hashed = { ...observed, sourceSha256 };
  store.save(hashed);
  return hashed;
}

function settings(overrides: Partial<LocalMediaSettings> = {}): LocalMediaSettings {
  return {
    schemaVersion: 1,
    rootPath: 'C:\\OneTimeMedia',
    incomingDir: 'C:\\OneTimeMedia\\Incoming',
    processingDir: 'C:\\OneTimeMedia\\Processing',
    readyForVimeoDir: 'C:\\OneTimeMedia\\ReadyForVimeo',
    completeDir: 'C:\\OneTimeMedia\\Complete',
    failedDir: 'C:\\OneTimeMedia\\Failed',
    stateDir: 'C:\\OneTimeMedia\\State',
    logsDir: 'C:\\OneTimeMedia\\Logs',
    driveArchiveDir: '',
    driveArchiveEnabled: false,
    driveArchiveIsNonBlocking: true,
    vimeoUploadPrimary: true,
    transcriptionMode: 'openai',
    stableFileSeconds: 60,
    rawSourceRetentionDays: 7,
    processedLocalRetentionDays: 3,
    preferredObsContainer: 'mkv',
    repositoryPath: '',
    occurrenceWindowBeforeMinutes: 240,
    occurrenceWindowAfterMinutes: 120,
    pollIntervalSeconds: 10,
    providerTimeoutSeconds: 120,
    settingsPath: 'C:\\OneTimeMedia\\Config\\settings.local.json',
    ...overrides,
  };
}
