import { describe, expect, it } from 'vitest';
import type {
  ClassReminderHouseholdCandidate,
  CommunicationSuppressionSnapshot,
  PlanClassReminderRoutingInput,
} from '../../../../contracts/src/communications/foundation/index.ts';
import { CLASS_REMINDER_APP_PATH } from '../../../../contracts/src/communications/foundation/index.ts';
import { planClassReminderRouting } from './class-reminder.ts';

const h = (value: string) => value.repeat(64).slice(0, 64);

const suppression = (adultId: string): CommunicationSuppressionSnapshot => ({
  snapshot_id: `suppression-${adultId}`,
  adult_id: adultId,
  captured_at: '2026-07-30T15:00:00.000Z',
  email_dnd: false,
  unsubscribed: false,
  complaint: false,
  hard_bounce: false,
  invalid_address: false,
  marketing_suppressed: false,
  optional_reminder_suppressed: false,
  evidence_digest: h('a'),
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
  suppression: suppression('adult-1'),
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

describe('P17 class reminder routing plan', () => {
  it('groups the named Students into one account-owner intent with only the safe constant path', () => {
    const result = planClassReminderRouting(routing());
    expect(result).toMatchObject({
      disposition: 'ready',
      provider_calls: 0,
      intents: [
        {
          request_id: 'P17-REMINDER-ROUTING-001',
          household_id: 'household-1',
          account_owner_adult_id: 'adult-1',
          scheduled_for: '2026-07-30T15:30:00.000Z',
          sender_key: 'office',
          prepared_in_app_access: 'preserve_independent_of_email',
          message: {
            affected_student_labels: ['Ari', 'Leah'],
            app_path: '/app/parent/classes',
            contains_zoom_url: false,
            contains_launch_grant: false,
            contains_technical_alias: false,
            contains_student_authentication: false,
          },
        },
      ],
    });
    expect(result.disposition === 'ready' && result.intents).toHaveLength(1);
  });

  it.each([
    ['registrant', { registrant_state: 'failed' as const }],
    ['portal', { protected_portal_state: 'pending' as const }],
  ])('produces no intent when any named Student lacks active %s readiness', (_label, patch) => {
    const candidate = household();
    candidate.student_preparations = [
      candidate.student_preparations[0]!,
      { ...candidate.student_preparations[1]!, ...patch },
    ];
    expect(planClassReminderRouting(routing([candidate]))).toEqual({
      disposition: 'partial_preparation',
      safe_reason: 'named_student_not_ready',
      intents: [],
      provider_calls: 0,
    });
  });

  it('binds the approved optional-reminder preference and suppression workflow', () => {
    const candidate = household({
      reminder_preference: 'none',
      suppression: {
        ...suppression('adult-1'),
        optional_reminder_suppressed: true,
      },
    });
    const result = planClassReminderRouting(routing([candidate]));
    expect(result.disposition === 'ready' && result.intents[0]!.channel_plan).toMatchObject({
      adult_id: 'adult-1',
      purpose: 'optional_reminder',
      reminder_preference: 'none',
      email: {
        disposition: 'suppressed',
        reason: 'preference_none',
        suppression_recheck_required: true,
      },
      whatsapp_provider_calls: 0,
    });
  });

  it.each([
    ['non-constant app path', household({ app_path: 'https://zoom.invalid/j/private-bearer' })],
    ['wrong lead time', household({ scheduled_for: '2026-07-30T15:29:59.000Z' })],
    ['label/preparation mismatch', household({ student_labels: ['Leah', 'Noach'] })],
    ['suppression for another adult', household({ suppression: suppression('adult-2') })],
  ])('rejects %s before constructing an intent', (_label, candidate) => {
    expect(() => planClassReminderRouting(routing([candidate]))).toThrowError(
      expect.objectContaining({ code: 'invalid_class_reminder_routing' }),
    );
  });

  it('does not propagate an injected provider bearer into the safe message', () => {
    const candidate = {
      ...household(),
      raw_zoom_url: 'https://zoom.invalid/j/private-bearer',
      launch_grant: 'secret-launch-grant',
      technical_alias: 'secret-alias',
      student_authentication: 'secret-student-auth',
    };
    const result = planClassReminderRouting(routing([candidate]));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('private-bearer');
    expect(serialized).not.toContain('secret-launch-grant');
    expect(serialized).not.toContain('secret-alias');
    expect(serialized).not.toContain('secret-student-auth');
  });
});
