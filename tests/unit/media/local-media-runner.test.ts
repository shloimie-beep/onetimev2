import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  acquireRunnerLock,
  assertResolvedPathWithinRoot,
  buildDerivativeFileName,
  buildVimeoReadyFfmpegArgs,
  finalizeDerivativeExclusive,
  hashFileWithStableSnapshot,
  isStableFile,
  loadSettings,
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
    expect(parseRunnerOptions(['--root', 'C:/operator/custom-root'], {})).toMatchObject({
      rootPath: 'C:/operator/custom-root',
    });
    expect(parseRunnerOptions(['--root=C:/operator/equals-root'], {})).toMatchObject({
      rootPath: 'C:/operator/equals-root',
    });
    expect(() => parseRunnerOptions(['--root'], {})).toThrow(
      'local_media_option_root_value_required',
    );
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

  it('recovers a stale lock only after its recorded PID is demonstrably dead', async () => {
    const stateDirectory = await mkdtemp(path.join(tmpdir(), 'local-media-stale-lock-'));
    temporaryDirectories.push(stateDirectory);
    const lockPath = path.join(stateDirectory, 'local-media-runner.lock');
    await writeFile(lockPath, '{"pid":999999,"nonce":"stale","started_at":"2026-01-01"}\n');
    const deadChecks: number[] = [];
    const release = await acquireRunnerLock(stateDirectory, {
      pid: process.pid,
      isProcessAlive(pid) {
        deadChecks.push(pid);
        return false;
      },
    });
    expect(deadChecks).toEqual([999999]);
    await release();

    await writeFile(lockPath, '{"pid":123,"nonce":"live","started_at":"2026-01-01"}\n');
    await expect(acquireRunnerLock(stateDirectory, { isProcessAlive: () => true })).rejects.toThrow(
      'local_media_runner_already_running',
    );
    expect(await readFile(lockPath, 'utf8')).toContain('"pid":123');

    await writeFile(lockPath, 'not-json\n');
    await expect(
      acquireRunnerLock(stateDirectory, { isProcessAlive: () => false }),
    ).rejects.toThrow('local_media_runner_lock_unverifiable');
    expect(await readFile(lockPath, 'utf8')).toBe('not-json\n');
  });

  it('rejects configured and resolved paths that escape the media root', () => {
    expect(() =>
      assertResolvedPathWithinRoot({
        rootPath: 'C:/operator/OneTimeMedia',
        configuredPath: 'C:/operator/OneTimeMedia/Incoming',
        resolvedPath: 'C:/outside-via-junction',
        label: 'incomingDir',
      }),
    ).toThrow('local_media_incomingDir_outside_root');
  });

  it('loads a separated custom root while rejecting an outside configured directory', async () => {
    const rootDirectory = await mkdtemp(path.join(tmpdir(), 'local-media-settings-'));
    temporaryDirectories.push(rootDirectory);
    for (const name of [
      'Incoming',
      'Processing',
      'ReadyForVimeo',
      'Complete',
      'Failed',
      'State',
      'Logs',
      'Config',
    ]) {
      await mkdir(path.join(rootDirectory, name));
    }
    const settings = {
      rootPath: rootDirectory,
      incomingDir: path.join(rootDirectory, 'Incoming'),
      processingDir: path.join(rootDirectory, 'Processing'),
      readyForVimeoDir: path.join(rootDirectory, 'ReadyForVimeo'),
      completeDir: path.join(rootDirectory, 'Complete'),
      failedDir: path.join(rootDirectory, 'Failed'),
      stateDir: path.join(rootDirectory, 'State'),
      logsDir: path.join(rootDirectory, 'Logs'),
      stableFileSeconds: 60,
      rawSourceRetentionDays: 7,
      transcriptionMode: 'off',
    };
    const settingsPath = path.join(rootDirectory, 'Config', 'settings.local.json');
    await writeFile(settingsPath, JSON.stringify(settings));
    await expect(loadSettings(rootDirectory)).resolves.toMatchObject({
      rootPath: rootDirectory,
      transcriptionMode: 'off',
    });
    await writeFile(
      settingsPath,
      JSON.stringify({ ...settings, incomingDir: path.dirname(rootDirectory) }),
    );
    await expect(loadSettings(rootDirectory)).rejects.toThrow(
      'local_media_incomingDir_outside_root',
    );
  });

  it('re-observes a source after hashing and rejects an in-flight change', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'local-media-hash-'));
    temporaryDirectories.push(directory);
    const sourcePath = path.join(directory, 'source.mp4');
    await writeFile(sourcePath, 'first');
    await expect(
      hashFileWithStableSnapshot(sourcePath, async () => writeFile(sourcePath, 'second-longer')),
    ).resolves.toBeNull();
  });

  it('uses a full source hash and refuses to replace a different final derivative', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'local-media-finalize-'));
    temporaryDirectories.push(directory);
    const sourceSha256 = 'a'.repeat(64);
    expect(buildDerivativeFileName(sourceSha256)).toBe(`${sourceSha256}-review-ready.mp4`);
    const temporaryPath = path.join(directory, 'temporary.mp4');
    const readyPath = path.join(directory, 'ready.mp4');
    await writeFile(temporaryPath, 'new derivative');
    await writeFile(readyPath, 'existing different derivative');
    const outputSha256 = createHash('sha256').update('new derivative').digest('hex');
    await expect(
      finalizeDerivativeExclusive({ temporaryPath, readyPath, outputSha256 }),
    ).rejects.toThrow('local_media_ready_output_collision');
    expect(await readFile(readyPath, 'utf8')).toBe('existing different derivative');
  });

  it('renders an OT-VIDEO-1 compatible local derivative without a trim filter', () => {
    const args = buildVimeoReadyFfmpegArgs({ sourcePath: 'incoming.mkv', outputPath: 'ready.mp4' });
    expect(args).toEqual(
      expect.arrayContaining(['-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart']),
    );
    expect(args.join(' ')).toContain('fps=30');
    expect(args.join(' ')).not.toContain('trim=');
    expect(args).toContain('-n');
    expect(args).not.toContain('-y');
  });
});
