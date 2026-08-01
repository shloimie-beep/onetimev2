import { describe, expect, it, vi } from 'vitest';

import type {
  CommunicationFoundationRepository,
  CommunicationSuppressionSnapshot,
} from '../../../../../../packages/contracts/src/communications/foundation/index.ts';
import type { ProviderDispatchOutcome } from '../../../../../../packages/contracts/src/jobs/index.ts';
import type { CampaignAudienceCandidate } from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import { ot16OperationId } from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import { runOt16Checkpoint, type CampaignEmailDispatchReceipt } from './index.ts';

const expiryAt = '2026-09-13T19:24:00+03:00';
const h = (value: string) => value.repeat(64).slice(0, 64);

function candidate(overrides: Partial<CampaignAudienceCandidate> = {}): CampaignAudienceCandidate {
  return {
    subject: { kind: 'adult', adult_id: 'adult-1', household_id: 'household-1' },
    current_account_owner: true,
    newsletter_permission: true,
    marketing_permission: true,
    former_or_canceled: false,
    active_parent: true,
    verified_paid_access: false,
    explicitly_declined: false,
    custom_school_terms: false,
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<CommunicationSuppressionSnapshot> = {},
): CommunicationSuppressionSnapshot {
  return {
    snapshot_id: 'suppression-1',
    adult_id: 'adult-1',
    captured_at: '2026-07-28T20:00:00Z',
    email_dnd: false,
    unsubscribed: false,
    complaint: false,
    hard_bounce: false,
    invalid_address: false,
    marketing_suppressed: false,
    optional_reminder_suppressed: false,
    evidence_digest: h('a'),
    ...overrides,
  };
}

function ports(
  input: {
    finalCandidate?: CampaignAudienceCandidate;
    firstSuppression?: CommunicationSuppressionSnapshot;
    finalSuppression?: CommunicationSuppressionSnapshot;
    outcome?: ProviderDispatchOutcome;
  } = {},
) {
  const resolvedOutcome: ProviderDispatchOutcome = input.outcome ?? {
    kind: 'accepted',
    provider_acceptance_digest: h('b'),
    completed_locally: true,
  };
  const repository: CommunicationFoundationRepository = {
    saveReminderPreference: vi.fn(async () => true),
    persistDecision: vi.fn(async () => true),
    reserveEmailDelivery: vi.fn(async () => true),
    completeDecision: vi.fn(async () => true),
    persistWorkflowReadback: vi.fn(async () => true),
    persistGovernedRequest: vi.fn(async () => true),
    persistWebsiteLeadPlan: vi.fn(async () => true),
  };
  const suppression = {
    readCurrent: vi
      .fn()
      .mockResolvedValueOnce(input.firstSuppression ?? snapshot())
      .mockResolvedValueOnce(input.finalSuppression ?? snapshot({ snapshot_id: 'suppression-2' })),
  };
  const eligibility = {
    readCurrent: vi
      .fn()
      .mockResolvedValueOnce(candidate())
      .mockResolvedValueOnce(input.finalCandidate ?? candidate()),
  };
  const email = {
    dispatchThroughF05: vi.fn(
      async (sendInput: { operation_id: string }): Promise<CampaignEmailDispatchReceipt> =>
        dispatchReceipt(resolvedOutcome, sendInput.operation_id),
    ),
  };
  return { repository, suppression, eligibility, email };
}

function dispatchReceipt(
  outcome: ProviderDispatchOutcome,
  operationId: string,
): CampaignEmailDispatchReceipt {
  const state =
    outcome.kind === 'accepted'
      ? outcome.completed_locally
        ? 'complete'
        : 'accepted'
      : outcome.kind === 'not_accepted_retryable'
        ? 'retry_wait'
        : outcome.kind === 'permanently_rejected'
          ? 'rejected'
          : 'acceptance_unknown';
  return {
    outcome,
    durable_job: {
      job_id: 'job-ot16-1',
      operation_type: 'ghl.workflow.ot16_checkpoint',
      idempotency_key: operationId,
      version: 4,
      state,
      unknown_effect: outcome.kind === 'acceptance_unknown',
      provider_acceptance_digest:
        outcome.kind === 'accepted' ? outcome.provider_acceptance_digest : null,
      safe_error_code: outcome.kind === 'accepted' ? null : outcome.safe_error_code,
      updated_at: '2026-08-01T20:00:00.000Z',
    },
  };
}

function checkpointInput(
  overrides: { candidate?: CampaignAudienceCandidate; operation_id?: string } = {},
) {
  const checkpointDays = 14 as const;
  const signal = new AbortController().signal;
  return {
    operation_id: ot16OperationId({
      adult_id: 'adult-1',
      expiry_at: expiryAt,
      checkpoint_days: checkpointDays,
    }),
    checkpoint_days: checkpointDays,
    expiry_at: expiryAt,
    candidate: candidate(),
    suppression_at_approval: snapshot(),
    expected_version: 0,
    safe_provider_reference: h('c'),
    signal,
    ...overrides,
  };
}

describe('P30 OT-16 worker boundary', () => {
  it('gates before writes, rechecks after reservation, and propagates the safe ref and signal', async () => {
    const { repository, suppression, eligibility, email } = ports();
    const input = checkpointInput();
    await expect(
      runOt16Checkpoint({ ...input, repository, suppression, eligibility, email }),
    ).resolves.toEqual({
      state: 'sent',
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
      reservations: 1,
      writes: 3,
    });
    expect(email.dispatchThroughF05).toHaveBeenCalledWith(
      expect.objectContaining({
        sender_key: 'office',
        transport: 'GHL',
        cta_label: 'Complete Checkout',
        content_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
        safe_provider_reference: h('c'),
      }),
      input.signal,
    );
    expect(suppression.readCurrent).toHaveBeenCalledTimes(2);
    expect(eligibility.readCurrent).toHaveBeenCalledTimes(2);
    expect(suppression.readCurrent.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.persistDecision).mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(eligibility.readCurrent.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.persistDecision).mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(vi.mocked(repository.reserveEmailDelivery).mock.invocationCallOrder[0]).toBeLessThan(
      suppression.readCurrent.mock.invocationCallOrder[1] ?? Infinity,
    );
    expect(eligibility.readCurrent.mock.invocationCallOrder[1]).toBeLessThan(
      email.dispatchThroughF05.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('fails suppression before the first durable write', async () => {
    const { repository, suppression, eligibility, email } = ports({
      firstSuppression: snapshot({ unsubscribed: true }),
    });
    await expect(
      runOt16Checkpoint({
        ...checkpointInput(),
        repository,
        suppression,
        eligibility,
        email,
      }),
    ).resolves.toMatchObject({ state: 'skipped', reason: 'unsubscribed' });
    expect(repository.persistDecision).not.toHaveBeenCalled();
    expect(repository.reserveEmailDelivery).not.toHaveBeenCalled();
    expect(email.dispatchThroughF05).not.toHaveBeenCalled();
  });

  it('deduplicates before provider dispatch', async () => {
    const { repository, suppression, eligibility, email } = ports();
    vi.mocked(repository.reserveEmailDelivery).mockResolvedValueOnce(false);
    await expect(
      runOt16Checkpoint({
        ...checkpointInput(),
        repository,
        suppression,
        eligibility,
        email,
      }),
    ).resolves.toMatchObject({ state: 'duplicate', email_provider_calls: 0 });
    expect(email.dispatchThroughF05).not.toHaveBeenCalled();
  });

  it('hard-stops Student and paid/School exits before repository or provider access', async () => {
    for (const initialCandidate of [
      candidate({
        subject: { kind: 'student', student_id: 'student-1', household_id: 'household-1' },
      }),
      candidate({ verified_paid_access: true }),
      candidate({ explicitly_declined: true }),
      candidate({ custom_school_terms: true }),
    ]) {
      const { repository, suppression, eligibility, email } = ports();
      const result = await runOt16Checkpoint({
        ...checkpointInput({ candidate: initialCandidate }),
        repository,
        suppression,
        eligibility,
        email,
      });
      expect(result.email_provider_calls).toBe(0);
      expect(repository.persistDecision).not.toHaveBeenCalled();
      expect(suppression.readCurrent).not.toHaveBeenCalled();
      expect(eligibility.readCurrent).not.toHaveBeenCalled();
      expect(email.dispatchThroughF05).not.toHaveBeenCalled();
    }
  });

  it('rechecks paid, decline, and School eligibility after reservation', async () => {
    for (const [finalCandidate, expectedReason] of [
      [candidate({ verified_paid_access: true }), 'verified_paid_access'],
      [candidate({ explicitly_declined: true }), 'explicit_decline'],
      [candidate({ custom_school_terms: true }), 'custom_school_terms'],
    ] as const) {
      const { repository, suppression, eligibility, email } = ports({ finalCandidate });
      await expect(
        runOt16Checkpoint({
          ...checkpointInput(),
          repository,
          suppression,
          eligibility,
          email,
        }),
      ).resolves.toEqual({
        state: 'exited',
        reason: expectedReason,
        email_provider_calls: 0,
        whatsapp_provider_calls: 0,
        reservations: 1,
        writes: 3,
      });
      expect(repository.reserveEmailDelivery).toHaveBeenCalledOnce();
      expect(repository.completeDecision).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'skipped', safe_reason: `send_time_${expectedReason}` }),
      );
      expect(email.dispatchThroughF05).not.toHaveBeenCalled();
    }
  });

  it('does not report a send-time skip as completed when its fence is lost', async () => {
    const { repository, suppression, eligibility, email } = ports({
      finalCandidate: candidate({ verified_paid_access: true }),
    });
    vi.mocked(repository.completeDecision).mockResolvedValueOnce(false);
    await expect(
      runOt16Checkpoint({
        ...checkpointInput(),
        repository,
        suppression,
        eligibility,
        email,
      }),
    ).resolves.toEqual({
      state: 'stale_fenced',
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
      reservations: 1,
      writes: 2,
    });
    expect(email.dispatchThroughF05).not.toHaveBeenCalled();
  });

  it('maps canonical F05 outcomes and never retries acceptance-unknown', async () => {
    const cases: Array<{
      outcome: ProviderDispatchOutcome;
      expectedState: string;
      p28Status: string | null;
    }> = [
      {
        outcome: {
          kind: 'not_accepted_retryable',
          safe_error_code: 'safe_retry',
          retry_after_ms: 1,
        },
        expectedState: 'retry_pending',
        p28Status: 'retry_pending',
      },
      {
        outcome: { kind: 'permanently_rejected', safe_error_code: 'safe_terminal' },
        expectedState: 'permanently_rejected',
        p28Status: 'skipped',
      },
      {
        outcome: { kind: 'acceptance_unknown', safe_error_code: 'safe_unknown' },
        expectedState: 'acceptance_unknown',
        p28Status: null,
      },
    ];
    for (const testCase of cases) {
      const { repository, suppression, eligibility, email } = ports({ outcome: testCase.outcome });
      const result = await runOt16Checkpoint({
        ...checkpointInput(),
        repository,
        suppression,
        eligibility,
        email,
      });
      expect(result.state).toBe(testCase.expectedState);
      if (testCase.p28Status === null) {
        expect(repository.completeDecision).not.toHaveBeenCalled();
        expect(result).toMatchObject({ reservations: 1, writes: 2 });
      } else {
        expect(repository.completeDecision).toHaveBeenCalledWith(
          expect.objectContaining({ status: testCase.p28Status }),
        );
      }
    }
  });

  it('maps a durable F05 dead letter terminally instead of retrying it', async () => {
    const outcome: ProviderDispatchOutcome = {
      kind: 'not_accepted_retryable',
      safe_error_code: 'safe_retry_exhausted',
      retry_after_ms: 1,
    };
    const { repository, suppression, eligibility, email } = ports({ outcome });
    email.dispatchThroughF05.mockImplementationOnce(async (sendInput) => {
      const receipt = dispatchReceipt(outcome, sendInput.operation_id);
      receipt.durable_job.state = 'dead_letter';
      return receipt;
    });
    await expect(
      runOt16Checkpoint({
        ...checkpointInput(),
        repository,
        suppression,
        eligibility,
        email,
      }),
    ).resolves.toMatchObject({
      state: 'permanently_rejected',
      safe_error_code: 'safe_retry_exhausted',
      writes: 3,
    });
    expect(repository.completeDecision).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped', safe_reason: 'safe_retry_exhausted' }),
    );
  });

  it.each([
    {
      outcome: {
        kind: 'not_accepted_retryable',
        safe_error_code: 'safe_retry',
        retry_after_ms: 1,
      } as ProviderDispatchOutcome,
    },
    {
      outcome: {
        kind: 'permanently_rejected',
        safe_error_code: 'safe_terminal',
      } as ProviderDispatchOutcome,
    },
  ])('does not report a rejected outcome as completed after a lost fence', async ({ outcome }) => {
    const { repository, suppression, eligibility, email } = ports({ outcome });
    vi.mocked(repository.completeDecision).mockResolvedValueOnce(false);
    await expect(
      runOt16Checkpoint({
        ...checkpointInput(),
        repository,
        suppression,
        eligibility,
        email,
      }),
    ).resolves.toEqual({
      state: 'dispatch_persistence_unconfirmed',
      safe_error_code: 'ot16_decision_completion_unconfirmed',
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
      reservations: 1,
      writes: 2,
    });
  });

  it('does not claim F05 quarantine when dispatch persistence is unconfirmed', async () => {
    const { repository, suppression, eligibility, email } = ports();
    email.dispatchThroughF05.mockRejectedValueOnce(new Error('ambiguous_transport_failure'));
    await expect(
      runOt16Checkpoint({
        ...checkpointInput(),
        repository,
        suppression,
        eligibility,
        email,
      }),
    ).resolves.toEqual({
      state: 'dispatch_persistence_unconfirmed',
      safe_error_code: 'ot16_f05_dispatch_persistence_unconfirmed',
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
      reservations: 1,
      writes: 2,
    });
    expect(repository.completeDecision).not.toHaveBeenCalled();
  });

  it('rejects a mismatched F05 durable receipt without relabeling P28 as skipped', async () => {
    const { repository, suppression, eligibility, email } = ports();
    email.dispatchThroughF05.mockImplementationOnce(async (sendInput) => {
      const receipt = dispatchReceipt(
        { kind: 'acceptance_unknown', safe_error_code: 'safe_unknown' },
        sendInput.operation_id,
      );
      receipt.durable_job.unknown_effect = false;
      return receipt;
    });
    await expect(
      runOt16Checkpoint({
        ...checkpointInput(),
        repository,
        suppression,
        eligibility,
        email,
      }),
    ).resolves.toMatchObject({
      state: 'dispatch_persistence_unconfirmed',
      safe_error_code: 'ot16_f05_dispatch_receipt_mismatch',
      writes: 2,
    });
    expect(repository.completeDecision).not.toHaveBeenCalled();
  });

  it('keeps accepted-but-not-locally-complete work durable and pending', async () => {
    const { repository, suppression, eligibility, email } = ports({
      outcome: {
        kind: 'accepted',
        provider_acceptance_digest: h('b'),
        completed_locally: false,
      },
    });
    await expect(
      runOt16Checkpoint({
        ...checkpointInput(),
        repository,
        suppression,
        eligibility,
        email,
      }),
    ).resolves.toMatchObject({
      state: 'accepted_pending_local_completion',
      safe_error_code: 'ot16_local_completion_pending',
      writes: 2,
    });
    expect(repository.completeDecision).not.toHaveBeenCalled();
  });

  it('does not misclassify accepted work when the P28 completion fence is lost', async () => {
    const { repository, suppression, eligibility, email } = ports();
    vi.mocked(repository.completeDecision).mockResolvedValueOnce(false);
    await expect(
      runOt16Checkpoint({
        ...checkpointInput(),
        repository,
        suppression,
        eligibility,
        email,
      }),
    ).resolves.toMatchObject({
      state: 'accepted_pending_local_completion',
      safe_error_code: 'ot16_local_completion_unconfirmed',
      writes: 2,
    });
  });

  it('rejects a forged deterministic operation ID before all reads and writes', async () => {
    const { repository, suppression, eligibility, email } = ports();
    const forged = checkpointInput();
    forged.operation_id = ot16OperationId({
      adult_id: 'adult-1',
      expiry_at: expiryAt,
      checkpoint_days: 7,
    });
    await expect(
      runOt16Checkpoint({ ...forged, repository, suppression, eligibility, email }),
    ).resolves.toEqual({
      state: 'invalid_operation_id',
      reason: 'operation_id_mismatch',
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
      reservations: 0,
      writes: 0,
    });
    expect(repository.persistDecision).not.toHaveBeenCalled();
    expect(suppression.readCurrent).not.toHaveBeenCalled();
    expect(eligibility.readCurrent).not.toHaveBeenCalled();
    expect(email.dispatchThroughF05).not.toHaveBeenCalled();
  });
});
