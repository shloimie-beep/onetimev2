import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createZoomDisposableCanaryIntent,
  transitionZoomDisposableCanaryState,
  ZOOM_DISPOSABLE_CANARY_ORIGIN,
  type ZoomDisposableCanaryState,
} from '../../../scripts/zoom-disposable-canary-plan.ts';
import {
  appendZoomDisposableCanaryState,
  createZoomDisposableCanaryJournal,
  persistZoomDisposableCanaryMeetingCreated,
  readZoomDisposableCanaryJournal,
  withZoomDisposableCanaryStateLock,
} from '../../../scripts/zoom-disposable-canary-state.ts';

const temporaryDirectories: string[] = [];
const operationId = '123e4567-e89b-42d3-a456-426614174000';
const executionHead = 'a'.repeat(40);
const stateSecret = 'state-secret-fixture-that-is-longer-than-thirty-two-characters';

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('Zoom disposable canary protected journal', () => {
  it('creates once, appends signed transitions, and reads the current state', async () => {
    const statePath = await temporaryStatePath();
    const intent = fixtureIntent();
    await createZoomDisposableCanaryJournal(statePath, intent);
    const meeting = transitionZoomDisposableCanaryState(
      intent,
      {
        phase: 'meeting_created',
        meeting_id: 'protected-meeting-fixture',
        passcode: 'protected-passcode-fixture',
      },
      stateSecret,
    );
    await appendZoomDisposableCanaryState(statePath, meeting);
    const journal = await readZoomDisposableCanaryJournal(statePath, stateSecret, {
      operationId,
      executionHead,
      origin: ZOOM_DISPOSABLE_CANARY_ORIGIN,
    });
    expect(journal.states).toHaveLength(2);
    expect(journal.current).toEqual(meeting);
    await expect(createZoomDisposableCanaryJournal(statePath, intent)).rejects.toThrow(
      'ZOOM_DISPOSABLE_CANARY_STATE_ALREADY_EXISTS',
    );
  });

  it('fails closed on an incomplete journal record', async () => {
    const statePath = await temporaryStatePath();
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, `${JSON.stringify(fixtureIntent())}\n{"schema_version":3`, {
      mode: 0o600,
    });
    await expect(
      readZoomDisposableCanaryJournal(statePath, stateSecret, {
        operationId,
        executionHead,
        origin: ZOOM_DISPOSABLE_CANARY_ORIGIN,
      }),
    ).rejects.toThrow('ZOOM_DISPOSABLE_CANARY_STATE_INVALID:JOURNAL_INCOMPLETE');
  });

  it('uses an exclusive lock and never runs a second concurrent operation', async () => {
    const statePath = await temporaryStatePath();
    await withZoomDisposableCanaryStateLock(statePath, async () => {
      await expect(
        withZoomDisposableCanaryStateLock(statePath, async () => undefined),
      ).rejects.toThrow('ZOOM_DISPOSABLE_CANARY_STATE_LOCKED');
    });
    await expect(
      withZoomDisposableCanaryStateLock(statePath, async () => 'released'),
    ).resolves.toBe('released');
  });

  it('compensates exactly once when Zoom omits the meeting passcode', async () => {
    const appended: ZoomDisposableCanaryState[] = [];
    let cleanupAttempts = 0;

    await expect(
      persistZoomDisposableCanaryMeetingCreated({
        previous: fixtureIntent(),
        meetingId: '987654321',
        passcode: '',
        stateSecret,
        append: async (state) => {
          appended.push(state);
        },
        deleteExactMeeting: async () => {
          cleanupAttempts += 1;
        },
      }),
    ).rejects.toThrow('ZOOM_DISPOSABLE_CANARY_PROVISION_FAILED:MEETING_STATE_WRITE');

    expect(cleanupAttempts).toBe(1);
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({ phase: 'deleted', registrants: [] });
    expect(appended[0]).not.toHaveProperty('meeting_id');
    expect(appended[0]).not.toHaveProperty('passcode');
  });

  it('retains only the exact meeting id when missing-passcode cleanup is unavailable', async () => {
    const appended: ZoomDisposableCanaryState[] = [];
    let cleanupAttempts = 0;

    await expect(
      persistZoomDisposableCanaryMeetingCreated({
        previous: fixtureIntent(),
        meetingId: '987654321',
        passcode: '',
        stateSecret,
        append: async (state) => {
          appended.push(state);
        },
        deleteExactMeeting: async () => {
          cleanupAttempts += 1;
          throw new Error('provider unavailable');
        },
      }),
    ).rejects.toThrow('ZOOM_DISPOSABLE_CANARY_PROVISION_FAILED:MEETING_STATE_WRITE');

    expect(cleanupAttempts).toBe(1);
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({
      phase: 'cleanup_required',
      meeting_id: '987654321',
      failure_category: 'meeting_material_incomplete',
    });
    expect(appended[0]).not.toHaveProperty('passcode');
  });
});

function fixtureIntent() {
  return createZoomDisposableCanaryIntent({
    operationId,
    executionHead,
    cleanupDeadline: '2026-07-24T13:00:00.000Z',
    hostUserId: 'protected-host-fixture',
    startsAt: new Date('2026-07-24T11:00:00.000Z'),
    now: new Date('2026-07-24T10:00:00.000Z'),
    stateSecret,
  });
}

async function temporaryStatePath() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'onetime-zoom-canary-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'state', 'canary.jsonl');
}
