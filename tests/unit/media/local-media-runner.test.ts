import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  acquireRunnerLock,
  buildVimeoReadyFfmpegArgs,
  isStableFile,
  parseRunnerOptions,
} from '../../../scripts/media/local-media-runner.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('local media runner safety boundaries', () => {
  it('requires a complete unchanged stability interval before processing', () => {
    expect(
      isStableFile({
        modifiedAtMs: 1_000,
        nowMs: 61_000,
        stableFileSeconds: 60,
        previousSize: null,
        currentSize: 10,
        previousModifiedAtMs: null,
      }),
    ).toBe(false);
    expect(
      isStableFile({
        modifiedAtMs: 1_000,
        nowMs: 61_000,
        stableFileSeconds: 60,
        previousSize: 10,
        currentSize: 10,
        previousModifiedAtMs: 1_000,
      }),
    ).toBe(true);
    expect(
      isStableFile({
        modifiedAtMs: 1_000,
        nowMs: 60_999,
        stableFileSeconds: 60,
        previousSize: 10,
        currentSize: 10,
        previousModifiedAtMs: 1_000,
      }),
    ).toBe(false);
    expect(
      isStableFile({
        modifiedAtMs: 1_000,
        nowMs: 61_000,
        stableFileSeconds: 60,
        previousSize: 9,
        currentSize: 10,
        previousModifiedAtMs: 1_000,
      }),
    ).toBe(false);
  });

  it('does not enable local processing unless the operator says so', () => {
    expect(
      parseRunnerOptions(['--once'], { USERPROFILE: 'C:/operator' } as NodeJS.ProcessEnv),
    ).toMatchObject({
      once: true,
      processLocal: false,
      rootPath: expect.stringMatching(/operator[\\/]OneTimeMedia$/),
    });
    expect(parseRunnerOptions(['--process-local'], {})).toMatchObject({ processLocal: true });
    expect(parseRunnerOptions(['--apply-task-scheduler'], {})).toMatchObject({
      applyTaskScheduler: true,
    });
    expect(parseRunnerOptions(['--wait-for-stability'], {})).toMatchObject({
      waitForStability: true,
    });
  });

  it('prevents a second runner from processing the same local queue', async () => {
    const stateDirectory = await mkdtemp(path.join(tmpdir(), 'local-media-lock-'));
    temporaryDirectories.push(stateDirectory);
    const release = await acquireRunnerLock(stateDirectory);
    await expect(acquireRunnerLock(stateDirectory)).rejects.toThrow(
      'local_media_runner_already_running',
    );
    await release();
    await (
      await acquireRunnerLock(stateDirectory)
    )();
  });

  it('renders an OT-VIDEO-1 compatible local derivative without a trim filter', () => {
    const args = buildVimeoReadyFfmpegArgs({ sourcePath: 'incoming.mkv', outputPath: 'ready.mp4' });
    expect(args).toEqual(
      expect.arrayContaining(['-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart']),
    );
    expect(args.join(' ')).toContain('fps=30');
    expect(args.join(' ')).not.toContain('trim=');
  });
});
