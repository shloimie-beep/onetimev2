import {
  ControllerReferencedTimeoutError,
  runControllerOperationWithinReferencedTimeout,
} from '../../scripts/operations/controller-referenced-watchdog.ts';

const stage = 'transaction_begin' as const;
const journal: Array<{
  sequence: number;
  stage: typeof stage;
  state: 'started' | 'timed_out';
}> = [{ sequence: 1, stage, state: 'started' }];

try {
  await runControllerOperationWithinReferencedTimeout(
    () => new Promise<never>(() => undefined),
    25,
  );
  process.exitCode = 1;
} catch (error) {
  if (!(error instanceof ControllerReferencedTimeoutError)) throw error;
  journal.push({ sequence: 2, stage, state: 'timed_out' });
  process.stdout.write(
    `${JSON.stringify({
      schema: 'onetime.controller.dual_role_adult_provision.v1',
      status: 'blocked',
      blockers: ['apply_identity_transaction_begin_timed_out'],
      apply_execution: {
        bounded_watchdog: true,
        disposition: 'timed_out',
        transaction_outcome: 'not_started',
        final_stage: stage,
        journal,
      },
    })}\n`,
  );
  process.exitCode = 2;
}
