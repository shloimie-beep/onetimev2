import type {
  JobFoundationRepository,
  JobLeaseToken,
  JobScope,
  ProviderDispatchOutcome,
  ProviderJobHandler,
  ProviderJobRecord,
} from '../../../../../packages/contracts/src/jobs/index.ts';
import { JOB_HEARTBEAT_INTERVAL_MS } from '../../../../../packages/contracts/src/jobs/index.ts';

export interface FoundationRunnerLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

export interface FoundationRunnerOptions {
  owner: string;
  scope: JobScope;
  batch_size: number;
  dispatch_timeout_ms: number;
  random: () => number;
  clock: () => Date;
}

export interface FoundationRunSummary {
  claimed: number;
  complete: number;
  accepted: number;
  retry_wait: number;
  acceptance_unknown: number;
  rejected: number;
  dead_letter: number;
  lease_lost: number;
}

export async function runFoundationJobBatch(input: {
  repository: JobFoundationRepository;
  handlers: readonly ProviderJobHandler[];
  logger: FoundationRunnerLogger;
  options: FoundationRunnerOptions;
}): Promise<FoundationRunSummary> {
  const handlers = new Map(input.handlers.map((handler) => [handler.operation_type, handler]));
  const summary = emptySummary();
  const claimed = await input.repository.claimDueJobs({
    owner: input.options.owner,
    now: input.options.clock(),
    limit: input.options.batch_size,
    scope: input.options.scope,
    operation_types: [...handlers.keys()].sort(),
  });
  summary.claimed = claimed.length;

  for (const job of claimed) {
    const handler = handlers.get(job.operation_type);
    if (!handler) {
      input.logger.warn(safeLogFields(job), 'Claimed job has no registered handler.');
      continue;
    }
    const lease = leaseFrom(job);
    const inFlight = await input.repository.markInFlight(
      lease,
      job.version,
      input.options.clock(),
    );
    if (!inFlight) {
      summary.lease_lost += 1;
      continue;
    }

    const heartbeat = startHeartbeat(
      input.repository,
      leaseFrom(inFlight),
      input.options.clock,
    );
    let outcome: ProviderDispatchOutcome;
    try {
      outcome = await dispatchWithTimeout(handler, inFlight, input.options.dispatch_timeout_ms);
    } catch {
      outcome = {
        kind: 'acceptance_unknown',
        safe_error_code: 'provider_acceptance_unknown',
      };
    } finally {
      await heartbeat.stop();
    }

    const currentLease = heartbeat.currentLease();
    if (currentLease === null) {
      summary.lease_lost += 1;
      continue;
    }
    const persisted = await input.repository.recordDispatchOutcome({
      lease: currentLease,
      expected_version: currentLease.job_version,
      now: input.options.clock(),
      outcome,
      random_unit_interval: input.options.random(),
    });
    if (!persisted) {
      summary.lease_lost += 1;
      continue;
    }
    incrementState(summary, persisted.state);
    input.logger.info(safeLogFields(persisted), 'Foundation job disposition persisted.');
  }
  return summary;
}

function startHeartbeat(
  repository: JobFoundationRepository,
  initialLease: JobLeaseToken,
  clock: () => Date,
): {
  stop(): Promise<void>;
  currentLease(): JobLeaseToken | null;
} {
  let lease: JobLeaseToken | null = initialLease;
  let stopped = false;
  let pending = Promise.resolve();
  const timer = setInterval(() => {
    if (stopped || lease === null) return;
    pending = repository
      .heartbeat(lease, clock())
      .then((renewed) => {
        lease = renewed;
      })
      .catch(() => {
        lease = null;
      });
  }, JOB_HEARTBEAT_INTERVAL_MS);
  timer.unref();
  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await pending;
    },
    currentLease() {
      return lease;
    },
  };
}

async function dispatchWithTimeout(
  handler: ProviderJobHandler,
  job: ProviderJobRecord,
  timeoutMs: number,
): Promise<ProviderDispatchOutcome> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error('invalid_dispatch_timeout');
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('provider_dispatch_timeout'));
      }, timeoutMs);
    });
    return await Promise.race([handler.dispatch(job, controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function leaseFrom(job: ProviderJobRecord): JobLeaseToken {
  if (job.lease_owner === null || job.lease_expires_at === null) {
    throw new Error('claimed_job_missing_lease');
  }
  return {
    job_id: job.job_id,
    owner: job.lease_owner,
    generation: job.lease_generation,
    expires_at: job.lease_expires_at,
    job_version: job.version,
  };
}

function safeLogFields(job: ProviderJobRecord): Record<string, unknown> {
  return {
    job_ref: job.job_id,
    operation_type: job.operation_type,
    provider: job.provider,
    runtime_tier: job.scope.runtime_tier,
    verification_environment_id: job.scope.verification_environment_id,
    state: job.state,
    dispatch_attempts: job.dispatch_attempts,
    recovery_generation: job.recovery_generation,
    safe_error_code: job.safe_error_code,
  };
}

function incrementState(summary: FoundationRunSummary, state: ProviderJobRecord['state']): void {
  if (
    state === 'complete' ||
    state === 'accepted' ||
    state === 'retry_wait' ||
    state === 'acceptance_unknown' ||
    state === 'rejected' ||
    state === 'dead_letter'
  ) {
    summary[state] += 1;
  }
}

function emptySummary(): FoundationRunSummary {
  return {
    claimed: 0,
    complete: 0,
    accepted: 0,
    retry_wait: 0,
    acceptance_unknown: 0,
    rejected: 0,
    dead_letter: 0,
    lease_lost: 0,
  };
}
