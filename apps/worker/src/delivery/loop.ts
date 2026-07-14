export class PollingLoopControl {
  private stoppedValue = false;
  private waiters: Array<() => void> = [];

  get stopped(): boolean {
    return this.stoppedValue;
  }

  stop(): void {
    if (this.stoppedValue) return;
    this.stoppedValue = true;
    for (const wake of this.waiters.splice(0)) wake();
  }

  async sleep(ms: number): Promise<void> {
    if (this.stoppedValue) return;
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.waiters = this.waiters.filter((wake) => wake !== done);
        resolve();
      }, ms);
      const done = () => {
        clearTimeout(timeout);
        resolve();
      };
      this.waiters.push(done);
    });
  }
}

export async function runNonOverlappingPollingLoop(input: {
  runOnce: () => Promise<void>;
  pollIntervalMs: number;
  control: PollingLoopControl;
}): Promise<number> {
  let iterations = 0;
  while (!input.control.stopped) {
    iterations += 1;
    await input.runOnce();
    if (input.control.stopped) break;
    await input.control.sleep(input.pollIntervalMs);
  }
  return iterations;
}
