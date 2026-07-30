import { describe, expect, it, vi } from 'vitest';

import type {
  CommunicationFoundationRepository,
  CommunicationSuppressionSnapshot,
} from '../../../../../../packages/contracts/src/communications/foundation/index.ts';
import type { CampaignAudienceCandidate } from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import { ot16OperationId } from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import { runOt16Checkpoint } from './index.ts';

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

function ports(currentCandidate: CampaignAudienceCandidate = candidate()) {
  const repository: CommunicationFoundationRepository = {
    saveReminderPreference: vi.fn(async () => true),
    persistDecision: vi.fn(async () => true),
    reserveEmailDelivery: vi.fn(async () => true),
    completeDecision: vi.fn(async () => true),
    persistWorkflowReadback: vi.fn(async () => true),
    persistGovernedRequest: vi.fn(async () => true),
    persistWebsiteLeadPlan: vi.fn(async () => true),
  };
  const suppression = { readCurrent: vi.fn(async () => snapshot()) };
  const eligibility = { readCurrent: vi.fn(async () => currentCandidate) };
  const email = {
    send: vi.fn(async () => ({ safe_provider_ref_hash: h('b') })),
  };
  return { repository, suppression, eligibility, email };
}

function input() {
  const checkpointDays = 14 as const;
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
  };
}

describe('P30 OT-16 worker boundary', () => {
  it('delivers the exact GHL email after fresh suppression and records dormant WhatsApp truth', async () => {
    const { repository, suppression, eligibility, email } = ports();
    expect(
      await runOt16Checkpoint({ ...input(), repository, suppression, eligibility, email }),
    ).toEqual({
      state: 'sent',
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
    });
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        sender_key: 'office',
        transport: 'GHL',
        cta_label: 'Complete Checkout',
        content_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(repository.completeDecision).toHaveBeenCalledWith(
      expect.objectContaining({ safe_reason: 'channel_skipped_not_configured' }),
    );
    expect(
      vi.mocked(repository.reserveEmailDelivery).mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY,
    ).toBeLessThan(eligibility.readCurrent.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY);
    expect(
      eligibility.readCurrent.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    ).toBeLessThan(email.send.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY);
  });

  it('rechecks suppression immediately before reserve and provider access', async () => {
    const { repository, suppression, eligibility, email } = ports();
    vi.mocked(suppression.readCurrent).mockResolvedValueOnce(
      snapshot({ snapshot_id: 'suppression-2', unsubscribed: true }),
    );
    expect(
      await runOt16Checkpoint({ ...input(), repository, suppression, eligibility, email }),
    ).toMatchObject({
      state: 'skipped',
      reason: 'unsubscribed',
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    });
    expect(repository.reserveEmailDelivery).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('deduplicates before the email provider effect', async () => {
    const { repository, suppression, eligibility, email } = ports();
    vi.mocked(repository.reserveEmailDelivery).mockResolvedValueOnce(false);
    expect(
      await runOt16Checkpoint({ ...input(), repository, suppression, eligibility, email }),
    ).toMatchObject({
      state: 'duplicate',
      email_provider_calls: 0,
    });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('hard-stops Student and paid/School exits before repository or provider access', async () => {
    for (const currentCandidate of [
      candidate({
        subject: {
          kind: 'student',
          student_id: 'student-1',
          household_id: 'household-1',
        },
      }),
      candidate({ verified_paid_access: true }),
      candidate({ explicitly_declined: true }),
      candidate({ custom_school_terms: true }),
    ]) {
      const { repository, suppression, eligibility, email } = ports();
      const result = await runOt16Checkpoint({
        ...input(),
        candidate: currentCandidate,
        repository,
        suppression,
        eligibility,
        email,
      });
      expect(result.email_provider_calls).toBe(0);
      expect(result.whatsapp_provider_calls).toBe(0);
      expect(repository.persistDecision).not.toHaveBeenCalled();
      expect(suppression.readCurrent).not.toHaveBeenCalled();
      expect(eligibility.readCurrent).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    }
  });

  it('refreshes paid, decline, and School eligibility after reserve and immediately before dispatch', async () => {
    for (const [currentCandidate, expectedReason] of [
      [candidate({ verified_paid_access: true }), 'verified_paid_access'],
      [candidate({ explicitly_declined: true }), 'explicit_decline'],
      [candidate({ custom_school_terms: true }), 'custom_school_terms'],
    ] as const) {
      const { repository, suppression, eligibility, email } = ports(currentCandidate);
      const result = await runOt16Checkpoint({
        ...input(),
        repository,
        suppression,
        eligibility,
        email,
      });
      expect(result).toEqual({
        state: 'exited',
        reason: expectedReason,
        email_provider_calls: 0,
        whatsapp_provider_calls: 0,
      });
      expect(repository.reserveEmailDelivery).toHaveBeenCalledOnce();
      expect(eligibility.readCurrent).toHaveBeenCalledWith('adult-1');
      expect(
        vi.mocked(repository.reserveEmailDelivery).mock.invocationCallOrder[0] ??
          Number.POSITIVE_INFINITY,
      ).toBeLessThan(
        eligibility.readCurrent.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
      );
      expect(repository.completeDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'skipped',
          safe_reason: `send_time_${expectedReason}`,
        }),
      );
      expect(email.send).not.toHaveBeenCalled();
    }
  });

  it('rejects a forged checkpoint operation ID before repository or provider access', async () => {
    const { repository, suppression, eligibility, email } = ports();
    const forgedInput = input();
    forgedInput.operation_id = ot16OperationId({
      adult_id: 'adult-1',
      expiry_at: expiryAt,
      checkpoint_days: 7,
    });
    expect(
      await runOt16Checkpoint({
        ...forgedInput,
        repository,
        suppression,
        eligibility,
        email,
      }),
    ).toEqual({
      state: 'invalid_operation_id',
      reason: 'operation_id_mismatch',
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    });
    expect(repository.persistDecision).not.toHaveBeenCalled();
    expect(suppression.readCurrent).not.toHaveBeenCalled();
    expect(eligibility.readCurrent).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });
});
