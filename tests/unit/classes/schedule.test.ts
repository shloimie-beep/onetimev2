import { describe, expect, it } from 'vitest';
import {
  localPartsFor,
  resolveDailyClassWindow,
} from '../../../packages/domain/src/classes/schedule.ts';

describe('OT-71 class occurrence schedule', () => {
  it('targets today before the T-30 reminder boundary', () => {
    const window = resolveDailyClassWindow(new Date('2026-07-15T15:29:00.000Z'));
    expect(window.localDate).toBe('2026-07-15');
    expect(window.startsAt.toISOString()).toBe('2026-07-15T16:00:00.000Z');
    expect(window.reminderDueAt.toISOString()).toBe('2026-07-15T15:30:00.000Z');
    expect(window.reminderDispatchAt.toISOString()).toBe('2026-07-15T15:30:00.000Z');
    expect(window.dispatchMode).toBe('scheduled_t30');
  });

  it('allows immediate idempotent reminder dispatch from 18:30 through before 19:00 local', () => {
    const atBoundary = new Date('2026-07-15T15:30:00.000Z');
    const window = resolveDailyClassWindow(atBoundary);
    expect(window.localDate).toBe('2026-07-15');
    expect(window.reminderDispatchAt).toEqual(atBoundary);
    expect(window.dispatchMode).toBe('immediate_t30');
  });

  it('targets the next local class day at and after 19:00 unless explicitly joinable', () => {
    const atStart = new Date('2026-07-15T16:00:00.000Z');
    const next = resolveDailyClassWindow(atStart);
    expect(next.localDate).toBe('2026-07-16');
    expect(next.startsAt.toISOString()).toBe('2026-07-16T16:00:00.000Z');
    expect(next.dispatchMode).toBe('next_day_t30');

    const joinable = resolveDailyClassWindow(atStart, { currentOccurrenceStillJoinable: true });
    expect(joinable.localDate).toBe('2026-07-15');
    expect(joinable.dispatchMode).toBe('current_joinable');
  });

  it('keeps 19:00 Asia/Jerusalem correct across winter and summer offsets', () => {
    const winter = resolveDailyClassWindow(new Date('2026-01-15T12:00:00.000Z'));
    const summer = resolveDailyClassWindow(new Date('2026-07-15T12:00:00.000Z'));

    expect(winter.startsAt.toISOString()).toBe('2026-01-15T17:00:00.000Z');
    expect(summer.startsAt.toISOString()).toBe('2026-07-15T16:00:00.000Z');
    expect(localPartsFor(winter.startsAt).hour).toBe(19);
    expect(localPartsFor(summer.startsAt).hour).toBe(19);
  });
});
