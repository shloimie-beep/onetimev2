import type {
  ClaimedDelivery,
  DeliveryRequest,
  DeliveryTag,
} from '../../../contracts/src/delivery/types.ts';
import type { DeliveryEligibility } from './eligibility.ts';

export type DeliveryMessageConfig = {
  emailFrom: string;
  emailReplyTo?: string;
  protectedOwnerEmail?: string;
};

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

function isSchoolClaim(claim: ClaimedDelivery): boolean {
  return classificationLabel(claim) === 'School';
}

function familyAcknowledgementText(): string {
  return [
    'We received your One Time Mishnayos signup for the free class.',
    '',
    'Our team will follow up with the next details through the preference and consent saved with your signup.',
  ].join('\n');
}

function familyAcknowledgementHtml(): string {
  return [
    '<p><strong>We received your One Time Mishnayos signup for the free class.</strong></p>',
    '<p>Our team will follow up with the next details through the preference and consent saved with your signup.</p>',
  ].join('');
}

function schoolAcknowledgementText(): string {
  return [
    'We received your One Time Mishnayos inquiry.',
    'Our team will review the details and follow up.',
  ].join('\n');
}

function schoolAcknowledgementHtml(): string {
  return schoolAcknowledgementText()
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
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
      tags: emailTags(claim, claim.eventType),
    };
  }

  const school = isSchoolClaim(claim);

  if (eligibility.channel === 'whatsapp') {
    const text = school ? schoolAcknowledgementText() : familyAcknowledgementText();
    return {
      channel: 'whatsapp',
      provider: 'one_time_wapi',
      recipientClass: 'public',
      idempotencyKey: claim.deliveryKey,
      to: eligibility.to,
      text,
      noLinkPreview: true,
    };
  }

  if (school) {
    const text = schoolAcknowledgementText();
    return {
      channel: 'email',
      provider: 'resend',
      recipientClass: 'public',
      idempotencyKey: claim.deliveryKey,
      from: config.emailFrom,
      to: eligibility.to,
      ...(config.emailReplyTo ? { replyTo: config.emailReplyTo } : {}),
      subject: 'We received your One Time Mishnayos inquiry',
      text,
      html: schoolAcknowledgementHtml(),
      tags: emailTags(claim, claim.eventType),
    };
  }

  const text = familyAcknowledgementText();
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
    html: familyAcknowledgementHtml(),
    tags: emailTags(claim, claim.eventType),
  };
}
