import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import type { ParentWelcomeEventCommand } from './api.ts';
import {
  createParentAddStudentEventController,
  createParentWelcomeVideoEventController,
} from './welcome-video.ts';

describe('Parent welcome native-video event controller', () => {
  it('records Add Student once with the current approved version or null without blocking', async () => {
    const recordReady = vi.fn().mockResolvedValue(undefined);
    const ready = createParentAddStudentEventController({ recordEvent: recordReady });
    ready.clicked('welcome-approved-v1');
    ready.clicked('welcome-approved-v1');
    await ready.flush();
    expect(recordReady).toHaveBeenCalledOnce();
    expect(recordReady).toHaveBeenCalledWith({
      event_type: 'parent.add_student_clicked',
      video_version_id: 'welcome-approved-v1',
    });

    const recordUnavailable = vi.fn().mockRejectedValue(new Error('network unavailable'));
    const unavailable = createParentAddStudentEventController({
      recordEvent: recordUnavailable,
    });
    unavailable.clicked(null);
    await expect(unavailable.flush()).resolves.toBeUndefined();
    expect(recordUnavailable).toHaveBeenCalledWith({
      event_type: 'parent.add_student_clicked',
      video_version_id: null,
    });
  });

  it('records impression, started, 10 seconds, quartiles, and 90% completion once each', async () => {
    const commands: ParentWelcomeEventCommand[] = [];
    const recordEvent = vi.fn(async (command: ParentWelcomeEventCommand) => {
      commands.push(command);
    });
    const controller = createParentWelcomeVideoEventController({
      videoVersionId: 'welcome-approved-v1',
      durationSeconds: 100,
      recordEvent,
    });

    controller.impression();
    controller.impression();
    controller.started(0);
    controller.started(0);
    for (let second = 1; second <= 95; second += 1) {
      controller.timeUpdate({ currentTime: second, duration: 100, paused: false, seeking: false });
    }
    controller.timeUpdate({ currentTime: 95, duration: 100, paused: false, seeking: false });
    await controller.flush();

    expect(commands.map(({ event_type }) => event_type)).toEqual([
      'parent.welcome_video_impression',
      'parent.welcome_video_started',
      'parent.welcome_video_10_seconds',
      'parent.welcome_video_25_percent',
      'parent.welcome_video_50_percent',
      'parent.welcome_video_75_percent',
      'parent.welcome_video_completed',
    ]);
    expect(recordEvent).toHaveBeenCalledTimes(7);
    expect(commands.at(-1)).toMatchObject({
      observed_playback_seconds: 90,
      observed_position_percent: 90,
    });
  });

  it('does not turn a seek into watched seconds or threshold events', async () => {
    const recordEvent = vi.fn(async () => undefined);
    const controller = createParentWelcomeVideoEventController({
      videoVersionId: 'welcome-approved-v1',
      durationSeconds: 100,
      recordEvent,
    });

    controller.started(0);
    controller.timeUpdate({ currentTime: 1, duration: 100, paused: false, seeking: false });
    controller.seeking();
    controller.seeked(90);
    controller.timeUpdate({ currentTime: 91, duration: 100, paused: false, seeking: false });
    await controller.flush();

    expect(recordEvent).toHaveBeenCalledTimes(1);
    expect(recordEvent).toHaveBeenCalledWith({
      event_type: 'parent.welcome_video_started',
      video_version_id: 'welcome-approved-v1',
    });
  });

  it('fails closed on a revoked event without leaking or retrying the unknown write', async () => {
    const onRevoked = vi.fn();
    const recordEvent = vi.fn().mockRejectedValue(
      Object.assign(new Error('This welcome video version is no longer current.'), {
        status: 404,
        code: 'parent_welcome_version_mismatch',
      }),
    );
    const controller = createParentWelcomeVideoEventController({
      videoVersionId: 'welcome-approved-v1',
      durationSeconds: 100,
      recordEvent,
      onRevoked,
    });

    controller.impression();
    controller.impression();
    await controller.flush();
    expect(recordEvent).toHaveBeenCalledOnce();
    expect(onRevoked).toHaveBeenCalledOnce();

    const source = await readFile(
      'apps/web/src/client/app/parent/learning/welcome-video.ts',
      'utf8',
    );
    expect(source).not.toMatch(/localStorage|sessionStorage|URLSearchParams/u);
    expect(source).not.toMatch(/console\.(?:log|info|warn|error)/u);
  });
});
