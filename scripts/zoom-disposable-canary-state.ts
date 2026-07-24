import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  assertZoomDisposableCanaryJournal,
  parseZoomDisposableCanaryState,
  transitionZoomDisposableCanaryState,
  type ZoomDisposableCanaryState,
} from './zoom-disposable-canary-plan.ts';

export async function createZoomDisposableCanaryJournal(
  statePath: string,
  initialState: ZoomDisposableCanaryState,
) {
  try {
    await mkdir(path.dirname(statePath), { recursive: true, mode: 0o700 });
    const file = await open(statePath, 'wx', 0o600);
    try {
      await file.write(`${JSON.stringify(initialState)}\n`);
      await file.sync();
    } finally {
      await file.close();
    }
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      throw new Error('ZOOM_DISPOSABLE_CANARY_STATE_ALREADY_EXISTS');
    }
    throw new Error('ZOOM_DISPOSABLE_CANARY_STATE_WRITE_FAILED');
  }
}

export async function appendZoomDisposableCanaryState(
  statePath: string,
  state: ZoomDisposableCanaryState,
) {
  try {
    const file = await open(statePath, 'r+', 0o600);
    try {
      const details = await file.stat();
      await file.write(`${JSON.stringify(state)}\n`, details.size, 'utf8');
      await file.sync();
    } finally {
      await file.close();
    }
  } catch {
    throw new Error('ZOOM_DISPOSABLE_CANARY_STATE_WRITE_FAILED');
  }
}

export async function persistZoomDisposableCanaryMeetingCreated(input: {
  previous: ZoomDisposableCanaryState;
  meetingId: string;
  passcode: string;
  stateSecret: string;
  append: (state: ZoomDisposableCanaryState) => Promise<void>;
  deleteExactMeeting: () => Promise<void>;
}) {
  try {
    const meetingCreated = transitionZoomDisposableCanaryState(
      input.previous,
      {
        phase: 'meeting_created',
        meeting_id: input.meetingId,
        passcode: input.passcode,
      },
      input.stateSecret,
    );
    await input.append(meetingCreated);
    return meetingCreated;
  } catch {
    try {
      await input.deleteExactMeeting();
      const deleted = transitionZoomDisposableCanaryState(
        input.previous,
        { phase: 'deleted' },
        input.stateSecret,
      );
      await input.append(deleted);
    } catch {
      const cleanupRequired = transitionZoomDisposableCanaryState(
        input.previous,
        {
          phase: 'cleanup_required',
          meeting_id: input.meetingId,
          ...(input.passcode ? { passcode: input.passcode } : {}),
          failure_category: input.passcode
            ? 'meeting_state_write_failed'
            : 'meeting_material_incomplete',
        },
        input.stateSecret,
      );
      await input.append(cleanupRequired).catch(() => undefined);
    }
    throw new Error('ZOOM_DISPOSABLE_CANARY_PROVISION_FAILED:MEETING_STATE_WRITE');
  }
}

export async function readZoomDisposableCanaryJournal(
  statePath: string,
  stateSecret: string,
  expected: {
    operationId: string;
    executionHead: string;
    origin: string;
  },
) {
  let serialized: string;
  try {
    serialized = await readFile(statePath, 'utf8');
  } catch {
    throw new Error('ZOOM_DISPOSABLE_CANARY_STATE_READ_FAILED');
  }
  if (!serialized.endsWith('\n')) {
    throw new Error('ZOOM_DISPOSABLE_CANARY_STATE_INVALID:JOURNAL_INCOMPLETE');
  }
  let states: ZoomDisposableCanaryState[];
  try {
    states = serialized
      .split('\n')
      .filter(Boolean)
      .map((line) =>
        parseZoomDisposableCanaryState(JSON.parse(line) as unknown, stateSecret, expected),
      );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('ZOOM_DISPOSABLE_CANARY_')) throw error;
    throw new Error('ZOOM_DISPOSABLE_CANARY_STATE_INVALID:JOURNAL_PARSE');
  }
  return {
    states,
    current: assertZoomDisposableCanaryJournal(states),
  };
}

export async function withZoomDisposableCanaryStateLock<T>(
  statePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockPath = `${statePath}.lock`;
  let lock;
  try {
    await mkdir(path.dirname(statePath), { recursive: true, mode: 0o700 });
    lock = await open(lockPath, 'wx', 0o600);
    await lock.write(`${process.pid}\n`);
    await lock.sync();
  } catch {
    throw new Error('ZOOM_DISPOSABLE_CANARY_STATE_LOCKED');
  }
  try {
    return await operation();
  } finally {
    await lock.close().catch(() => undefined);
    await unlink(lockPath).catch(() => undefined);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
