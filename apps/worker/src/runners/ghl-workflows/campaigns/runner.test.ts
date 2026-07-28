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

function ports() {
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
  const email = {
    send: vi.fn(async () => ({ safe_provider_ref_hash: h('b') })),
  };
  return { repository, suppression, email };
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
    const { repository, suppression, email } = ports();
    expect(await runOt16Checkpoint({ ...input(), repository, suppression, email })).toEqual({
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
  });

  it('rechecks suppression immediately before reserve and provider access', async () => {
    const { repository, suppression, email } = ports();
    vi.mocked(suppression.readCurrent).mockResolvedValueOnce(
      snapshot({ snapshot_id: 'suppression-2', unsubscribed: true }),
    );
    expect(await runOt16Checkpoint({ ...input(), repository, suppression, email })).toMatchObject({
      state: 'skipped',
      reason: 'unsubscribed',
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    });
    expect(repository.reserveEmailDelivery).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('deduplicates before the email provider effect', async () => {
    const { repository, suppression, email } = ports();
    vi.mocked(repository.reserveEmailDelivery).mockResolvedValueOnce(false);
    expect(await runOt16Checkpoint({ ...input(), repository, suppression, email })).toMatchObject({
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
      candidate({ custom_school_terms: true }),
    ]) {
      const { repository, suppression, email } = ports();
      const result = await runOt16Checkpoint({
        ...input(),
        candidate: currentCandidate,
        repository,
        suppression,
        email,
      });
      expect(result.email_provider_calls).toBe(0);
      expect(result.whatsapp_provider_calls).toBe(0);
      expect(repository.persistDecision).not.toHaveBeenCalled();
      expect(suppression.readCurrent).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    }
  });
});
