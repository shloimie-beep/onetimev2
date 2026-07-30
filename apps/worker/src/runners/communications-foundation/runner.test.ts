import { describe, expect, it, vi } from 'vitest';
import type {
  CommunicationFoundationRepository,
  CommunicationSuppressionSnapshot,
  PlanCommunicationChannelsInput,
} from '../../../../../packages/contracts/src/communications/foundation/index.ts';
import { runEmailFirstCommunication, runWebsiteLeadCapture } from './index.ts';

const h = (value: string) => value.repeat(64).slice(0, 64);
const snapshot = (
  overrides: Partial<CommunicationSuppressionSnapshot> = {},
): CommunicationSuppressionSnapshot => ({
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
});
const planInput = (): PlanCommunicationChannelsInput => ({
  operation_id: 'message-1',
  subject: { kind: 'adult', adult_id: 'adult-1', household_id: 'household-1' },
  purpose: 'optional_reminder',
  reminder_preference: 'whatsapp',
  marketing_permission: false,
  suppression: snapshot(),
});

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

describe('P28 worker communication boundary', () => {
  it('sends email for a WhatsApp preference, records dormant channel truth, and makes zero WhatsApp calls', async () => {
    const { repository, suppression, email } = ports();
    const result = await runEmailFirstCommunication({
      plan_input: planInput(),
      sender_key: 'office',
      expected_version: 0,
      repository,
      suppression,
      email,
    });
    expect(result).toEqual({
      state: 'sent',
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
    });
    expect(email.send).toHaveBeenCalledOnce();
    expect(repository.completeDecision).toHaveBeenCalledWith(
      expect.objectContaining({ safe_reason: 'channel_skipped_not_configured' }),
    );
  });

  it('rechecks suppression after planning and before reserving or sending', async () => {
    const { repository, suppression, email } = ports();
    vi.mocked(suppression.readCurrent).mockResolvedValueOnce(
      snapshot({ snapshot_id: 'suppression-2', unsubscribed: true }),
    );
    const result = await runEmailFirstCommunication({
      plan_input: planInput(),
      sender_key: 'office',
      expected_version: 0,
      repository,
      suppression,
      email,
    });
    expect(result).toMatchObject({
      state: 'skipped',
      reason: 'unsubscribed',
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    });
    expect(repository.reserveEmailDelivery).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('deduplicates replay before an email provider effect', async () => {
    const { repository, suppression, email } = ports();
    vi.mocked(repository.reserveEmailDelivery).mockResolvedValueOnce(false);
    expect(
      await runEmailFirstCommunication({
        plan_input: planInput(),
        sender_key: 'office',
        expected_version: 0,
        repository,
        suppression,
        email,
      }),
    ).toMatchObject({ state: 'duplicate', email_provider_calls: 0 });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('uses Resend for requested security even when optional preference is none and marketing is suppressed', async () => {
    const input = planInput();
    input.purpose = 'requested_security';
    input.reminder_preference = 'none';
    input.suppression = snapshot({ email_dnd: true, unsubscribed: true });
    const { repository, suppression, email } = ports();
    vi.mocked(suppression.readCurrent).mockResolvedValueOnce(input.suppression);
    expect(
      await runEmailFirstCommunication({
        plan_input: input,
        sender_key: 'security_resend',
        expected_version: 0,
        repository,
        suppression,
        email,
      }),
    ).toMatchObject({ state: 'sent', email_provider_calls: 1, whatsapp_provider_calls: 0 });
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ transport: 'Resend' }));
  });

  it('hard-stops a Student before persistence or provider access', async () => {
    const input = planInput();
    input.subject = {
      kind: 'student',
      student_id: 'student-1',
      household_id: 'household-1',
    };
    const { repository, suppression, email } = ports();
    expect(
      await runEmailFirstCommunication({
        plan_input: input,
        sender_key: 'office',
        expected_version: 0,
        repository,
        suppression,
        email,
      }),
    ).toEqual({
      state: 'student_prohibited',
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    });
    expect(repository.persistDecision).not.toHaveBeenCalled();
    expect(suppression.readCurrent).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('persists website lead plans locally with no provider effect', async () => {
    const { repository } = ports();
    const result = await runWebsiteLeadCapture({
      capture: {
        operation_id: 'lead-1',
        source: 'public_website',
        subject: { kind: 'adult', adult_id: 'adult-1', household_id: null },
        name: 'Parent Operator',
        normalized_email: 'parent@example.invalid',
        lead_kind: 'school',
        timezone: 'Asia/Jerusalem',
        phone: null,
        transcript_ref_hash: h('c'),
        public_knowledge_answered: true,
      },
      repository,
    });
    expect(result).toMatchObject({
      state: 'persisted',
      provider_calls: 0,
      plan: { next_action: 'record_school_inquiry', creates_student: false },
    });
  });
});
