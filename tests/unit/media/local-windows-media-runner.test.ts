import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LocalMediaStore,
  archiveVerifiedFile,
  classifyExternalFailure,
  isStableObservation,
  occurrenceDecision,
  recoveryState,
  redactLocalMediaText,
  sha256File,
} from '../../../scripts/media/local-runner-core.ts';

const stores: LocalMediaStore[] = [];

afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});

describe('local Windows media runner safety', () => {
  it('requires unchanged size and mtime for the full stability window', () => {
    expect(
      isStableObservation({
        previousSize: 100,
        previousMtimeMs: 50,
        stableSinceMs: 1_000,
        currentSize: 100,
        currentMtimeMs: 50,
        nowMs: 61_000,
        requiredMs: 60_000,
      }),
    ).toBe(true);
    expect(
      isStableObservation({
        previousSize: 100,
        previousMtimeMs: 50,
        stableSinceMs: 1_000,
        currentSize: 101,
        currentMtimeMs: 50,
        nowMs: 61_000,
        requiredMs: 60_000,
      }),
    ).toBe(false);
  });

  it('deduplicates jobs at the source SHA-256 boundary', async () => {
    const store = await tempStore();
    const first = store.createDetected({
      sourcePath: 'C:/incoming/first.mp4',
      sourceName: 'first.mp4',
      sizeBytes: 10,
      mtimeMs: 1,
    });
    const second = store.createDetected({
      sourcePath: 'C:/incoming/second.mp4',
      sourceName: 'second.mp4',
      sizeBytes: 10,
      mtimeMs: 2,
    });
    const sha = 'a'.repeat(64);
    expect(store.setSha(first.id, sha).duplicate).toBeNull();
    expect(store.setSha(second.id, sha).duplicate?.id).toBe(first.id);
    expect(store.get(second.id)).toMatchObject({
      state: 'complete',
      duplicate_of_job_id: first.id,
      safe_error_code: 'duplicate_source_sha256',
    });
  });

  it('recovers local work but quarantines a restart during Vimeo', () => {
    expect(recoveryState('transcribing')).toBe('ready_for_processing');
    expect(recoveryState('copying_to_drive')).toBe('processed');
    expect(recoveryState('waiting_for_vimeo')).toBe('unknown_provider_effect');
  });

  it('replaces an interrupted partial Drive copy and verifies the final bytes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'ot-media-archive-'));
    const source = path.join(root, 'source.mp4');
    const archive = path.join(root, 'archive');
    await writeFile(source, Buffer.from('verified-media-fixture'));
    await writeFile(path.join(root, 'stale.partial'), Buffer.from('stale'));
    const result = await archiveVerifiedFile({
      sourcePath: source,
      archiveDir: archive,
      destinationName: 'final.mp4',
    });
    expect(await readFile(result.destination, 'utf8')).toBe('verified-media-fixture');
    expect(result.sha256).toBe(await sha256File(source));
    expect((await stat(result.destination)).size).toBe(result.byteLength);
  });

  it('requires operator selection when occurrence matching is ambiguous', () => {
    expect(occurrenceDecision([])).toMatchObject({
      state: 'needs_occurrence_selection',
      candidateCount: 0,
    });
    expect(
      occurrenceDecision([{ occurrence_key: 'one' }, { occurrence_key: 'two' }]),
    ).toMatchObject({ state: 'needs_occurrence_selection', candidateCount: 2 });
    expect(occurrenceDecision([{ occurrence_key: 'only' }])).toMatchObject({
      state: 'selected',
      occurrence: { occurrence_key: 'only' },
    });
  });

  it('quarantines a Vimeo timeout after dispatch instead of retrying', () => {
    expect(classifyExternalFailure({ stage: 'waiting_for_vimeo', requestDispatched: true })).toBe(
      'unknown_provider_effect',
    );
    expect(classifyExternalFailure({ stage: 'transcribing', requestDispatched: false })).toBe(
      'retry_wait',
    );
  });

  it('never retries an unknown provider effect without reconciliation', async () => {
    const store = await tempStore();
    const job = store.createDetected({
      sourcePath: 'C:/incoming/provider.mp4',
      sourceName: 'provider.mp4',
      sizeBytes: 10,
      mtimeMs: 3,
    });
    store.transition(job.id, 'unknown_provider_effect');
    expect(() => store.retry(job.id)).toThrow('provider_effect_reconciliation_required');
  });

  it('keeps ready-for-import work idempotent instead of reprocessing providers', async () => {
    const store = await tempStore();
    const job = store.createDetected({
      sourcePath: 'C:/incoming/import.mp4',
      sourceName: 'import.mp4',
      sizeBytes: 10,
      mtimeMs: 4,
    });
    store.transition(job.id, 'ready_for_import');
    expect(store.retry(job.id).state).toBe('ready_for_import');
  });

  it('redacts credentials and provider URLs from safe failures', () => {
    const fakeOpenAiKey = `sk-${'x'.repeat(32)}`;
    const redacted = redactLocalMediaText(
      `Bearer abc.def token ${fakeOpenAiKey} https://api.vimeo.com/videos/1`,
    );
    expect(redacted).not.toContain('abc.def');
    expect(redacted).not.toContain(fakeOpenAiKey);
    expect(redacted).not.toContain('api.vimeo.com');
  });
});

async function tempStore() {
  const root = await mkdtemp(path.join(tmpdir(), 'ot-media-state-'));
  const store = new LocalMediaStore(path.join(root, 'state.sqlite'));
  stores.push(store);
  return store;
}
