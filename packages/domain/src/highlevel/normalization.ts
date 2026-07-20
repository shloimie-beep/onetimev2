import { createHash } from 'node:crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { HighLevelContactIdentity } from '../../../contracts/src/highlevel/index.ts';

export function normalizeHighLevelEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

export function normalizeHighLevelPhone(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const phone = parsePhoneNumberFromString(raw, 'IL');
  if (phone?.isValid()) return phone.number;
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

export type MatchDecision =
  | { disposition: 'no_identity' }
  | { disposition: 'match_email'; contactId: string }
  | { disposition: 'match_phone'; contactId: string }
  | { disposition: 'sync_conflict'; emailContactId: string; phoneContactId: string };

export function decideHighLevelContactMatch(input: {
  identity: HighLevelContactIdentity;
  byEmail?: { id: string } | null | undefined;
  byPhone?: { id: string } | null | undefined;
}): MatchDecision {
  const email = normalizeHighLevelEmail(input.identity.email);
  const phone = normalizeHighLevelPhone(input.identity.phone);
  if (!email && !phone) return { disposition: 'no_identity' };
  if (input.byEmail && input.byPhone && input.byEmail.id !== input.byPhone.id) {
    return {
      disposition: 'sync_conflict',
      emailContactId: input.byEmail.id,
      phoneContactId: input.byPhone.id,
    };
  }
  if (input.byEmail) return { disposition: 'match_email', contactId: input.byEmail.id };
  if (input.byPhone) return { disposition: 'match_phone', contactId: input.byPhone.id };
  return { disposition: 'no_identity' };
}

export function assertNoStudentPayload(input: {
  studentKeys?: readonly string[] | undefined;
  studentEmail?: string | null | undefined;
}) {
  if ((input.studentKeys?.length ?? 0) > 0 || normalizeHighLevelEmail(input.studentEmail)) {
    throw new Error('Students must never enter HighLevel.');
  }
}

export function stableDigest(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(',')}}`;
}
