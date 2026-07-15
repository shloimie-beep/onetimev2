import type {
  ClaimedDelivery,
  DeliveryRequest,
  DeliveryTag,
} from '../../../contracts/src/delivery/types.ts';
import { DELIVERY_EVENT_TYPES } from '../../../contracts/src/delivery/types.ts';
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

function isClassReminderClaim(claim: ClaimedDelivery): boolean {
  return (
    claim.eventType === DELIVERY_EVENT_TYPES.familyClassReminderEmail ||
    claim.eventType === DELIVERY_EVENT_TYPES.familyClassReminderWhatsApp
  );
}

function classReminderStartsAt(claim: ClaimedDelivery): string {
  const raw = claim.payload.starts_at;
  if (typeof raw !== 'string') return 'today at 7:00 p.m. Israel time';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return 'today at 7:00 p.m. Israel time';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(parsed);
}

function familyClassReminderText(claim: ClaimedDelivery): string {
  return [
    `Reminder: the One Time Mishnayos class is ${classReminderStartsAt(claim)}.`,
    '',
    'Open your protected One Time portal for class access when it is available.',
  ].join('\n');
}

function familyClassReminderHtml(claim: ClaimedDelivery): string {
  return familyClassReminderText(claim)
    .split('\n')
    .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : ''))
    .join('');
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
  const classReminder = isClassReminderClaim(claim);

  if (eligibility.channel === 'whatsapp') {
    const text = classReminder
      ? familyClassReminderText(claim)
      : school
        ? schoolAcknowledgementText()
        : familyAcknowledgementText();
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

  if (classReminder) {
    const text = familyClassReminderText(claim);
    return {
      channel: 'email',
      provider: 'resend',
      recipientClass: 'public',
      idempotencyKey: claim.deliveryKey,
      from: config.emailFrom,
      to: eligibility.to,
      ...(config.emailReplyTo ? { replyTo: config.emailReplyTo } : {}),
      subject: 'One Time Mishnayos class reminder',
      text,
      html: familyClassReminderHtml(claim),
      tags: emailTags(claim, claim.eventType),
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
