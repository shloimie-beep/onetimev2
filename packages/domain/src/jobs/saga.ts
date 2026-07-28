import type {
  VersionedSaga,
  VersionedSagaState,
} from '../../../contracts/src/jobs/index.ts';
import { JobFoundationError } from './errors.ts';
import { assertSha256 } from './idempotency.ts';

const SAGA_TARGETS = {
  draft: ['validating', 'canceled'],
  validating: ['preview_ready', 'failed', 'canceled'],
  preview_ready: ['confirmed', 'invalidated', 'canceled'],
  confirmed: ['provisioning', 'invalidated', 'canceled'],
  provisioning: [
    'ready_to_notify',
    'partial_failure',
    'failed',
    'acceptance_unknown',
    'canceled',
  ],
  ready_to_notify: ['notifying', 'canceled'],
  notifying: ['complete', 'partial_failure', 'failed', 'acceptance_unknown', 'canceled'],
  partial_failure: ['provisioning', 'notifying', 'canceled'],
  failed: ['validating', 'provisioning', 'notifying', 'canceled'],
  acceptance_unknown: ['provisioning', 'notifying', 'ready_to_notify', 'complete', 'canceled'],
  invalidated: ['draft', 'canceled'],
  canceled: [],
  complete: [],
} as const satisfies Record<VersionedSagaState, readonly VersionedSagaState[]>;

export function transitionVersionedSaga(
  saga: VersionedSaga,
  input: {
    expected_version: number;
    to_state: VersionedSagaState;
    failed_stage: VersionedSaga['failed_stage'];
    preview_digest: string | null;
    unknown_job_ids: readonly string[];
    completed_job_ids: readonly string[];
  },
): VersionedSaga {
  if (saga.version !== input.expected_version) {
    throw new JobFoundationError('stale_version', 'The saga version is stale.');
  }
  if (!SAGA_TARGETS[saga.state].includes(input.to_state as never)) {
    throw new JobFoundationError(
      'invalid_transition',
      `The saga cannot transition from ${saga.state} to ${input.to_state}.`,
    );
  }
  if (input.preview_digest !== null) assertSha256(input.preview_digest, 'preview_digest');
  if (input.to_state === 'confirmed' && input.preview_digest === null) {
    throw new JobFoundationError(
      'invalid_contract',
      'A confirmed saga binds an immutable preview digest.',
    );
  }
  if (
    input.to_state === 'failed' &&
    (input.failed_stage === null ||
      !['validating', 'provisioning', 'notifying'].includes(input.failed_stage))
  ) {
    throw new JobFoundationError('invalid_contract', 'A failed saga records its exact stage.');
  }
  if (
    saga.state === 'failed' &&
    input.to_state !== 'canceled' &&
    saga.failed_stage !== input.to_state
  ) {
    throw new JobFoundationError(
      'invalid_transition',
      'Governed retry returns only to the exact recorded failed stage.',
    );
  }
  if (input.to_state === 'acceptance_unknown' && input.unknown_job_ids.length === 0) {
    throw new JobFoundationError(
      'invalid_contract',
      'Acceptance-unknown saga state identifies at least one quarantined job.',
    );
  }
  if (
    saga.state === 'acceptance_unknown' &&
    input.to_state !== 'acceptance_unknown' &&
    input.to_state !== 'canceled' &&
    input.unknown_job_ids.length > 0
  ) {
    throw new JobFoundationError(
      'acceptance_unknown_quarantined',
      'A saga cannot leave quarantine while any provider job remains unknown.',
    );
  }
  return {
    ...saga,
    state: input.to_state,
    version: saga.version + 1,
    failed_stage: input.failed_stage,
    preview_digest: input.preview_digest,
    unknown_job_ids: [...new Set(input.unknown_job_ids)].sort(),
    completed_job_ids: [...new Set(input.completed_job_ids)].sort(),
  };
}
