import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  AUTH_TOKEN_POLICIES,
  type AuthTokenPurpose,
  type AuthTokenRecord,
} from '../../../contracts/src/identity/auth/index.ts';

export type IssuedAuthToken = {
  raw_token: string;
  record: AuthTokenRecord;
  superseded_token_ids: string[];
};

function tokenHash(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function issueAuthToken(input: {
  subject_id: string;
  purpose: AuthTokenPurpose;
  now: Date;
  prior_records: readonly AuthTokenRecord[];
  random_token?: () => string;
}): IssuedAuthToken {
  const rawToken = input.random_token?.() ?? randomBytes(32).toString('base64url');
  const nowIso = input.now.toISOString();
  const policy = AUTH_TOKEN_POLICIES[input.purpose];
  const supersededTokenIds = input.prior_records
    .filter(
      (record) =>
        record.subject_id === input.subject_id &&
        record.purpose === input.purpose &&
        record.consumed_at === null &&
        record.superseded_at === null,
    )
    .map((record) => record.token_id);
  return {
    raw_token: rawToken,
    record: {
      token_id: `auth_token_${randomUUID()}`,
      subject_id: input.subject_id,
      purpose: input.purpose,
      token_hash: tokenHash(rawToken),
      issued_at: nowIso,
      expires_at: new Date(input.now.getTime() + policy.ttl_ms).toISOString(),
      consumed_at: null,
      superseded_at: null,
    },
    superseded_token_ids: supersededTokenIds,
  };
}

export type ConsumeAuthTokenDecision =
  | { consumed: true; consumed_at: string }
  | { consumed: false; reason: 'invalid' | 'expired' | 'used' | 'superseded' };

export function consumeAuthToken(input: {
  record: AuthTokenRecord | null;
  raw_token: string;
  now: Date;
}): ConsumeAuthTokenDecision {
  const record = input.record;
  if (!record) return { consumed: false, reason: 'invalid' };
  const actual = Buffer.from(tokenHash(input.raw_token), 'hex');
  const expected = Buffer.from(record.token_hash, 'hex');
  if (
    actual.length !== expected.length ||
    expected.length !== 32 ||
    !timingSafeEqual(actual, expected)
  ) {
    return { consumed: false, reason: 'invalid' };
  }
  if (record.consumed_at !== null) return { consumed: false, reason: 'used' };
  if (record.superseded_at !== null) return { consumed: false, reason: 'superseded' };
  if (input.now.getTime() >= new Date(record.expires_at).getTime()) {
    return { consumed: false, reason: 'expired' };
  }
  return { consumed: true, consumed_at: input.now.toISOString() };
}

export function supersedeAuthTokens(
  records: readonly AuthTokenRecord[],
  tokenIds: ReadonlySet<string>,
  now: Date,
): AuthTokenRecord[] {
  const nowIso = now.toISOString();
  return records.map((record) =>
    tokenIds.has(record.token_id) && record.consumed_at === null && record.superseded_at === null
      ? { ...record, superseded_at: nowIso }
      : { ...record },
  );
}
