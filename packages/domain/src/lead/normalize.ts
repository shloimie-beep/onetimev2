import { createHash } from 'node:crypto';
import type { LeadPayload, ReminderPreference } from '../../../contracts/src/index.ts';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export class PhoneNormalizationError extends Error {
  constructor() {
    super('Phone number needs an international country code.');
  }
}

export function normalizePhone(phone: string | undefined) {
  const trimmed = phone?.trim() ?? '';
  if (!trimmed) return null;
  const compact = trimmed.replace(/[\s().-]+/g, '');
  const e164 = compact.startsWith('+')
    ? compact
    : compact.startsWith('00')
      ? `+${compact.slice(2)}`
      : null;
  if (!e164 || !/^\+[1-9]\d{7,14}$/.test(e164)) {
    throw new PhoneNormalizationError();
  }
  return e164;
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
        browser_timezone: payload.browser_timezone?.trim() ?? null,
        email: normalizeEmail(payload.email),
        phone: normalizePhone(payload.phone),
        reminder_preference: payload.reminder_preference,
        reminder_consent: payload.reminder_consent,
        attribution: {
          landing_path: payload.attribution.landing_path?.trim() ?? null,
          referrer: payload.attribution.referrer?.trim() ?? null,
          utm_source: payload.attribution.utm_source?.trim() ?? null,
          utm_medium: payload.attribution.utm_medium?.trim() ?? null,
          utm_campaign: payload.attribution.utm_campaign?.trim() ?? null,
          utm_term: payload.attribution.utm_term?.trim() ?? null,
          utm_content: payload.attribution.utm_content?.trim() ?? null,
        },
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
