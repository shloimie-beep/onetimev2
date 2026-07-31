import { describe, expect, it } from 'vitest';
import { buildCommunicationFoundationDesiredState, FOUNDATION_WORKFLOW_REGISTRY } from './index.ts';

describe('P28 GHL desired-state generation contract', () => {
  it('pins the canonical collision resolution and exact sender identities', () => {
    const state = buildCommunicationFoundationDesiredState();
    expect(FOUNDATION_WORKFLOW_REGISTRY).toMatchObject({
      'OT-11': { purpose: 'permanently_retired_reserved', executable: false },
      'OT-12': { purpose: 'adult_support_intake', executable: true },
      'OT-14': { purpose: 'parent_newsletter', executable: true },
      'OT-15': { purpose: 'former_member_reactivation', executable: true },
      'OT-B01': { purpose: 'public_website_lead_capture', executable: true },
    });
    expect(state.senders.rabbi_campaign).toMatchObject({
      display_name: 'Rabbi Eli Scheller',
      from_email: 'rabbielischeller@onetimeonetime.com',
      reply_to_email: 'rabbielischeller@onetimeonetime.com',
    });
    expect(state.senders.rabbi_personal).toMatchObject({
      display_name: 'Rabbi Eli Scheller',
      from_email: 'rabbielischeller@onetimeonetime.com',
      reply_to_email: 'rabbielischeller@onetimeonetime.com',
    });
    expect(state.senders.office).toMatchObject({
      from_email: 'info@onetimeonetime.com',
      reply_to_email: 'info@onetimeonetime.com',
    });
    expect(state.generation_rules).toMatchObject({
      identifiers_may_be_reused: false,
      student_contacts_allowed: false,
      whatsapp_state: 'dormant',
      email_steps_blocked_by_whatsapp: false,
      suppressed_at_send_time: true,
    });
  });

  it('registers the exact P29 and repository-safe P30 fragments by default', () => {
    const state = buildCommunicationFoundationDesiredState();
    expect(state.workflow_fragments).toHaveLength(2);
    expect(state.workflow_fragments.map((fragment) => fragment.fragment_id)).toEqual([
      'p29-core-lifecycle-v1',
      'P30-campaigns-v1',
    ]);

    const [p29, p30] = state.workflow_fragments;
    expect(p29?.workflows.map((workflow) => workflow.workflow_key)).toEqual([
      'OT-01',
      'OT-02A',
      'OT-02B',
      'OT-03',
      'OT-04',
      'OT-05',
      'OT-06',
      'OT-07',
      'OT-08',
      'OT-09',
      'OT-10',
      'OT-13',
    ]);
    expect(p29?.workflows.find((workflow) => workflow.workflow_key === 'OT-02B')).toMatchObject({
      sender_key: 'rabbi_campaign',
      trigger: 'registered new lead nurture audience entry',
      requires_send_time_suppression_recheck: true,
      student_contact_prohibited: true,
    });
    expect(p29?.workflows.find((workflow) => workflow.workflow_key === 'OT-10')).toMatchObject({
      sender_key: 'brand',
      trigger: 'One Time marks a protected recording available for an entitled household',
    });

    expect(p30?.workflows.map((workflow) => workflow.workflow_key)).toEqual([
      'OT-14',
      'OT-15',
      'OT-16',
    ]);
    expect(p30?.workflows.find((workflow) => workflow.workflow_key === 'OT-15')).toMatchObject({
      sender_key: 'rabbi_campaign',
      approval_gates: expect.arrayContaining(['publication', 'broad_send']),
      whatsapp_state: 'dormant',
    });
    expect(p30?.workflows.find((workflow) => workflow.workflow_key === 'OT-16')).toMatchObject({
      sender_key: 'office',
      idempotency_scope: 'OT-16:adult_id:expiry_at:checkpoint_days',
      student_contact_prohibited: true,
    });

    const allKeys = state.workflow_fragments.flatMap((fragment) =>
      fragment.workflows.map((workflow) => workflow.workflow_key),
    );
    expect(allKeys).toHaveLength(15);
    expect(new Set(allKeys).size).toBe(15);
    expect(() => buildCommunicationFoundationDesiredState([p30!])).toThrow(
      'workflow_fragment_registry_key_conflict',
    );
  });
});
