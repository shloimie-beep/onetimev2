import { describe, expect, it, vi } from 'vitest';
import {
  CORE_WORKFLOW_BY_KEY,
  type CoreWorkflowApprovalReadPort,
  type CoreWorkflowApprovalSnapshot,
  type CoreWorkflowProviderPort,
  type CoreWorkflowRepository,
  type CoreWorkflowSuppressionPort,
  type PlanCoreWorkflowInput,
} from '../../../../../../packages/domain/src/communications/workflows/core/index.ts';
import { readAndPersistCoreWorkflow, runCoreWorkflow } from './runner.ts';

const h = (value: string) => value.repeat(64).slice(0, 64);

function approvalSnapshot(
  overrides: Partial<CoreWorkflowApprovalSnapshot> = {},
): CoreWorkflowApprovalSnapshot {
  return {
    approval_id: 'approval_1',
    source: 'trusted_approval_store',
    approved_by_admin_id: 'admin_1',
    approved_at: '2026-07-28T00:00:00.000Z',
    approved_audience: true,
    approved_copy: true,
    approved_content_digest: h('c'),
    approved_audience_digest: h('d'),
    admin_approved: true,
    provider_readback_verified: true,
    evidence_digest: h('e'),
    ...overrides,
  };
}

function fullInput(workflow_key: PlanCoreWorkflowInput['workflow_key']): PlanCoreWorkflowInput {
  const definition = CORE_WORKFLOW_BY_KEY[workflow_key];
  return {
    workflow_key,
    subject: { kind: 'adult', adult_id: 'adult_1', household_id: 'household_1' },
    evidence: {
      trigger: definition.trigger,
      source_event_id: 'event_1',
      source_event_digest: h('f'),
      household_id: 'household_1',
      episode_key: 'episode_1',
      local_commit_readback: true,
      signed_billing_projection: definition.requires_signed_billing_projection,
    },
    approval: approvalSnapshot(),
    suppression: suppressionSnapshot(),
    reminder_preference: 'email',
    marketing_permission: true,
    content_digest: h('c'),
    audience_digest: h('d'),
    occurred_at: '2026-07-28T00:00:00.000Z',
  };
}

function runnerInput(workflow_key: PlanCoreWorkflowInput['workflow_key']) {
  const { approval: _approval, ...input } = fullInput(workflow_key);
  void _approval;
  return input;
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
    evidence_digest: h('a'),
  };
}

