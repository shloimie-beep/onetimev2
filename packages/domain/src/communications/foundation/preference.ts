import type {
  CommunicationPurpose,
  CommunicationSubject,
  EmailChannelDecision,
  PlanCommunicationChannelsInput,
  ReminderPreference,
} from '../../../../contracts/src/communications/foundation/index.ts';
import { REMINDER_PREFERENCES } from '../../../../contracts/src/communications/foundation/index.ts';
import { CommunicationFoundationError } from './errors.ts';

export function parseReminderPreference(value: string): ReminderPreference {
  if (!REMINDER_PREFERENCES.some((candidate) => candidate === value)) {
    throw new CommunicationFoundationError('invalid_reminder_preference');
  }
  return value as ReminderPreference;
}

export function assertAdultSubject(
  subject: CommunicationSubject,
): asserts subject is Extract<CommunicationSubject, { kind: 'adult' }> {
  if (subject.kind === 'student') {
    throw new CommunicationFoundationError('student_contact_prohibited');
  }
}

export function planCommunicationChannels(input: PlanCommunicationChannelsInput) {
  assertAdultSubject(input.subject);
  const preference = parseReminderPreference(input.reminder_preference);
  const email = evaluateEmail(
    input.purpose,
    preference,
    input.marketing_permission,
    input.suppression,
  );
  const whatsappRequested = preference === 'whatsapp' || preference === 'both';
  const whatsapp =
    input.purpose === 'optional_reminder' && whatsappRequested
      ? ({
          disposition: 'channel_skipped_not_configured',
          provider_calls: 0,
          truthful_status: 'WhatsApp is unavailable; email remains active',
        } as const)
      : preference === 'none' && input.purpose === 'optional_reminder'
        ? ({ disposition: 'disabled_by_preference', provider_calls: 0 } as const)
        : ({ disposition: 'not_requested', provider_calls: 0 } as const);

  return {
    operation_id: input.operation_id,
    adult_id: input.subject.adult_id,
    purpose: input.purpose,
    reminder_preference: preference,
    email,
    whatsapp,
    essential_email_cannot_be_disabled:
      input.purpose === 'requested_security' || input.purpose === 'essential_billing_access',
    whatsapp_provider_calls: 0,
  } as const;
}

function evaluateEmail(
  purpose: CommunicationPurpose,
  preference: ReminderPreference,
  marketingPermission: boolean,
  suppression: PlanCommunicationChannelsInput['suppression'],
): EmailChannelDecision {
  if (suppression.invalid_address) return suppressed('invalid_address');
  if (suppression.hard_bounce) return suppressed('hard_bounce');

  if (purpose === 'requested_security' || purpose === 'essential_billing_access') {
    return send('Resend');
  }
  if (purpose === 'optional_reminder' && preference === 'none') {
    return suppressed('preference_none');
  }
  if (suppression.complaint) return suppressed('complaint');
  if (suppression.email_dnd) return suppressed('email_dnd');
  if (suppression.unsubscribed) return suppressed('unsubscribed');
  if (purpose === 'optional_reminder' && suppression.optional_reminder_suppressed) {
    return suppressed('optional_reminder_suppressed');
  }
  if (purpose === 'marketing' && (!marketingPermission || suppression.marketing_suppressed)) {
    return suppressed('marketing_suppressed');
  }
  return send('GHL');
}

function send(provider: 'GHL' | 'Resend'): EmailChannelDecision {
  return { disposition: 'send', provider, suppression_recheck_required: true };
}

function suppressed(
  reason: Extract<EmailChannelDecision, { disposition: 'suppressed' }>['reason'],
) {
  return { disposition: 'suppressed', reason, suppression_recheck_required: true } as const;
}
