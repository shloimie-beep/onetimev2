import { describe, expect, it, vi } from 'vitest';
import {
  CORE_WORKFLOW_BY_KEY,
  type CoreWorkflowProviderPort,
  type CoreWorkflowRepository,
  type CoreWorkflowSuppressionPort,
  type PlanCoreWorkflowInput,
} from '../../../../../../packages/domain/src/communications/workflows/core/index.ts';
import { readAndPersistCoreWorkflow, runCoreWorkflow } from './runner.ts';

function input(workflow_key: PlanCoreWorkflowInput['workflow_key']): PlanCoreWorkflowInput {
  const definition = CORE_WORKFLOW_BY_KEY[workflow_key];
  return {
    workflow_key,
    subject: { kind: 'adult', adult_id: 'adult_1', household_id: 'household_1' },
    evidence: {
      trigger: definition.trigger,
      source_event_id: 'event_1',
      source_event_digest: 'event_digest',
      household_id: 'household_1',
      episode_key: 'episode_1',
      local_commit_readback: true,
      signed_billing_projection: definition.requires_signed_billing_projection,
      approved_audience: true,
      approved_copy: true,
    },
    suppression: suppressionSnapshot(),
    reminder_preference: 'email',
    marketing_permission: true,
    content_digest: 'content_digest',
    audience_digest: 'audience_digest',
    occurred_at: '2026-07-28T00:00:00.000Z',
  };
}

function suppressionSnapshot() {
  return {
    snapshot_id: 'suppression_1',
    adult_id: 'adult_1',
    captured_at: '2026-07-28T00:00:00.000Z',
    email_dnd: false,
    unsubscribed: false,
    complaint: false,
    hard_bounce: false,
    invalid_address: false,
    marketing_suppressed: false,
    optional_reminder_suppressed: false,
    evidence_digest: 'suppression_digest',
  };
}

function ports(overrides?: {
  reserve?: boolean;
  suppression?: ReturnType<typeof suppressionSnapshot>;
  sendFailure?: boolean;
}) {
  const repository: CoreWorkflowRepository = {
    reserveDelivery: vi.fn().mockResolvedValue(overrides?.reserve ?? true),
    completeDelivery: vi.fn().mockResolvedValue(undefined),
    persistReadback: vi.fn().mockResolvedValue(undefined),
  };
  const suppression: CoreWorkflowSuppressionPort = {
    readCurrent: vi.fn().mockResolvedValue(overrides?.suppression ?? suppressionSnapshot()),
  };
  const provider: CoreWorkflowProviderPort = {
    readWorkflow: vi.fn(),
    sendAdultEmail: overrides?.sendFailure
      ? vi.fn().mockRejectedValue(new Error('provider unavailable'))
      : vi.fn().mockResolvedValue({ safe_provider_ref_hash: 'safe_ref_hash' }),
  };
  return { repository, suppression, provider };
}

describe('P29 core GHL worker runner', () => {
  it('rejects Student input before repository, suppression, or provider calls', async () => {
    const dependencies = ports();
    const planInput = input('OT-09');
    planInput.subject = {
      kind: 'student',
      student_id: 'student_1',
      household_id: 'household_1',
    };
    const result = await runCoreWorkflow({ plan_input: planInput, ...dependencies });
    expect(result.state).toBe('student_prohibited');
    expect(dependencies.repository.reserveDelivery).not.toHaveBeenCalled();
    expect(dependencies.suppression.readCurrent).not.toHaveBeenCalled();
    expect(dependencies.provider.sendAdultEmail).not.toHaveBeenCalled();
  });

  it('reserves, then rechecks suppression immediately before send with zero provider calls', async () => {
    const current = suppressionSnapshot();
    current.unsubscribed = true;
    const dependencies = ports({ suppression: current });
    const result = await runCoreWorkflow({
      plan_input: input('OT-02A'),
      ...dependencies,
    });
    expect(result.state).toBe('suppressed');
    expect(dependencies.provider.sendAdultEmail).not.toHaveBeenCalled();
    expect(result.email_provider_calls).toBe(0);
    expect(result.whatsapp_provider_calls).toBe(0);
    expect(result.student_provider_calls).toBe(0);
  });

  it('fences duplicate delivery before the provider call', async () => {
    const dependencies = ports({ reserve: false });
    const result = await runCoreWorkflow({ plan_input: input('OT-08'), ...dependencies });
    expect(result.state).toBe('duplicate');
    expect(dependencies.provider.sendAdultEmail).not.toHaveBeenCalled();
  });

  it('sends one adult-only GHL email and records the dormant WhatsApp reason', async () => {
    const dependencies = ports();
    const result = await runCoreWorkflow({ plan_input: input('OT-04'), ...dependencies });
    expect(result.state).toBe('sent');
    expect(dependencies.provider.sendAdultEmail).toHaveBeenCalledTimes(1);
    expect(dependencies.provider.sendAdultEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_key: 'OT-04',
        adult_id: 'adult_1',
        household_id: 'household_1',
        message_class: 'signup_confirmation',
      }),
    );
    expect(dependencies.repository.completeDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'sent',
        safe_reason: 'whatsapp_channel_dormant',
      }),
    );
    expect(result.whatsapp_provider_calls).toBe(0);
    expect(result.student_provider_calls).toBe(0);
  });

  it('records retry_pending with safe evidence after a provider failure', async () => {
    const dependencies = ports({ sendFailure: true });
    const result = await runCoreWorkflow({ plan_input: input('OT-13'), ...dependencies });
    expect(result.state).toBe('retry_pending');
    expect(dependencies.repository.completeDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'retry_pending',
        safe_provider_ref_hash: null,
        safe_reason: 'ghl_email_provider_failed',
      }),
    );
  });

  it('reads, compares, and persists saved/reopened workflow state without writes', async () => {
    const dependencies = ports();
    const definition = CORE_WORKFLOW_BY_KEY['OT-10'];
    vi.mocked(dependencies.provider.readWorkflow).mockResolvedValue({
      workflow_key: 'OT-10',
      canonical_name: definition.canonical_name,
      state: definition.desired_initial_state,
      trigger: definition.trigger,
      ordered_steps: definition.ordered_steps,
      waits: definition.waits,
      exit_conditions: definition.exit_conditions,
      sender_key: definition.sender_key,
      subject: 'adult_only',
      message_class: definition.message_class,
      content_digest: 'content_digest',
      audience_digest: 'audience_digest',
      requires_send_time_suppression_recheck: true,
      provider_workflow_ref_hash: 'safe_ref_hash',
      provider_read_at: '2026-07-28T00:00:00.000Z',
    });
    const comparison = await readAndPersistCoreWorkflow({
      workflow_key: 'OT-10',
      content_digest: 'content_digest',
      audience_digest: 'audience_digest',
      repository: dependencies.repository,
      provider: dependencies.provider,
    });
    expect(comparison.ready).toBe(true);
    expect(comparison.drift).toEqual([]);
    expect(comparison.provider_effects).toBe(0);
    expect(dependencies.provider.sendAdultEmail).not.toHaveBeenCalled();
    expect(dependencies.repository.persistReadback).toHaveBeenCalledWith(comparison);
  });
});
