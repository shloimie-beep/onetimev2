import { describe, expect, it, vi } from 'vitest';
import type {
  CommunicationSuppressionSnapshot,
  CommunicationsWorkflowReadback,
  CommunicationWorkflowFragment,
  ReminderPreference,
} from '../../../../contracts/src/communications/foundation/index.ts';
import { COMMUNICATION_SENDER_PROFILES } from '../../../../contracts/src/communications/foundation/index.ts';
import {
  assertCanonicalWorkflowIdentity,
  buildCommunicationsReview,
  CommunicationFoundationError,
  parseReminderPreference,
  planCommunicationChannels,
  planGovernedWorkflowRequest,
  planWebsiteLeadCapture,
  validateWorkflowFragment,
} from './index.ts';

const h = (value: string) => value.repeat(64).slice(0, 64);
const suppression = (
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

const plan = (
  preference: ReminderPreference,
  purpose:
    | 'requested_security'
    | 'essential_billing_access'
    | 'optional_reminder'
    | 'marketing' = 'optional_reminder',
  snapshot = suppression(),
) =>
  planCommunicationChannels({
    operation_id: 'message-1',
    subject: { kind: 'adult', adult_id: 'adult-1', household_id: 'household-1' },
    purpose,
    reminder_preference: preference,
    marketing_permission: true,
    suppression: snapshot,
  });

function readback(): CommunicationsWorkflowReadback {
  return {
    workflow_key: 'OT-14',
    canonical_name: 'OT-14 Parent Newsletter',
    provider_workflow_ref_hash: h('b'),
    audience_count: 10,
    eligible_count: 6,
    excluded_count: 4,
    suppression_count: 3,
    sender: COMMUNICATION_SENDER_PROFILES.rabbi_campaign,
    rendered_subject: 'This week in One Time Mishnayos',
    rendered_body_digest: h('c'),
    cadence: ['Thursday 12:00 household local time'],
    readiness: 'SAVED_REOPENED',
    delivery: {
      status: 'ready',
      provider_read_at: '2026-07-28T20:00:00Z',
      delivered_count: 0,
      skipped_count: 0,
      safe_evidence_ref: 'ghl-readback-1',
    },
    safe_ghl_url: 'https://app.gohighlevel.com/v2/location/safe/workflows',
    registry_digest: h('d'),
  };
}

describe('P28 communication preference and suppression', () => {
  it.each([
    ['email', 'not_requested'],
    ['whatsapp', 'channel_skipped_not_configured'],
    ['both', 'channel_skipped_not_configured'],
    ['none', 'disabled_by_preference'],
  ] as const)(
    'persists exact preference %s with truthful dormant-WhatsApp state',
    (value, state) => {
      const result = plan(value);
      expect(result.whatsapp.disposition).toBe(state);
      expect(result.whatsapp_provider_calls).toBe(0);
      expect(result.email.disposition).toBe(value === 'none' ? 'suppressed' : 'send');
    },
  );

  it('rejects an invalid fifth preference', () => {
    expect(() => parseReminderPreference('sms')).toThrowError(
      expect.objectContaining({ code: 'invalid_reminder_preference' }),
    );
  });

  it.each([
    ['email_dnd', { email_dnd: true }],
    ['unsubscribed', { unsubscribed: true }],
    ['complaint', { complaint: true }],
    ['hard_bounce', { hard_bounce: true }],
    ['invalid_address', { invalid_address: true }],
    ['optional_reminder_suppressed', { optional_reminder_suppressed: true }],
  ] as const)('enforces %s for an optional send', (reason, state) => {
    expect(plan('email', 'optional_reminder', suppression(state)).email).toMatchObject({
      disposition: 'suppressed',
      reason,
    });
  });

  it('delivers requested security and essential billing/access through Resend despite optional and marketing preferences', () => {
    const marketingState = suppression({
      email_dnd: true,
      unsubscribed: true,
      complaint: true,
      marketing_suppressed: true,
      optional_reminder_suppressed: true,
    });
    for (const purpose of ['requested_security', 'essential_billing_access'] as const) {
      expect(plan('none', purpose, marketingState)).toMatchObject({
        email: { disposition: 'send', provider: 'Resend' },
        essential_email_cannot_be_disabled: true,
      });
    }
    expect(plan('none', 'optional_reminder', marketingState).email.disposition).toBe('suppressed');
    expect(plan('none', 'marketing', marketingState).email.disposition).toBe('suppressed');
  });

  it('still blocks essential email when the address is not deliverable', () => {
    expect(plan('none', 'requested_security', suppression({ hard_bounce: true })).email).toEqual({
      disposition: 'suppressed',
      reason: 'hard_bounce',
      suppression_recheck_required: true,
    });
  });

  it('hard-stops Students before a communication plan exists', () => {
    expect(() =>
      planCommunicationChannels({
        operation_id: 'student-message',
        subject: { kind: 'student', student_id: 'student-1', household_id: 'household-1' },
        purpose: 'optional_reminder',
        reminder_preference: 'email',
        marketing_permission: false,
        suppression: suppression(),
      }),
    ).toThrowError(expect.objectContaining({ code: 'student_contact_prohibited' }));
  });
});

describe('P28 Communications Review boundary', () => {
  it('shows only sanitized readback and governed Start/Pause controls to Admin', () => {
    const result = buildCommunicationsReview('admin', readback);
    expect(result.controls).toEqual(['start', 'pause']);
    expect(result).toMatchObject({
      campaign_authoring_location: 'GHL',
      exposes_campaign_editor: false,
      exposes_test_send: false,
      exposes_seed_send: false,
      exposes_provider_canary: false,
    });
  });

  it.each(['parent', 'student'] as const)('denies %s before loading workflow data', (role) => {
    const load = vi.fn(readback);
    expect(() => buildCommunicationsReview(role, load)).toThrowError(
      expect.objectContaining({ code: 'non_admin_forbidden' }),
    );
    expect(load).not.toHaveBeenCalled();
  });

  it('creates audited requests but refuses success without provider readback', () => {
    const result = planGovernedWorkflowRequest({
      actor_role: 'admin',
      admin_id: 'admin-1',
      request_id: 'request-1',
      requested_at: '2026-07-28T20:01:00Z',
      action: 'start',
      readback: readback(),
    });
    expect(result).toMatchObject({
      action: 'start',
      audited: true,
      direct_provider_mutation: false,
    });

    const unavailable = readback();
    unavailable.delivery = {
      ...unavailable.delivery,
      status: 'unavailable',
      provider_read_at: null,
    };
    expect(() =>
      planGovernedWorkflowRequest({
        actor_role: 'admin',
        admin_id: 'admin-1',
        request_id: 'request-2',
        requested_at: '2026-07-28T20:02:00Z',
        action: 'pause',
        readback: unavailable,
      }),
    ).toThrowError(expect.objectContaining({ code: 'provider_readback_required' }));
  });

  it('rejects a GHL link carrying query or fragment data', () => {
    const unsafe = readback();
    unsafe.safe_ghl_url = 'https://app.gohighlevel.com/workflows?token=secret';
    expect(() => buildCommunicationsReview('admin', () => unsafe)).toThrowError(
      expect.objectContaining({ code: 'unsafe_ghl_url' }),
    );
  });
});

describe('P28 website bot and workflow registry', () => {
  it.each([
    ['family', 'offer_family_signup'],
    ['school', 'record_school_inquiry'],
  ] as const)(
    'captures an adult public website %s lead without access or Student effects',
    (kind, action) => {
      expect(
        planWebsiteLeadCapture({
          operation_id: 'lead-1',
          source: 'public_website',
          subject: { kind: 'adult', adult_id: 'adult-1', household_id: null },
          name: 'Parent Operator',
          normalized_email: 'parent@example.invalid',
          lead_kind: kind,
          timezone: 'Asia/Jerusalem',
          phone: null,
          transcript_ref_hash: h('e'),
          public_knowledge_answered: true,
        }),
      ).toMatchObject({
        source: 'public_website',
        assistant_identity: 'One Time website assistant',
        next_action: action,
        creates_student: false,
        qualifies_via_whatsapp: false,
        grants_access: false,
        promises_school_pricing: false,
      });
    },
  );

  it('keeps OT-11 retired and rejects identifier reuse', () => {
    expect(
      assertCanonicalWorkflowIdentity({
        key: 'OT-11',
        purpose: 'permanently_retired_reserved',
        executable: false,
      }),
    ).toBeTruthy();
    expect(() =>
      assertCanonicalWorkflowIdentity({
        key: 'OT-11',
        purpose: 'whatsapp_lead_qualification',
        executable: true,
      }),
    ).toThrowError(CommunicationFoundationError);
  });

  it('accepts a guarded P29/P30 workflow fragment and rejects a missing suppression gate', () => {
    const fragment: CommunicationWorkflowFragment = {
      contract_version: '1.0.0',
      owner_task: 'P29',
      fragment_id: 'p29-core',
      workflows: [
        {
          workflow_key: 'OT-01',
          canonical_name: 'OT-01',
          purpose: 'adult lifecycle',
          subject: 'adult_only',
          sender_key: 'office',
          message_purpose: 'essential_billing_access',
          trigger: 'verified event',
          ordered_steps: ['recheck suppression', 'send email'],
          exit_conditions: ['complete'],
          idempotency_scope: 'event + adult',
          approval_gates: [
            'registry_identity',
            'sender',
            'audience',
            'consent',
            'copy',
            'suppression',
          ],
          requires_send_time_suppression_recheck: true,
          email_required: true,
          whatsapp_state: 'dormant',
          student_contact_prohibited: true,
        },
      ],
    };
    expect(validateWorkflowFragment(fragment)).toBe(fragment);
    fragment.workflows[0]!.approval_gates = ['registry_identity'];
    expect(() => validateWorkflowFragment(fragment)).toThrowError(
      expect.objectContaining({ code: 'invalid_workflow_fragment' }),
    );
  });

  it('admits only the canonical OT-02A and OT-02B split-key syntax', () => {
    const fragmentFor = (workflowKey: string): CommunicationWorkflowFragment => ({
      contract_version: '1.0.0',
      owner_task: 'P29',
      fragment_id: `p29-${workflowKey}`,
      workflows: [
        {
          workflow_key: workflowKey,
          canonical_name: workflowKey,
          purpose: 'adult lifecycle',
          subject: 'adult_only',
          sender_key: 'rabbi_campaign',
          message_purpose: 'marketing',
          trigger: 'verified event',
          ordered_steps: ['recheck suppression', 'send email'],
          exit_conditions: ['complete'],
          idempotency_scope: 'event + adult',
          approval_gates: [
            'registry_identity',
            'sender',
            'audience',
            'consent',
            'copy',
            'suppression',
          ],
          requires_send_time_suppression_recheck: true,
          email_required: true,
          whatsapp_state: 'dormant',
          student_contact_prohibited: true,
        },
      ],
    });

    for (const key of ['OT-02A', 'OT-02B']) {
      const fragment = fragmentFor(key);
      expect(validateWorkflowFragment(fragment)).toBe(fragment);
    }
    for (const key of ['OT-02C', 'OT-2A', 'OT-02AB', 'OT-17']) {
      expect(() => validateWorkflowFragment(fragmentFor(key))).toThrowError(
        expect.objectContaining({ code: 'invalid_workflow_fragment' }),
      );
    }
  });
});
