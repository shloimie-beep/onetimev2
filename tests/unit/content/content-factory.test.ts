import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  contentFactorySafePostgresCode,
  createLearningDeliveryDriveInputAdapter,
  generateContentFactoryDraftFromTranscript,
  inspectLearningDeliveryInputAdapters,
  stageLearningDeliveryLocalDrop,
} from '../../../packages/domain/src/index.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('content factory input and transcript drafts', () => {
  it('keeps PostgreSQL publication diagnostics bounded and content-free', () => {
    expect(
      contentFactorySafePostgresCode({
        code: '23503',
        detail: 'private transcript and storage locator must never be logged',
      }),
    ).toBe('pg_23503');
    expect(contentFactorySafePostgresCode({ code: 'not-a-sqlstate' })).toBe(
      'publication_unexpected',
    );
  });

  it('keeps transcript-derived suggestions draft-only and timestamped', () => {
    const segments = [
      'The Mishnah introduces the topic of returning a found object.',
      'Rabbi Scheller reads the wording used in the first case.',
      'The class compares the two cases named in the Mishnah.',
      'A student asks why the wording changes in the second case.',
      'The explanation returns to the exact language of the Masechta.',
      'The class closes by reviewing the examples that were discussed.',
    ].map((text, index) => ({
      segment_id: `segment_${index + 1}`,
      start_ms: index * 10_000,
      end_ms: index * 10_000 + 9_000,
      text,
    }));

    const draft = generateContentFactoryDraftFromTranscript({
      displayName: 'operator-class.mp4',
      segments,
      classLabel: 'Mishnayos evening class',
      classDate: '2026-07-22',
    });

    expect(draft.draft_only).toBe(true);
    expect(draft.authoritative_torah_interpretation).toBe(false);
    expect(draft.review_questions).toHaveLength(6);
    expect(draft.key_takeaways).toHaveLength(5);
    expect(draft.review_questions.every((question) => /\d+:\d{2}/.test(question))).toBe(true);
    expect(draft.mishnah_terms).toEqual(expect.arrayContaining(['Mishnah', 'Masechta', 'Rabbi']));
  });

  it('selects local drop without Drive configuration and makes a private copy', async () => {
    expect(
      inspectLearningDeliveryInputAdapters({
        driveFolderIdPresent: false,
        driveServiceAccountPresent: false,
      }),
    ).toMatchObject({
      inputAdapter: 'LOCAL_DROP',
      adapters: { drive: { ready: false }, local_drop: { ready: true } },
    });

    const directory = await mkdtemp(path.join(tmpdir(), 'content-factory-input-'));
    temporaryDirectories.push(directory);
    const sourcePath = path.join(directory, 'operator-owned.mp4');
    await writeFile(sourcePath, Buffer.from('operator-owned-private-video-fixture'));
    const staged = await stageLearningDeliveryLocalDrop({
      sourcePath,
      privateDirectory: path.join(directory, 'private'),
    });

    expect(staged).toMatchObject({
      sourceKind: 'local_drop',
      displayName: 'operator-owned.mp4',
      rawUrlPresent: false,
    });
    expect(staged.privatePath).not.toBe(sourcePath);
    expect(await readFile(staged.privatePath, 'utf8')).toBe('operator-owned-private-video-fixture');
    expect((await stat(staged.privatePath)).isFile()).toBe(true);
  });

  it('lists accepted Drive videos without returning raw Drive URLs or provider IDs', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            files: [
              {
                id: 'private_drive_file_123',
                name: 'Class 2026-07-22.mp4',
                mimeType: 'video/mp4',
                size: '42000',
                md5Checksum: 'abc123',
                modifiedTime: '2026-07-22T08:00:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const adapter = createLearningDeliveryDriveInputAdapter({
      folderId: 'private_incoming_folder',
      accessToken: 'test-only-access-token',
      fetchImpl: fetchImpl as typeof fetch,
    });
    const listed = await adapter.listIncomingVideos();

    expect(listed).toHaveLength(1);
    expect(listed[0]?.metadata).toMatchObject({
      display_name: 'Class 2026-07-22.mp4',
      raw_url_present: false,
    });
    expect(JSON.stringify(listed[0]?.metadata)).not.toContain('private_drive_file_123');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
