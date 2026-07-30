import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CORE_WORKFLOW_ACCEPTANCE_CASE_IDS,
  CORE_WORKFLOW_BY_KEY,
  CORE_WORKFLOW_DEFINITIONS,
  CORE_WORKFLOW_KEYS,
  CORE_WORKFLOW_REQUIREMENT_IDS,
  compareCoreWorkflowReadback,
  planCoreWorkflowEvent,
  validateCoreWorkflowDefinitions,
  type CoreWorkflowApprovalSnapshot,
  type CoreWorkflowKey,
  type PlanCoreWorkflowInput,
} from './index.ts';

const { load } = createRequire(import.meta.url)('js-yaml') as {
  load(source: string): unknown;
};
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

function planInput(workflow_key: CoreWorkflowKey): PlanCoreWorkflowInput {
  const definition = CORE_WORKFLOW_BY_KEY[workflow_key];
  return {
    workflow_key,
    subject: { kind: 'adult', adult_id: 'adult_1', household_id: 'household_1' },
    evidence: {
      trigger: definition.trigger,
      source_event_id: `event_${workflow_key}`,
      source_event_digest: h('f'),
      household_id: 'household_1',
      episode_key: 'episode_1',
      local_commit_readback: true,
      signed_billing_projection: definition.requires_signed_billing_projection,
    },
    approval: approvalSnapshot(),
    suppression: {
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
    },
    reminder_preference: 'email',
    marketing_permission: true,
    content_digest: h('c'),
    audience_digest: h('d'),
    occurred_at: '2026-07-28T00:00:00.000Z',
  };
}

