import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CORE_WORKFLOW_BY_KEY,
  CORE_WORKFLOW_DEFINITIONS,
  CORE_WORKFLOW_KEYS,
  CORE_WORKFLOW_REQUIREMENTS,
  compareCoreWorkflowReadback,
  planCoreWorkflowEvent,
  validateCoreWorkflowDefinitions,
  type CoreWorkflowKey,
  type PlanCoreWorkflowInput,
} from './index.ts';

const { load } = createRequire(import.meta.url)('js-yaml') as {
  load(source: string): unknown;
};

function planInput(workflow_key: CoreWorkflowKey): PlanCoreWorkflowInput {
  const definition = CORE_WORKFLOW_BY_KEY[workflow_key];
  return {
    workflow_key,
    subject: { kind: 'adult', adult_id: 'adult_1', household_id: 'household_1' },
    evidence: {
      trigger: definition.trigger,
      source_event_id: `event_${workflow_key}`,
      source_event_digest: 'event_digest',
      household_id: 'household_1',
      episode_key: 'episode_1',
      local_commit_readback: true,
      signed_billing_projection: definition.requires_signed_billing_projection,
      approved_audience: true,
      approved_copy: true,
    },
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
      evidence_digest: 'suppression_digest',
    },
    reminder_preference: 'email',
    marketing_permission: true,
    content_digest: 'content_digest',
    audience_digest: 'audience_digest',
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
    '$requirement_id plans $workflow_key without financial, access, Student, or WhatsApp effects',
    (definition) => {
      const plan = planCoreWorkflowEvent(planInput(definition.workflow_key));
      expect(definition.requirement_id).toBe(CORE_WORKFLOW_REQUIREMENTS[definition.workflow_key]);
      expect(plan.workflow_key).toBe(definition.workflow_key);
      expect(plan.ordered_steps).toEqual(definition.ordered_steps);
      expect(plan.waits).toEqual(definition.waits);
      expect(plan.exit_conditions).toEqual(definition.exit_conditions);
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

  it('mirrors all twelve domain definitions in the owned HighLevel fragment', () => {
    const fragmentPath = fileURLToPath(
      new URL(
        '../../../../../../integrations/highlevel/v21/workflow-fragments/P29-core-lifecycle.yaml',
        import.meta.url,
      ),
    );
    const fragment = load(readFileSync(fragmentPath, 'utf8')) as {
      owner_task: string;
      effect_policy: Record<string, number | string>;
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
    for (const definition of CORE_WORKFLOW_DEFINITIONS) {
      expect(fragment.workflows).toContainEqual(
        expect.objectContaining({
          workflow_key: definition.workflow_key,
          requirement_id: definition.requirement_id,
          canonical_name: definition.canonical_name,
          trigger: definition.trigger,
          ordered_steps: [...definition.ordered_steps],
          waits: [...definition.waits],
          policy_constants: [...definition.policy_constants],
          exit_conditions: [...definition.exit_conditions],
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

  it('enforces exact OT-02A approvals and OT-02B explicit opt-in', () => {
    const migration = planInput('OT-02A');
    migration.evidence.approved_copy = false;
    expect(() => planCoreWorkflowEvent(migration)).toThrow(
      'migration_audience_and_copy_approval_required',
    );

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

  it('pins the exact signup cutover and dated migration audience', () => {
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

  it('reports exact saved/readback drift without causing provider effects', () => {
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
        content_digest: 'drifted',
        audience_digest: 'audience_digest',
        requires_send_time_suppression_recheck: true,
        provider_workflow_ref_hash: 'safe_ref_hash',
        provider_read_at: '2026-07-28T00:00:00.000Z',
      },
      { content_digest: 'content_digest', audience_digest: 'audience_digest' },
    );
    expect(comparison.ready).toBe(false);
    expect(comparison.drift).toEqual(['content_digest']);
    expect(comparison.provider_effects).toBe(0);
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
