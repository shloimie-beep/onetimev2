import {
  DELIVERY_EVENT_TYPES,
  SUPPORTED_DELIVERY_EVENT_CHANNEL_PAIRS,
  type ClaimedDelivery,
  type DeliveryTerminalReason,
  type EmailDeliveryRequest,
  type WhatsAppDeliveryRequest,
} from '../../../contracts/src/delivery/types.ts';

type PublicDestination =
  | {
      kind: 'eligible';
      recipientClass: 'public';
      to: string;
    }
  | {
      kind: 'suppressed';
      reason: 'contact_suppressed';
    }
  | {
      kind: 'skipped';
      reason: DeliveryTerminalReason;
    };

type InternalDestination =
  | {
      kind: 'eligible';
      recipientClass: 'internal_owner';
      to: string;
    }
  | {
      kind: 'skipped';
      reason: 'protected_owner_destination_missing' | 'unsupported_event_type';
    };

export type DeliveryEligibility =
  | (PublicDestination & { channel: 'email' | 'whatsapp' })
  | (InternalDestination & { channel: 'internal_email' });

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export function supportedChannelForEvent(eventType: string): ClaimedDelivery['channel'] | null {
  return (
    SUPPORTED_DELIVERY_EVENT_CHANNEL_PAIRS.find((pair) => pair.eventType === eventType)?.channel ??
    null
  );
}

function expectedPublicEventForSignup(claim: ClaimedDelivery): string | null {
  const classification = claim.signup?.classification;
  if (!classification || claim.channel === 'internal_email') return null;
  if (classification === 'school') {
    return claim.channel === 'whatsapp'
      ? DELIVERY_EVENT_TYPES.schoolSignupWhatsAppReceipt
      : DELIVERY_EVENT_TYPES.schoolSignupEmailAck;
  }
  return claim.channel === 'whatsapp'
    ? DELIVERY_EVENT_TYPES.familySignupWhatsAppConfirmation
    : DELIVERY_EVENT_TYPES.familySignupEmailAck;
}

export function evaluateDeliveryEligibility(
  claim: ClaimedDelivery,
  protectedOwnerEmail: string | undefined,
): DeliveryEligibility {
  const expectedChannel = supportedChannelForEvent(claim.eventType);
  if (!expectedChannel || expectedChannel !== claim.channel || claim.transportMode !== 'sink') {
    return {
      kind: 'skipped',
      channel: claim.channel,
      reason: 'unsupported_event_type',
    } as DeliveryEligibility;
  }

  if (claim.channel === 'internal_email') {
    const destination = protectedOwnerEmail?.trim().toLowerCase();
    if (!destination || !EMAIL_PATTERN.test(destination)) {
      return {
        kind: 'skipped',
        channel: 'internal_email',
        reason: 'protected_owner_destination_missing',
      };
    }
    return {
      kind: 'eligible',
      channel: 'internal_email',
      recipientClass: 'internal_owner',
      to: destination,
    };
  }

  const contact = claim.contact;
  if (!contact) {
    return {
      kind: 'skipped',
      channel: claim.channel,
      reason: 'contact_missing',
    };
  }

  if (!claim.signup) {
    return {
      kind: 'skipped',
      channel: claim.channel,
      reason: 'signup_missing',
    };
  }

  if (claim.signup.status !== 'new') {
    return {
      kind: 'skipped',
      channel: claim.channel,
      reason: 'signup_not_committed',
    };
  }

  const expectedPublicEvent = expectedPublicEventForSignup(claim);
  if (expectedPublicEvent && expectedPublicEvent !== claim.eventType) {
    return {
      kind: 'skipped',
      channel: claim.channel,
      reason: 'unsupported_event_type',
    };
  }

  if (contact.leadStatus === 'archived' || contact.archivedAt) {
    return {
      kind: 'skipped',
      channel: claim.channel,
      reason: 'contact_archived',
    };
  }

  if (contact.suppressionState !== 'active') {
    return {
      kind: 'suppressed',
      channel: claim.channel,
      reason: 'contact_suppressed',
    };
  }

  if (claim.channel === 'email') {
    const email = contact.emailNormalized.trim().toLowerCase();
    if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return {
        kind: 'skipped',
        channel: 'email',
        reason: 'email_missing_or_invalid',
      };
    }
    return {
      kind: 'eligible',
      channel: 'email',
      recipientClass: 'public',
      to: email,
    };
  }

  if (contact.reminderPreference !== 'whatsapp' && contact.reminderPreference !== 'both') {
    return {
      kind: 'skipped',
      channel: 'whatsapp',
      reason: 'whatsapp_preference_not_selected',
    };
  }
  if (!contact.consentRecordedAt) {
    return {
      kind: 'skipped',
      channel: 'whatsapp',
      reason: 'whatsapp_consent_missing',
    };
  }
  const phone = contact.phoneNormalized?.trim() ?? '';
  if (!E164_PATTERN.test(phone)) {
    return {
      kind: 'skipped',
      channel: 'whatsapp',
      reason: 'whatsapp_phone_missing_or_invalid',
    };
  }
  return {
    kind: 'eligible',
    channel: 'whatsapp',
    recipientClass: 'public',
    to: phone,
  };
}

export function isEmailRequest(
  request: EmailDeliveryRequest | WhatsAppDeliveryRequest,
): request is EmailDeliveryRequest {
  return request.channel === 'email' || request.channel === 'internal_email';
}