describe('P29 core GHL workflow definitions', () => {
  it('validates the complete exact-key fragment, including OT-02A and OT-02B', () => {
    expect(() => validateCoreWorkflowDefinitions()).not.toThrow();
    expect(CORE_WORKFLOW_DEFINITIONS).toHaveLength(12);
    expect(CORE_WORKFLOW_DEFINITIONS.map((workflow) => workflow.workflow_key)).toEqual(
      CORE_WORKFLOW_KEYS,
    );
  });

  it.each(CORE_WORKFLOW_DEFINITIONS)(
    '$acceptance_case_id plans $workflow_key without financial, access, Student, or WhatsApp effects',
    (definition) => {
      const plan = planCoreWorkflowEvent(planInput(definition.workflow_key));
      expect(definition.requirement_id).toBe(
        CORE_WORKFLOW_REQUIREMENT_IDS[definition.workflow_key],
      );
      expect(definition.acceptance_case_id).toBe(
        CORE_WORKFLOW_ACCEPTANCE_CASE_IDS[definition.workflow_key],
      );
      expect(plan.workflow_key).toBe(definition.workflow_key);
      expect(plan.ordered_steps).toEqual(definition.ordered_steps);
      expect(plan.waits).toEqual(definition.waits);
      expect(plan.exit_conditions).toEqual(definition.exit_conditions);
      expect(plan.approval_id).toBe('approval_1');
      expect(plan.approval_evidence_digest).toBe(h('e'));
      expect(plan.direct_financial_mutation).toBe(false);
      expect(plan.direct_access_mutation).toBe(false);
      expect(plan.student_provider_calls).toBe(0);
      expect(plan.whatsapp_provider_calls).toBe(0);
      expect(plan.email).toEqual({
        disposition: 'send',
        provider: 'GHL',
        suppression_recheck_required: true,
      });
    },
  );

  it.each(CORE_WORKFLOW_DEFINITIONS)(
    '$workflow_key fails closed when audience or copy approval is false',
    (definition) => {
      for (const field of ['approved_audience', 'approved_copy'] as const) {
        const input = planInput(definition.workflow_key);
        input.approval = approvalSnapshot({ [field]: false });
        expect(() => planCoreWorkflowEvent(input)).toThrow(
          field === 'approved_audience' ? 'approved_audience_required' : 'approved_copy_required',
        );
      }
    },
  );

  it.each(CORE_WORKFLOW_DEFINITIONS)(
    '$workflow_key rejects content and audience drift against separately trusted approval digests',
    (definition) => {
      const contentDrift = planInput(definition.workflow_key);
      contentDrift.content_digest = h('1');
      expect(() => planCoreWorkflowEvent(contentDrift)).toThrow('approved_content_digest_mismatch');

      const audienceDrift = planInput(definition.workflow_key);
      audienceDrift.audience_digest = h('2');
      expect(() => planCoreWorkflowEvent(audienceDrift)).toThrow(
        'approved_audience_digest_mismatch',
      );
    },
  );

  it('mirrors all twelve definitions and exact traceability in the owned fragment', () => {
    const fragmentPath = fileURLToPath(
      new URL(
        '../../../../../../integrations/highlevel/v21/workflow-fragments/P29-core-lifecycle.yaml',
        import.meta.url,
      ),
    );
    const fragment = load(readFileSync(fragmentPath, 'utf8')) as {
      owner_task: string;
      effect_policy: Record<string, number | string>;
      invariants: Record<string, boolean | string>;
      workflows: Array<Record<string, unknown>>;
    };
    expect(fragment.owner_task).toBe('P29');
    expect(fragment.workflows).toHaveLength(12);
    expect(fragment.effect_policy).toMatchObject({
      messages_sent: 0,
      workflow_publications: 0,
      financial_mutations: 0,
      access_mutations: 0,
      student_contact_calls: 0,
      whatsapp_provider_calls: 0,
    });
    expect(fragment.invariants).toMatchObject({
      trusted_approval_store_required: true,
      approved_content_digest_match_required: true,
      approved_audience_digest_match_required: true,
    });
    for (const definition of CORE_WORKFLOW_DEFINITIONS) {
      expect(fragment.workflows).toContainEqual(
        expect.objectContaining({
          workflow_key: definition.workflow_key,
          requirement_id: definition.requirement_id,
          acceptance_case_id: definition.acceptance_case_id,
          canonical_name: definition.canonical_name,
          trigger: definition.trigger,
          ordered_steps: [...definition.ordered_steps],
          waits: [...definition.waits],
          policy_constants: [...definition.policy_constants],
          exit_conditions: [...definition.exit_conditions],
          requires_approved_audience: true,
          requires_approved_copy: true,
          requires_admin_approval: definition.requires_admin_approval,
          requires_provider_readback: definition.requires_provider_readback,
        }),
      );
    }
  });

  it('matches the P28 canonical registry identity, sender, message class, trigger, and desired state', () => {
    const registryPath = fileURLToPath(
      new URL(
        '../../../../../../integrations/highlevel/registry/workflow-registry.yaml',
        import.meta.url,
      ),
    );
    const registry = load(readFileSync(registryPath, 'utf8')) as {
      business_workflows: Array<{
        key: string;
        canonicalName: string;
        desiredStatus: string;
        senderKey: string;
        messageClass: string;
        exactTrigger: string;
      }>;
    };
    for (const definition of CORE_WORKFLOW_DEFINITIONS) {
      const canonical = registry.business_workflows.find(
        (workflow) => workflow.key === definition.workflow_key,
      );
      expect(canonical).toMatchObject({
        canonicalName: definition.canonical_name,
        desiredStatus: definition.desired_initial_state,
        senderKey: definition.sender_key,
        messageClass: definition.message_class,
        exactTrigger: definition.trigger,
      });
    }
  });

  it('enforces OT-02B explicit opt-in in addition to audience and copy approval', () => {
    const nurture = planInput('OT-02B');
    nurture.marketing_permission = false;
    expect(() => planCoreWorkflowEvent(nurture)).toThrow(
      'explicit_opt_in_and_admin_start_required',
    );
  });

  it('requires signed projections for every billing-authoritative trigger', () => {
    for (const key of ['OT-04', 'OT-05', 'OT-06', 'OT-13'] as const) {
      const input = planInput(key);
      input.evidence.signed_billing_projection = false;
      expect(() => planCoreWorkflowEvent(input)).toThrow('signed_billing_projection_required');
    }
  });

  it('rejects Student subjects before any provider plan can exist', () => {
    const input = planInput('OT-09');
    input.subject = { kind: 'student', student_id: 'student_1', household_id: 'household_1' };
    expect(() => planCoreWorkflowEvent(input)).toThrow('student_contact_prohibited');
  });

  it('pins OT-09 to one Parent reminder 30 minutes before with no protected class URL', () => {
    const reminder = CORE_WORKFLOW_BY_KEY['OT-09'];
    expect(reminder.waits).toEqual(['until_30_minutes_before_occurrence']);
    expect(reminder.ordered_steps).toContain(
      'send_one_parent_message_30_minutes_before_occurrence',
    );
    expect(reminder.ordered_steps.join(' ')).not.toMatch(/zoom|student_(?:url|link)/i);
    expect(reminder.ghl_student_contact_calls).toBe(0);
    expect(reminder.policy_constants).toContain('parent_reminder_offset=PT30M');
  });

  it('pins OT-01 signup lifecycle projection and exact cutover plus the migration audience', () => {
    expect(CORE_WORKFLOW_BY_KEY['OT-01'].ordered_steps).toContain(
      'project_one_time_family_signup_lifecycle',
    );
    expect(CORE_WORKFLOW_BY_KEY['OT-01'].policy_constants).toContain(
      'free_access_cutover=2026-09-13T19:24:00+03:00',
    );
    expect(CORE_WORKFLOW_BY_KEY['OT-02A'].policy_constants).toContain(
      'audience=OT-02A | Replit Active Migration Candidates | 2026',
    );
  });

  it('keeps OT-07 secure setup links in Resend and out of GHL', () => {
    expect(CORE_WORKFLOW_BY_KEY['OT-07'].ordered_steps).toEqual([
      'send_ghl_companion_explanation_without_security_token',
      'leave_setup_token_and_setup_link_delivery_to_resend',
    ]);
  });

  it('requires OT-10 Admin approval and provider readback before planning', () => {
    const noAdmin = planInput('OT-10');
    noAdmin.approval = approvalSnapshot({ admin_approved: false });
    expect(() => planCoreWorkflowEvent(noAdmin)).toThrow('admin_approval_required');

    const noReadback = planInput('OT-10');
    noReadback.approval = approvalSnapshot({ provider_readback_verified: false });
    expect(() => planCoreWorkflowEvent(noReadback)).toThrow('provider_readback_required');
  });

  it('compares readback only to trusted approved digests and reports exact drift', () => {
    const definition = CORE_WORKFLOW_BY_KEY['OT-10'];
    const comparison = compareCoreWorkflowReadback(
      definition,
      {
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
        content_digest: h('1'),
        audience_digest: h('d'),
        requires_send_time_suppression_recheck: true,
        provider_workflow_ref_hash: 'safe_ref_hash',
        provider_read_at: '2026-07-28T00:00:00.000Z',
      },
      approvalSnapshot(),
    );
    expect(comparison.ready).toBe(false);
    expect(comparison.drift).toEqual(['content_digest']);
    expect(comparison.approval_id).toBe('approval_1');
    expect(comparison.provider_effects).toBe(0);
    expect(() =>
      compareCoreWorkflowReadback(
        definition,
        {
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
        },
        approvalSnapshot({ approved_copy: false }),
      ),
    ).toThrow('approved_copy_required');
  });

  it('uses the four P31 canonical copy identifiers without inventing replacements', () => {
    expect(CORE_WORKFLOW_BY_KEY['OT-02A'].approved_copy_ids).toEqual([
      'ghl.legacy_member_migration.step_1.v1',
    ]);
    expect(CORE_WORKFLOW_BY_KEY['OT-08'].approved_copy_ids).toEqual([
      'ghl.parent_portal_activated.v1',
    ]);
    expect(CORE_WORKFLOW_BY_KEY['OT-09'].approved_copy_ids).toEqual([
      'ghl.parent_class_reminder.v1',
    ]);
    expect(CORE_WORKFLOW_BY_KEY['OT-10'].approved_copy_ids).toEqual([
      'ghl.parent_recording_available.v1',
    ]);
  });
});
