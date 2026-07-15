import type {
  ClaimedDelivery,
  DeliveryRequest,
  DeliveryTag,
} from '../../../contracts/src/delivery/types.ts';
import {
  DAY_ONE_COMMUNICATIONS_CATALOG_VERSION,
  escapeHtml,
  firstNameFromDisplayName,
  formatIsraelDateTime,
  messageKeyForDeliveryEvent,
  protectedAppUrlFromPayload,
  renderParagraphHtml,
  type ActiveDeliveryMessageKey,
} from './catalog.ts';
import type { DeliveryEligibility } from './eligibility.ts';

export type DeliveryMessageConfig = {
  emailFrom: string;
  emailReplyTo?: string;
  protectedOwnerEmail?: string;
};

type RenderedDeliveryCopy = {
  messageKey: ActiveDeliveryMessageKey;
  subject: string;
  text: string;
  html: string;
};

function classificationLabel(claim: ClaimedDelivery): 'Family' | 'School' {
  const classification = claim.signup?.classification ?? claim.contact?.familySchoolClassification;
  return classification === 'school' ? 'School' : 'Family';
}

function classificationKey(claim: ClaimedDelivery): 'family' | 'school' {
  return classificationLabel(claim).toLowerCase() as 'family' | 'school';
}

function emailTags(
  claim: ClaimedDelivery,
  messageKey: ActiveDeliveryMessageKey,
): readonly DeliveryTag[] {
  return [
    { name: 'message_key', value: messageKey },
    { name: 'catalog_version', value: DAY_ONE_COMMUNICATIONS_CATALOG_VERSION },
    { name: 'classification', value: classificationKey(claim) },
  ];
}

function familyEmailCopy(firstName: string | null): RenderedDeliveryCopy {
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const text = [
    greeting,
    '',
    'Thank you for signing up for One Time One Time with Rabbi Eli Scheller. Your Family signup has been saved.',
    '',
    'This message confirms receipt only. Class access and member login details will be sent separately when they are ready.',
    '',
    '- One Time One Time',
  ].join('\n');
  return {
    messageKey: 'family.ack.email',
    subject: 'We received your Family signup',
    text,
    html: renderParagraphHtml(text),
  };
}

function familyWhatsAppCopy(firstName: string | null): RenderedDeliveryCopy {
  const greeting = firstName ? `Hi ${firstName}` : 'Hello';
  const text = `${greeting} - we received your Family signup for One Time One Time with Rabbi Eli Scheller. This confirms receipt only. Class access and member login details are sent separately when ready.`;
  return {
    messageKey: 'family.ack.whatsapp',
    subject: '',
    text,
    html: renderParagraphHtml(text),
  };
}

function classReminderCopy(claim: ClaimedDelivery): RenderedDeliveryCopy {
  const protectedUrl = protectedAppUrlFromPayload(claim.payload);
  if (!protectedUrl) {
    throw new Error('Protected class URL is required before rendering a class reminder.');
  }
  const firstName = firstNameFromDisplayName(claim.contact?.displayName);
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const text =
    claim.channel === 'whatsapp'
      ? [
          "Reminder: tonight's live class with Rabbi Eli Scheller starts at 7:00 p.m. Israel time.",
          `Open the secure class page: ${protectedUrl}`,
          'Please do not forward the link.',
        ].join('\n')
      : [
          greeting,
          '',
          "Tonight's live class with Rabbi Eli Scheller starts at 7:00 p.m. Israel time.",
          'Use the secure link below to open the class page. Please do not forward the link.',
          '',
          protectedUrl,
          '',
          '- One Time One Time',
        ].join('\n');
  const messageKey =
    claim.channel === 'whatsapp' ? 'class.reminder.t30.whatsapp' : 'class.reminder.t30.email';
  return {
    messageKey,
    subject: claim.channel === 'whatsapp' ? '' : 'Live class starts at 7:00 p.m. Israel time',
    text,
    html: `${renderParagraphHtml(text)}<p><a href="${escapeHtml(protectedUrl)}">Open secure class page</a></p>`,
  };
}

function internalAlertCopy(claim: ClaimedDelivery): RenderedDeliveryCopy {
  const classification = classificationLabel(claim);
  const submittedAt = formatIsraelDateTime(claim.createdAt);
  const text = [
    `A new ${classification} lead was committed successfully.`,
    '',
    `Reference: ${claim.signupKey ?? 'unavailable'}`,
    `Received: ${submittedAt}`,
    '',
    'Review the record in the protected One Time application.',
  ].join('\n');
  return {
    messageKey: classification === 'School' ? 'owner.alert.school_lead' : 'owner.alert.family_lead',
    subject: `New ${classification} lead received`,
    text,
    html: renderParagraphHtml(text),
  };
}

function renderDeliveryCopy(claim: ClaimedDelivery): RenderedDeliveryCopy {
  const messageKey = messageKeyForDeliveryEvent(claim.eventType, classificationKey(claim));
  if (!messageKey) throw new Error(`Unsupported delivery event type: ${claim.eventType}`);
  if (messageKey === 'family.ack.email') {
    return familyEmailCopy(firstNameFromDisplayName(claim.contact?.displayName));
  }
  if (messageKey === 'family.ack.whatsapp') {
    return familyWhatsAppCopy(firstNameFromDisplayName(claim.contact?.displayName));
  }
  if (messageKey === 'class.reminder.t30.email' || messageKey === 'class.reminder.t30.whatsapp') {
    return classReminderCopy(claim);
  }
  return internalAlertCopy(claim);
}

export function buildDeliveryRequest(
  claim: ClaimedDelivery,
  eligibility: Extract<DeliveryEligibility, { kind: 'eligible' }>,
  config: DeliveryMessageConfig,
): DeliveryRequest {
  const copy = renderDeliveryCopy(claim);
  if (eligibility.channel === 'whatsapp') {
    return {
      channel: 'whatsapp',
      provider: 'one_time_wapi',
      recipientClass: 'public',
      idempotencyKey: claim.deliveryKey,
      to: eligibility.to,
      text: copy.text,
      noLinkPreview: true,
    };
  }
  return {
    channel: eligibility.channel,
    provider: 'resend',
    recipientClass: eligibility.recipientClass,
    idempotencyKey: claim.deliveryKey,
    from: config.emailFrom,
    to: eligibility.to,
    ...(config.emailReplyTo ? { replyTo: config.emailReplyTo } : {}),
    subject: copy.subject,
    text: copy.text,
    html: copy.html,
    tags: emailTags(claim, copy.messageKey),
  };
}
