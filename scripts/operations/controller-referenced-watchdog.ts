export class ControllerReferencedTimeoutError extends Error {
  constructor() {
    super('A bounded controller operation timed out.');
    this.name = 'ControllerReferencedTimeoutError';
  }
}

export function runControllerOperationWithinReferencedTimeout<T>(
  run: () => Promise<T> | T,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        onTimeout?.();
      } catch {
        // Cancellation is best effort; the classified timeout remains authoritative.
      }
      reject(new ControllerReferencedTimeoutError());
    }, timeoutMs);
    timer.ref();

    Promise.resolve()
      .then(run)
      .then(
        (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        },
      );
  });
}

export async function settleControllerOperationWithin(
  run: () => Promise<unknown> | unknown,
  timeoutMs: number,
): Promise<'completed' | 'failed' | 'timed_out'> {
  try {
    await runControllerOperationWithinReferencedTimeout(run, timeoutMs);
    return 'completed';
  } catch (error) {
    return error instanceof ControllerReferencedTimeoutError ? 'timed_out' : 'failed';
  }
}
