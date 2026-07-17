import { DELIVERY_EVENT_TYPES } from '../../../contracts/src/delivery/types.ts';

export const DAY_ONE_COMMUNICATIONS_CATALOG_VERSION = 'ot80-server-owned-v1';
export const DAY_ONE_COMMUNICATIONS_SOURCE = {
  archive_sha256: 'ba1ffe027c4f89e93133fdb3a1a4511b971e52d4441b06b758022cbd1876440d',
  message_catalog_sha256: '865f04e7fd8d5842376485481804fb9d21595797fd9f40e8b5aa45424ae3a88a',
  source_package_version: '1.0.0',
} as const;

export const DAY_ONE_MESSAGE_KEYS = [
  'family.signup.success_page',
  'family.ack.email',
  'family.ack.whatsapp',
  'class.reminder.t30.email',
  'class.reminder.t30.whatsapp',
  'school.signup.public_ack',
  'owner.alert.family_lead',
  'owner.alert.school_lead',
  'account.parent.invitation',
  'account.student_access_ready.parent_notice',
  'security.password_reset.request',
  'security.password_reset.completed',
  'security.privileged_mfa_recovery.completed',
  'login.member.holding_page',
  'support.ticket.opened',
  'support.ticket.updated',
  'support.ticket.resolved',
  'communications.secure_access_delayed',
  'communications.message_not_sent.operator_status',
] as const;

export type DayOneMessageKey = (typeof DAY_ONE_MESSAGE_KEYS)[number];

export const ACTIVE_DELIVERY_MESSAGE_KEYS = [
  'family.ack.email',
  'family.ack.whatsapp',
  'class.reminder.t30.email',
  'class.reminder.t30.whatsapp',
  'owner.alert.family_lead',
  'owner.alert.school_lead',
] as const satisfies readonly DayOneMessageKey[];

export type ActiveDeliveryMessageKey = (typeof ACTIVE_DELIVERY_MESSAGE_KEYS)[number];

export const DAY_ONE_COMMUNICATIONS_CATALOG = {
  schema_version: 'onetime.day_one_communications_catalog.v1',
  catalog_version: DAY_ONE_COMMUNICATIONS_CATALOG_VERSION,
  source: DAY_ONE_COMMUNICATIONS_SOURCE,
  sender_brand: 'One Time Mishnayos',
  transition_domain: 'join.onetimeonetime.com',
  timezone: 'Asia/Jerusalem',
  external_time_label: 'Israel time',
  sms_enabled: false,
  telegram_catalog_enabled: false,
  message_keys: DAY_ONE_MESSAGE_KEYS,
  active_delivery_message_keys: ACTIVE_DELIVERY_MESSAGE_KEYS,
} as const;

export function messageKeyForDeliveryEvent(
  eventType: string,
  classification: 'family' | 'school',
): ActiveDeliveryMessageKey | null {
  if (eventType === DELIVERY_EVENT_TYPES.familySignupEmailAck) return 'family.ack.email';
  if (eventType === DELIVERY_EVENT_TYPES.familySignupWhatsAppConfirmation) {
    return 'family.ack.whatsapp';
  }
  if (eventType === DELIVERY_EVENT_TYPES.familyClassReminderEmail) {
    return 'class.reminder.t30.email';
  }
  if (eventType === DELIVERY_EVENT_TYPES.familyClassReminderWhatsApp) {
    return 'class.reminder.t30.whatsapp';
  }
  if (eventType === DELIVERY_EVENT_TYPES.internalLeadAlert) {
    return classification === 'school' ? 'owner.alert.school_lead' : 'owner.alert.family_lead';
  }
  return null;
}

export function deliveryEventRequiresProtectedLink(eventType: string): boolean {
  return (
    eventType === DELIVERY_EVENT_TYPES.familyClassReminderEmail ||
    eventType === DELIVERY_EVENT_TYPES.familyClassReminderWhatsApp
  );
}

export function protectedAppUrlFromPayload(
  payload: Readonly<Record<string, unknown>>,
): string | null {
  const raw =
    stringValue(payload.protected_join_url) ??
    stringValue(payload.protectedJoinUrl) ??
    stringValue(payload.protected_class_url) ??
    stringValue(payload.protectedClassUrl);
  if (!raw) return null;
  const value = raw.trim();
  if (!value || /zoom|vimeo|drive|stripe|checkout|token|secret/i.test(value)) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.hostname !== DAY_ONE_COMMUNICATIONS_CATALOG.transition_domain) return null;
    if (parsed.search || parsed.hash) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function firstNameFromDisplayName(displayName: string | undefined): string | null {
  const first = displayName?.trim().split(/\s+/)[0] ?? '';
  return first ? first : null;
}

export function renderParagraphHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : ''))
    .join('');
}

export function formatIsraelDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DAY_ONE_COMMUNICATIONS_CATALOG.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

export function escapeHtml(value: string): string {
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

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
