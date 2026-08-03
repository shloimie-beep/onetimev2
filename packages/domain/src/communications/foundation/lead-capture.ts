import type {
  WebsiteLeadCaptureInput,
  WebsiteLeadCapturePlan,
} from '../../../../contracts/src/communications/foundation/index.ts';
import { assertAdultSubject } from './preference.ts';

export function planWebsiteLeadCapture(input: WebsiteLeadCaptureInput): WebsiteLeadCapturePlan {
  assertAdultSubject(input.subject);
  const next_action = !input.public_knowledge_answered
    ? 'adult_support_escalation'
    : input.lead_kind === 'family'
      ? 'offer_family_signup'
      : 'record_school_inquiry';
  return {
    operation_id: input.operation_id,
    adult_id: input.subject.adult_id,
    source: 'public_website',
    assistant_identity: 'One Time website assistant',
    lead_kind: input.lead_kind,
    next_action,
    creates_student: false,
    qualifies_via_whatsapp: false,
    grants_access: false,
    promises_school_pricing: false,
    transcript_ref_hash: input.transcript_ref_hash,
  };
}
