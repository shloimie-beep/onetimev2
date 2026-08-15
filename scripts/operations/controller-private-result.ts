import { randomBytes } from 'node:crypto';
import { chmod, open, rename, stat, unlink, type FileHandle } from 'node:fs/promises';
import {
  ControllerReferencedTimeoutError,
  runControllerOperationWithinReferencedTimeout,
  settleControllerOperationWithin,
} from './controller-referenced-watchdog.ts';

const PRIVATE_RESULT_MODE = 0o600;
const RESULT_WRITE_TIMEOUT_MS = 10_000;
const RESULT_CLEANUP_TIMEOUT_MS = 2_000;

export type PrivateControllerResultWriteOutcome =
  'written' | 'timed_out' | 'failed' | 'permission_unavailable' | 'permission_mismatch';

export type PrivateControllerResultWriteOptions = {
  /** Tests only. Production always uses the fixed result-write deadline. */
  testOnlyTimeoutMs?: number;
  /** Tests only. Stalls before touching the output filesystem. */
  testOnlyStallBeforePrivateOpen?: boolean;
  /** Tests only. Stalls after a private empty file is verified and before result bytes are written. */
  testOnlyStallAfterPrivateOpen?: boolean;
  /** Tests only. Fails after a private empty file is verified and before result bytes are written. */
  testOnlyFailAfterPrivateOpen?: boolean;
};

class ControllerPrivateResultPermissionError extends Error {
  readonly outcome: 'permission_unavailable' | 'permission_mismatch';

  constructor(outcome: 'permission_unavailable' | 'permission_mismatch') {
    super('The private controller result permission contract was not satisfied.');
    this.name = 'ControllerPrivateResultPermissionError';
    this.outcome = outcome;
  }
}

export async function writePrivateControllerResult(
  outputPath: string,
  output: string,
  options: PrivateControllerResultWriteOptions = {},
): Promise<PrivateControllerResultWriteOutcome> {
  const timeoutMs =
    options.testOnlyTimeoutMs !== undefined &&
    Number.isInteger(options.testOnlyTimeoutMs) &&
    options.testOnlyTimeoutMs > 0 &&
    options.testOnlyTimeoutMs <= RESULT_WRITE_TIMEOUT_MS
      ? options.testOnlyTimeoutMs
      : RESULT_WRITE_TIMEOUT_MS;
  const temporaryPath = `${outputPath}.controller-${process.pid}-${randomBytes(12).toString('hex')}.tmp`;
  const controller = new AbortController();
  let handle: FileHandle | undefined;
  let renamed = false;
  let removeFinal = false;

  try {
    await runControllerOperationWithinReferencedTimeout(
      async () => {
        if (options.testOnlyStallBeforePrivateOpen) {
          await new Promise<never>(() => undefined);
        }
        if (process.platform === 'win32') {
          throw new ControllerPrivateResultPermissionError('permission_unavailable');
        }
        handle = await open(temporaryPath, 'wx', PRIVATE_RESULT_MODE);
        await handle.chmod(PRIVATE_RESULT_MODE);
        const privateStat = await handle.stat();
        if (!isExactPrivateResult(privateStat.mode, privateStat.uid)) {
          throw new ControllerPrivateResultPermissionError('permission_mismatch');
        }
        if (options.testOnlyFailAfterPrivateOpen) {
          throw new Error('A test-only private result write failed.');
        }
        if (options.testOnlyStallAfterPrivateOpen) {
          await new Promise<never>(() => undefined);
        }
        await handle.writeFile(output, { encoding: 'utf8', signal: controller.signal });
        await handle.sync();
        await handle.close();
        handle = undefined;
        if (controller.signal.aborted) throw new ControllerReferencedTimeoutError();
        await rename(temporaryPath, outputPath);
        renamed = true;
        const finalStat = await stat(outputPath);
        if (!isExactPrivateResult(finalStat.mode, finalStat.uid)) {
          removeFinal = true;
          await chmod(outputPath, 0o000);
          throw new ControllerPrivateResultPermissionError('permission_mismatch');
        }
      },
      timeoutMs,
      () => controller.abort(),
    );
    return 'written';
  } catch (error) {
    if (error instanceof ControllerReferencedTimeoutError) return 'timed_out';
    if (error instanceof ControllerPrivateResultPermissionError) return error.outcome;
    return 'failed';
  } finally {
    const openHandle = handle;
    if (openHandle) {
      await settleControllerOperationWithin(() => openHandle.close(), RESULT_CLEANUP_TIMEOUT_MS);
    }
    if (!renamed) {
      await settleControllerOperationWithin(() => unlink(temporaryPath), RESULT_CLEANUP_TIMEOUT_MS);
    }
    if (removeFinal) {
      await settleControllerOperationWithin(
        () => chmod(outputPath, 0o000),
        RESULT_CLEANUP_TIMEOUT_MS,
      );
      await settleControllerOperationWithin(() => unlink(outputPath), RESULT_CLEANUP_TIMEOUT_MS);
    }
  }
}

function isExactPrivateResult(mode: number, uid: number) {
  if ((mode & 0o777) !== PRIVATE_RESULT_MODE) return false;
  return typeof process.getuid !== 'function' || uid === process.getuid();
}
