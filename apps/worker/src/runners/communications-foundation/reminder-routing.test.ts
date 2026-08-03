import { describe, expect, it, vi } from 'vitest';
import type {
  ClassReminderHouseholdCandidate,
  CommunicationFoundationRepository,
  CommunicationSuppressionSnapshot,
  PlanClassReminderRoutingInput,
  ReminderPreference,
} from '../../../../../packages/contracts/src/communications/foundation/index.ts';
import { CLASS_REMINDER_APP_PATH } from '../../../../../packages/contracts/src/communications/foundation/index.ts';
import { runClassReminderRouting } from './index.ts';

const h = (value: string) => value.repeat(64).slice(0, 64);

const snapshot = (
  overrides: Partial<CommunicationSuppressionSnapshot> = {},
): CommunicationSuppressionSnapshot => ({
  snapshot_id: 'suppression-1',
  adult_id: 'adult-1',
  captured_at: '2026-07-30T15:00:00.000Z',
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

const household = (
  overrides: Partial<ClassReminderHouseholdCandidate> = {},
): ClassReminderHouseholdCandidate => ({
  operation_id: 'class-reminder:occurrence-1:household-1',
  household_id: 'household-1',
  account_owner_adult_id: 'adult-1',
  student_labels: ['Leah', 'Ari'],
  student_preparations: [
    {
      student_label: 'Leah',
      registrant_state: 'active',
      protected_portal_state: 'ready',
    },
    {
      student_label: 'Ari',
      registrant_state: 'active',
      protected_portal_state: 'ready',
    },
  ],
  app_path: CLASS_REMINDER_APP_PATH,
  scheduled_for: '2026-07-30T15:30:00.000Z',
  reminder_preference: 'email',
  suppression: snapshot(),
  expected_version: 0,
  ...overrides,
});

const routing = (
  households: readonly ClassReminderHouseholdCandidate[] = [household()],
): PlanClassReminderRoutingInput => ({
  occurrence_id: 'occurrence-1',
  occurrence_starts_at: '2026-07-30T16:00:00.000Z',
  households,
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
  const preference = {
    readCurrent: vi.fn(async (): Promise<ReminderPreference> => 'email'),
  };
  const suppression = { readCurrent: vi.fn(async () => snapshot()) };
  const email = {
    send: vi.fn(async () => ({ safe_provider_ref_hash: h('b') })),
  };
  return { repository, preference, suppression, email };
}

describe('P17 class reminder worker routing', () => {
  it('sends one household email with every affected Student label and the constant app path', async () => {
    const { repository, preference, suppression, email } = ports();
    const result = await runClassReminderRouting({
      routing: routing(),
      repository,
      preference,
      suppression,
      email,
    });
    expect(result).toMatchObject({
      state: 'routed',
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
      prepared_in_app_access: 'preserved',
      email_failure_visible: false,
    });
    expect(email.send).toHaveBeenCalledWith({
      operation_id: 'class-reminder:occurrence-1:household-1',
      adult_id: 'adult-1',
      sender_key: 'office',
      transport: 'GHL',
      safe_message: {
        kind: 'account_owner_class_reminder',
        affected_student_labels: ['Ari', 'Leah'],
        app_path: '/app/parent/classes',
        contains_zoom_url: false,
        contains_launch_grant: false,
        contains_technical_alias: false,
        contains_student_authentication: false,
      },
    });
  });

  it('hard-stops all routing before persistence or provider access on partial preparation', async () => {
    const candidate = household();
    candidate.student_preparations = [
      candidate.student_preparations[0]!,
      {
        ...candidate.student_preparations[1]!,
        registrant_state: 'provisioning',
      },
    ];
    const { repository, preference, suppression, email } = ports();
    expect(
      await runClassReminderRouting({
        routing: routing([candidate]),
        repository,
        preference,
        suppression,
        email,
      }),
    ).toEqual({
      state: 'partial_preparation',
      safe_reason: 'named_student_not_ready',
      household_results: [],
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    });
    expect(repository.persistDecision).not.toHaveBeenCalled();
    expect(preference.readCurrent).not.toHaveBeenCalled();
    expect(suppression.readCurrent).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('rechecks current suppression immediately before reservation and sends nothing when suppressed', async () => {
    const { repository, preference, suppression, email } = ports();
    vi.mocked(suppression.readCurrent).mockResolvedValueOnce(
      snapshot({ snapshot_id: 'suppression-current', unsubscribed: true }),
    );
    const result = await runClassReminderRouting({
      routing: routing(),
      repository,
      preference,
      suppression,
      email,
    });
    expect(result).toMatchObject({
      state: 'routed',
      household_results: [{ result: { state: 'skipped', reason: 'unsubscribed' } }],
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    });
    expect(repository.reserveEmailDelivery).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('reads the current preference and honors a change to none before routing', async () => {
    const { repository, preference, suppression, email } = ports();
    vi.mocked(preference.readCurrent).mockResolvedValueOnce('none');
    const result = await runClassReminderRouting({
      routing: routing(),
      repository,
      preference,
      suppression,
      email,
    });
    expect(result).toMatchObject({
      state: 'routed',
      household_results: [{ result: { state: 'skipped', reason: 'preference_none' } }],
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    });
    expect(preference.readCurrent).toHaveBeenCalledWith('adult-1');
    expect(email.send).not.toHaveBeenCalled();
  });

  it('uses the existing delivery reservation to make a replay provider-safe', async () => {
    const { repository, preference, suppression, email } = ports();
    vi.mocked(repository.reserveEmailDelivery)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const input = {
      routing: routing(),
      repository,
      preference,
      suppression,
      email,
    };
    expect(await runClassReminderRouting(input)).toMatchObject({
      household_results: [{ result: { state: 'sent' } }],
    });
    expect(await runClassReminderRouting(input)).toMatchObject({
      household_results: [{ result: { state: 'duplicate' } }],
    });
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('keeps an email failure visible and retryable without revoking prepared in-app access', async () => {
    const { repository, preference, suppression, email } = ports();
    vi.mocked(email.send).mockRejectedValueOnce(new Error('synthetic provider failure'));
    const result = await runClassReminderRouting({
      routing: routing(),
      repository,
      preference,
      suppression,
      email,
    });
    expect(result).toMatchObject({
      state: 'retry_pending',
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
      prepared_in_app_access: 'preserved',
      email_failure_visible: true,
      household_results: [{ result: { state: 'retry_pending' } }],
    });
    expect(repository.completeDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        operation_id: 'class-reminder:occurrence-1:household-1',
        status: 'retry_pending',
        safe_reason: 'email_provider_failed',
      }),
    );
  });
});
