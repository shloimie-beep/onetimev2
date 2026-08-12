import { describe, expect, it } from 'vitest';
import { buildVimeoReadyFfmpegArgs, isStableFile, parseRunnerOptions } from '../../../scripts/media/local-media-runner.ts';

describe('local media runner safety boundaries', () => {
  it('requires a complete unchanged stability interval before processing', () => {
    expect(isStableFile({ modifiedAtMs: 1_000, nowMs: 61_000, stableFileSeconds: 60, previousSize: 10, currentSize: 10, previousModifiedAtMs: 1_000 })).toBe(true);
    expect(isStableFile({ modifiedAtMs: 1_000, nowMs: 60_999, stableFileSeconds: 60, previousSize: 10, currentSize: 10, previousModifiedAtMs: 1_000 })).toBe(false);
    expect(isStableFile({ modifiedAtMs: 1_000, nowMs: 61_000, stableFileSeconds: 60, previousSize: 9, currentSize: 10, previousModifiedAtMs: 1_000 })).toBe(false);
  });

  it('does not enable local processing unless the operator says so', () => {
    expect(parseRunnerOptions(['--once'], { USERPROFILE: 'C:/operator' } as NodeJS.ProcessEnv)).toMatchObject({ once: true, processLocal: false, rootPath: expect.stringMatching(/operator[\\/]OneTimeMedia$/) });
    expect(parseRunnerOptions(['--process-local'], {})).toMatchObject({ processLocal: true });
    expect(parseRunnerOptions(['--apply-task-scheduler'], {})).toMatchObject({ applyTaskScheduler: true });
  });

  it('renders an OT-VIDEO-1 compatible local derivative without a trim filter', () => {
    const args = buildVimeoReadyFfmpegArgs({ sourcePath: 'incoming.mkv', outputPath: 'ready.mp4' });
    expect(args).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart']));
    expect(args.join(' ')).toContain('fps=30');
    expect(args.join(' ')).not.toContain('trim=');
  });
});
