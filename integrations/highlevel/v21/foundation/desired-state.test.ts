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
      from_email: 'rabbi@onetimeonetime.com',
      reply_to_email: 'info@onetimeonetime.com',
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
});
