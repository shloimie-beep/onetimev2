import type {
  ClaimedDelivery,
  DeliveryRequest,
  DeliveryTag,
} from '../../../contracts/src/delivery/types.ts';
import { providerError } from '../../../contracts/src/delivery/errors.ts';
import type { DeliveryEligibility } from './eligibility.ts';

export type DeliveryMessageConfig = {
  emailFrom: string;
  emailReplyTo?: string;
  protectedOwnerEmail?: string;
  currentClassLink?: string;
};

function requireHttpsClassLink(value: string | undefined): string {
  const candidate = value?.trim() ?? '';
  try {
    const url = new URL(candidate);
    if (url.protocol === 'https:') return url.toString();
  } catch {
    // Converted to a retryable, redacted configuration failure below.
  }
  throw providerError('protected_class_link_unavailable', {
    retryable: true,
    provider: 'worker',
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const encoded: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return encoded[character] ?? character;
  });
}

function classificationLabel(claim: ClaimedDelivery): string {
  const classification = claim.signup?.classification ?? claim.contact?.familySchoolClassification;
  return classification === 'school' ? 'School' : 'Family';
}

function publicConfirmationText(classLink: string): string {
  return [
    "You're signed up for One Time Mishnayos.",
    '',
    `Current class details: ${classLink}`,
    '',
    'This is a one-time transactional confirmation. Reminder delivery follows the preference and consent saved with your signup.',
  ].join('\n');
}

function publicConfirmationHtml(classLink: string): string {
  const link = escapeHtml(classLink);
  return [
    "<p><strong>You're signed up for One Time Mishnayos.</strong></p>",
    `<p><a href="${link}">Open the current class details</a></p>`,
    '<p>This is a one-time transactional confirmation. Reminder delivery follows the preference and consent saved with your signup.</p>',
  ].join('');
}

function emailTags(claim: ClaimedDelivery, messageType: string): readonly DeliveryTag[] {
  return [
    { name: 'message_type', value: messageType },
    { name: 'classification', value: classificationLabel(claim).toLowerCase() },
  ];
}

export function buildDeliveryRequest(
  claim: ClaimedDelivery,
  eligibility: Extract<DeliveryEligibility, { kind: 'eligible' }>,
  config: DeliveryMessageConfig,
): DeliveryRequest {
  if (eligibility.channel === 'internal_email') {
    const text = [
      'A new One Time Mishnayos signup was captured.',
      `Classification: ${classificationLabel(claim)}`,
      `Contact reference: ${claim.contactKey ?? 'unavailable'}`,
      `Signup reference: ${claim.signupKey ?? 'unavailable'}`,
      'Review the record in the protected One Time application.',
    ].join('\n');
    const html = text
      .split('\n')
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('');
    return {
      channel: 'internal_email',
      provider: 'resend',
      recipientClass: 'internal_owner',
      idempotencyKey: claim.deliveryKey,
      from: config.emailFrom,
      to: eligibility.to,
      ...(config.emailReplyTo ? { replyTo: config.emailReplyTo } : {}),
      subject: 'New One Time Mishnayos signup',
      text,
      html,
      tags: emailTags(claim, 'internal_lead_alert'),
    };
  }

  const classLink = requireHttpsClassLink(config.currentClassLink);
  const text = publicConfirmationText(classLink);

  if (eligibility.channel === 'whatsapp') {
    return {
      channel: 'whatsapp',
      provider: 'one_time_wapi',
      recipientClass: 'public',
      idempotencyKey: claim.deliveryKey,
      to: eligibility.to,
      text,
      noLinkPreview: false,
    };
  }

  return {
    channel: 'email',
    provider: 'resend',
    recipientClass: 'public',
    idempotencyKey: claim.deliveryKey,
    from: config.emailFrom,
    to: eligibility.to,
    ...(config.emailReplyTo ? { replyTo: config.emailReplyTo } : {}),
    subject: "You're signed up for One Time Mishnayos",
    text,
    html: publicConfirmationHtml(classLink),
    tags: emailTags(claim, 'signup_confirmation'),
  };
}
