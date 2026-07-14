import { createHash } from 'node:crypto';
import type { LeadPayload, ReminderPreference } from '../../../contracts/src/index.ts';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string | undefined) {
  const digits = phone?.replace(/\D+/g, '') ?? '';
  if (!digits) return null;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

export function stableKey(prefix: string, parts: string[]) {
  const hash = createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 24);
  return `${prefix}_${hash}`;
}

export function requestHash(payload: LeadPayload) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        contact_name: payload.contact_name.trim(),
        family_or_school: payload.family_or_school.trim(),
        audience_type: payload.audience_type,
        location: payload.location.trim(),
        timezone: payload.timezone,
        email: normalizeEmail(payload.email),
        phone: normalizePhone(payload.phone),
        reminder_preference: payload.reminder_preference,
        reminder_consent: payload.reminder_consent,
      }),
    )
    .digest('hex');
}

export function successCopy(classification: 'family' | 'school') {
  if (classification === 'school') {
    return {
      heading: 'Thank you.',
      body: "We saved your information and we'll be in touch.",
    };
  }
  return {
    heading: "You're signed up.",
    body: 'We saved your information and will send the current class details using your selected option.',
  };
}

export function selectedChannels(preference: ReminderPreference) {
  if (preference === 'both') return ['email', 'whatsapp'] as const;
  if (preference === 'email') return ['email'] as const;
  if (preference === 'whatsapp') return ['whatsapp'] as const;
  return [] as const;
}