function ports(overrides?: {
  reserve?: boolean;
  suppression?: ReturnType<typeof suppressionSnapshot>;
  approval?: CoreWorkflowApprovalSnapshot | null;
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
  const approval: CoreWorkflowApprovalReadPort = {
    readApproved: vi
      .fn()
      .mockResolvedValue(
        overrides && 'approval' in overrides ? overrides.approval : approvalSnapshot(),
      ),
  };
  const provider: CoreWorkflowProviderPort = {
    readWorkflow: vi.fn(),
    sendAdultEmail: overrides?.sendFailure
      ? vi.fn().mockRejectedValue(new Error('provider unavailable'))
      : vi.fn().mockResolvedValue({ safe_provider_ref_hash: 'safe_ref_hash' }),
  };
  return { repository, suppression, approval, provider };
}

describe('P29 core GHL worker runner', () => {
  it('rejects Student input before approval, repository, suppression, or provider calls', async () => {
    const dependencies = ports();
    const planInput = runnerInput('OT-09');
    planInput.subject = {
      kind: 'student',
      student_id: 'student_1',
      household_id: 'household_1',
    };
    const result = await runCoreWorkflow({ plan_input: planInput, ...dependencies });
    expect(result.state).toBe('student_prohibited');
    expect(dependencies.approval.readApproved).not.toHaveBeenCalled();
    expect(dependencies.repository.reserveDelivery).not.toHaveBeenCalled();
    expect(dependencies.suppression.readCurrent).not.toHaveBeenCalled();
    expect(dependencies.provider.sendAdultEmail).not.toHaveBeenCalled();
  });

  it('fails closed on missing or false trusted approval before reservation or delivery', async () => {
    for (const approval of [
      null,
      approvalSnapshot({ approved_audience: false }),
      approvalSnapshot({ approved_copy: false }),
    ]) {
      const dependencies = ports({ approval });
      const result = await runCoreWorkflow({
        plan_input: runnerInput('OT-02B'),
        ...dependencies,
      });
      expect(result.state).toBe('invalid_evidence');
      expect(dependencies.repository.reserveDelivery).not.toHaveBeenCalled();
      expect(dependencies.suppression.readCurrent).not.toHaveBeenCalled();
      expect(dependencies.provider.sendAdultEmail).not.toHaveBeenCalled();
    }
  });

  it('fails closed on trusted content or audience digest mismatch before reservation', async () => {
    for (const field of ['content_digest', 'audience_digest'] as const) {
      const dependencies = ports();
      const planInput = runnerInput('OT-04');
      planInput[field] = h('1');
      const result = await runCoreWorkflow({ plan_input: planInput, ...dependencies });
      expect(result.state).toBe('invalid_evidence');
      expect(dependencies.repository.reserveDelivery).not.toHaveBeenCalled();
      expect(dependencies.provider.sendAdultEmail).not.toHaveBeenCalled();
    }
  });

  it('requires OT-10 Admin approval and provider readback before reservation or delivery', async () => {
    for (const approval of [
      approvalSnapshot({ admin_approved: false }),
      approvalSnapshot({ provider_readback_verified: false }),
    ]) {
      const dependencies = ports({ approval });
      const result = await runCoreWorkflow({
        plan_input: runnerInput('OT-10'),
        ...dependencies,
      });
      expect(result.state).toBe('invalid_evidence');
      expect(dependencies.repository.reserveDelivery).not.toHaveBeenCalled();
      expect(dependencies.suppression.readCurrent).not.toHaveBeenCalled();
      expect(dependencies.provider.sendAdultEmail).not.toHaveBeenCalled();
    }
  });

  it('reserves trusted approval, then rechecks suppression before send', async () => {
    const current = suppressionSnapshot();
    current.unsubscribed = true;
    const dependencies = ports({ suppression: current });
    const result = await runCoreWorkflow({
      plan_input: runnerInput('OT-02A'),
      ...dependencies,
    });
    expect(result.state).toBe('suppressed');
    expect(dependencies.repository.reserveDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        approval_id: 'approval_1',
        approval_evidence_digest: h('e'),
      }),
    );
    expect(dependencies.provider.sendAdultEmail).not.toHaveBeenCalled();
    expect(result.email_provider_calls).toBe(0);
    expect(result.whatsapp_provider_calls).toBe(0);
    expect(result.student_provider_calls).toBe(0);
  });

  it('fences duplicate delivery before the provider call', async () => {
    const dependencies = ports({ reserve: false });
    const result = await runCoreWorkflow({
      plan_input: runnerInput('OT-08'),
      ...dependencies,
    });
    expect(result.state).toBe('duplicate');
    expect(dependencies.provider.sendAdultEmail).not.toHaveBeenCalled();
  });

  it('sends one approval-bound adult-only GHL email', async () => {
    const dependencies = ports();
    const result = await runCoreWorkflow({
      plan_input: runnerInput('OT-04'),
      ...dependencies,
    });
    expect(result.state).toBe('sent');
    expect(dependencies.provider.sendAdultEmail).toHaveBeenCalledTimes(1);
    expect(dependencies.provider.sendAdultEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_key: 'OT-04',
        adult_id: 'adult_1',
        household_id: 'household_1',
        message_class: 'signup_confirmation',
        approval_id: 'approval_1',
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
    const result = await runCoreWorkflow({
      plan_input: runnerInput('OT-13'),
      ...dependencies,
    });
    expect(result.state).toBe('retry_pending');
    expect(dependencies.repository.completeDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'retry_pending',
        safe_provider_ref_hash: null,
        safe_reason: 'ghl_email_provider_failed',
      }),
    );
  });

  it('reads and persists workflow state only after trusted approval evidence', async () => {
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
      content_digest: h('c'),
      audience_digest: h('d'),
      requires_send_time_suppression_recheck: true,
      provider_workflow_ref_hash: 'safe_ref_hash',
      provider_read_at: '2026-07-28T00:00:00.000Z',
    });
    const comparison = await readAndPersistCoreWorkflow({
      approval_lookup: {
        workflow_key: 'OT-10',
        adult_id: 'adult_1',
        household_id: 'household_1',
        source_event_id: 'event_1',
      },
      approval: dependencies.approval,
      repository: dependencies.repository,
      provider: dependencies.provider,
    });
    expect(comparison.ready).toBe(true);
    expect(comparison.drift).toEqual([]);
    expect(comparison.approval_id).toBe('approval_1');
    expect(comparison.provider_effects).toBe(0);
    expect(dependencies.provider.sendAdultEmail).not.toHaveBeenCalled();
    expect(dependencies.repository.persistReadback).toHaveBeenCalledWith(comparison);
  });

  it('does not read provider workflow state without trusted OT-10 approval/readback', async () => {
    const dependencies = ports({
      approval: approvalSnapshot({ provider_readback_verified: false }),
    });
    await expect(
      readAndPersistCoreWorkflow({
        approval_lookup: {
          workflow_key: 'OT-10',
          adult_id: 'adult_1',
          household_id: 'household_1',
          source_event_id: 'event_1',
        },
        approval: dependencies.approval,
        repository: dependencies.repository,
        provider: dependencies.provider,
      }),
    ).rejects.toThrow('provider_readback_required');
    expect(dependencies.provider.readWorkflow).not.toHaveBeenCalled();
    expect(dependencies.repository.persistReadback).not.toHaveBeenCalled();
  });
});
