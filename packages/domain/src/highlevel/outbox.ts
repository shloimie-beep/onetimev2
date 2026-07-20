import type { AppConfig } from '../../../config/src/index.ts';
import type { HighLevelOutboxEventType } from '../../../contracts/src/highlevel/index.ts';
import type { Queryable } from '../../../db/src/index.ts';
import { HIGHLEVEL_TAGS } from './constants.ts';
import { assertNoStudentPayload, stableDigest } from './normalization.ts';

export type HighLevelOutboxIntent = {
  eventKey: string;
  accountKey: string;
  productKey: string;
  eventType: HighLevelOutboxEventType;
  localObjectKey: string;
  payloadDigest: string;
  protectedPayload: Record<string, unknown>;
  idempotencyKey: string;
};

export function buildHighLevelLeadOutboxIntent(input: {
  config: AppConfig;
  contactKey: string;
  signupKey: string;
  email: string | null;
  phone: string | null;
  source: 'website' | 'whatsapp';
  marketing: { emailOptIn: boolean; whatsappOptIn: boolean; suppressed: boolean };
  studentKeys?: readonly string[] | undefined;
}): HighLevelOutboxIntent {
  assertNoStudentPayload({ studentKeys: input.studentKeys });
  const tags = [
    'OT | Lead',
    'OT | Prelaunch',
    input.source === 'website' ? 'OT | Signup Website' : 'OT | Signup WhatsApp',
    ...(input.marketing.emailOptIn ? ['OT | Email Opt-In'] : []),
    ...(input.marketing.whatsappOptIn ? ['OT | WhatsApp Opt-In'] : []),
    ...(input.marketing.suppressed ? ['OT | Marketing Suppressed'] : []),
  ].filter((tag): tag is (typeof HIGHLEVEL_TAGS)[number] =>
    (HIGHLEVEL_TAGS as readonly string[]).includes(tag),
  );
  const protectedPayload = {
    contact_key: input.contactKey,
    signup_key: input.signupKey,
    email_present: Boolean(input.email),
    phone_present: Boolean(input.phone),
    source: input.source,
    tags,
    custom_fields: {
      'One Time Parent ID': input.contactKey,
      'One Time Signup Source': input.source,
      'One Time Customer Status': 'prelaunch',
      'One Time Last Sync': null,
    },
  };
  const payloadDigest = stableDigest(protectedPayload);
  return {
    eventKey: `hl_evt_${payloadDigest.slice(0, 32)}`,
    accountKey: input.config.accountKey,
    productKey: input.config.productKey,
    eventType: 'lead.created',
    localObjectKey: input.signupKey,
    payloadDigest,
    protectedPayload,
    idempotencyKey: `hl_signup_${stableDigest([input.contactKey, input.signupKey]).slice(0, 32)}`,
  };
}

export async function enqueueHighLevelOutbox(
  client: Queryable,
  intent: HighLevelOutboxIntent,
): Promise<'inserted' | 'duplicate'> {
  const existing = await client.query(
    `SELECT event_key
       FROM onetime.highlevel_outbox_events
      WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3
      LIMIT 1`,
    [intent.accountKey, intent.productKey, intent.idempotencyKey],
  );
  if (existing.rowCount) return 'duplicate';

  const result = await client.query(
    `INSERT INTO onetime.highlevel_outbox_events
     (event_key, account_key, product_key, event_type, local_object_key, payload_digest,
      protected_payload, idempotency_key, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'pending')
     ON CONFLICT (account_key, product_key, idempotency_key) DO NOTHING
     RETURNING event_key`,
    [
      intent.eventKey,
      intent.accountKey,
      intent.productKey,
      intent.eventType,
      intent.localObjectKey,
      intent.payloadDigest,
      JSON.stringify(intent.protectedPayload),
      intent.idempotencyKey,
    ],
  );
  return result.rows.length === 1 ? 'inserted' : 'duplicate';
}
