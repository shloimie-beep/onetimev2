import { randomUUID } from 'node:crypto';
import {
  leadPayloadSchema,
  type LeadPayload,
  type LeadSuccessResponse,
} from '../../../contracts/src/index.ts';
import type { AppConfig } from '../../../config/src/index.ts';
import { DELIVERY_EVENT_TYPES } from '../../../contracts/src/delivery/types.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { scheduleClassFulfillmentForLead } from '../classes/service.ts';
import {
  normalizeEmail,
  normalizePhone,
  requestHash,
  stableKey,
  successCopy,
} from './normalize.ts';

type CaptureLeadInput = {
  pool: DbPool;
  config: AppConfig;
  payload: LeadPayload;
  now?: Date;
};

type OutboxEvent = {
  deliveryKey: string;
  eventType: string;
  channel: 'email' | 'whatsapp' | 'internal_email';
  payload: Record<string, unknown>;
};

type UpsertContactResult = {
  contactKey: string;
  emailForOutbox: string;
  phoneAcceptedForPublicOutbox: string | null;
};

const OFFER_VERSION = 'free-until-rosh-hashanah-2026';
const CONTENT_VERSION = 'landing-v1-2026-07-14';
const CONSENT_POLICY = 'one-time-class-reminders-v1-2026-07-14';
const DELIVERY_POLICY_VERSION = 'ot40-immediate-receipt-v1';

export class IdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key was already used for a different request.');
  }
}

export async function captureLead({
  pool,
  config,
  payload,
  now,
}: CaptureLeadInput): Promise<LeadSuccessResponse> {
  const parsed = leadPayloadSchema.parse(payload);
  const email = normalizeEmail(parsed.email);
  const phone = normalizePhone(parsed.phone);
  const reqHash = requestHash(parsed);

  const response = await inTransaction(pool, async (client) => {
    const duplicate = await client.query(
      `SELECT request_hash, response_json
         FROM onetime.idempotency_records
        WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3`,
      [config.accountKey, config.productKey, parsed.idempotency_key],
    );
    if (duplicate.rowCount) {
      if (duplicate.rows[0].request_hash !== reqHash) throw new IdempotencyConflictError();
      const previous = duplicate.rows[0].response_json as LeadSuccessResponse;
      return { ...previous, duplicate_submission: true };
    }

    const contact = await upsertContact(client, config, parsed, email, phone);
    const contactKey = contact.contactKey;
    const signupKey = stableKey('signup', [contactKey, OFFER_VERSION, CONTENT_VERSION]);
    const message = successCopy(parsed.audience_type);
    const responseBase = {
      success: true as const,
      duplicate_submission: false,
      classification: parsed.audience_type,
      contact_key: contactKey,
      signup_key: signupKey,
      confirmation_queued: true as const,
      outbox_intents: outboxDeliveryKeys(
        config,
        parsed,
        contactKey,
        signupKey,
        contact.emailForOutbox,
        contact.phoneAcceptedForPublicOutbox,
      ),
      message,
    };
    await upsertSignup(client, config, parsed, contactKey, signupKey);
    await insertAudit(client, config, parsed, contactKey, signupKey);
    await insertOutboxIntents(
      client,
      config,
      parsed,
      contactKey,
      signupKey,
      contact.emailForOutbox,
      contact.phoneAcceptedForPublicOutbox,
    );
    await client.query(
      `INSERT INTO onetime.idempotency_records
       (account_key, product_key, idempotency_key, request_hash, response_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        config.accountKey,
        config.productKey,
        parsed.idempotency_key,
        reqHash,
        JSON.stringify(responseBase),
      ],
    );

    return responseBase;
  });

  const classFulfillment = await scheduleClassFulfillmentAfterCommit({
    pool,
    config,
    contactKey: response.contact_key,
    signupKey: response.signup_key,
    ...(now ? { now } : {}),
  });

  return {
    ...response,
    outbox_intents: uniqueIntentKeys([
      ...response.outbox_intents,
      ...classFulfillment.deliveryKeys,
    ]),
  };
}

async function scheduleClassFulfillmentAfterCommit(input: {
  pool: DbPool;
  config: AppConfig;
  contactKey: string;
  signupKey: string;
  now?: Date;
}) {
  try {
    return await scheduleClassFulfillmentForLead(input);
  } catch {
    return { occurrenceKey: null, deliveryKeys: [], dispatchMode: null };
  }
}

function uniqueIntentKeys(keys: string[]) {
  return [...new Set(keys)];
}

async function upsertContact(
  client: Queryable,
  config: AppConfig,
  payload: LeadPayload,
  email: string,
  phone: string | null,
): Promise<UpsertContactResult> {
  const contactKey = `contact_${randomUUID()}`;
  const publicContactId = randomUUID();
  const result = await client.query(
    `INSERT INTO onetime.contacts (
       contact_key, public_contact_id, account_key, product_key, display_name, family_school_classification,
       family_or_school, location_text, timezone, email_normalized, phone_normalized,
       reminder_preference, consent_policy_version, consent_recorded_at, source,
       offer_version, content_version, lead_status, last_activity_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CASE WHEN $14 THEN now() ELSE NULL END,$15,$16,$17,'new',now())
     ON CONFLICT (account_key, product_key, email_normalized)
     DO UPDATE SET
       display_name = CASE
         WHEN onetime.contacts.source = 'one_time_public_signup' THEN EXCLUDED.display_name
         ELSE onetime.contacts.display_name
       END,
       family_school_classification = CASE
         WHEN onetime.contacts.source = 'one_time_public_signup' THEN EXCLUDED.family_school_classification
         ELSE onetime.contacts.family_school_classification
       END,
       family_or_school = CASE
         WHEN onetime.contacts.source = 'one_time_public_signup' THEN EXCLUDED.family_or_school
         ELSE onetime.contacts.family_or_school
       END,
       location_text = CASE
         WHEN onetime.contacts.source = 'one_time_public_signup' THEN EXCLUDED.location_text
         ELSE onetime.contacts.location_text
       END,
       timezone = CASE
         WHEN onetime.contacts.source = 'one_time_public_signup' THEN EXCLUDED.timezone
         ELSE onetime.contacts.timezone
       END,
       phone_normalized = CASE
         WHEN onetime.contacts.source = 'one_time_public_signup'
           THEN COALESCE(EXCLUDED.phone_normalized, onetime.contacts.phone_normalized)
         ELSE onetime.contacts.phone_normalized
       END,
       reminder_preference = CASE
         WHEN onetime.contacts.source = 'one_time_public_signup' THEN EXCLUDED.reminder_preference
         ELSE onetime.contacts.reminder_preference
       END,
       consent_policy_version = CASE
         WHEN onetime.contacts.source = 'one_time_public_signup' THEN EXCLUDED.consent_policy_version
         ELSE onetime.contacts.consent_policy_version
       END,
       consent_recorded_at = CASE
         WHEN onetime.contacts.source = 'one_time_public_signup'
           THEN COALESCE(EXCLUDED.consent_recorded_at, onetime.contacts.consent_recorded_at)
         ELSE onetime.contacts.consent_recorded_at
       END,
       offer_version = $15,
       content_version = $16,
       lead_status = CASE WHEN onetime.contacts.lead_status = 'archived' THEN 'new' ELSE onetime.contacts.lead_status END,
       last_activity_at = now(),
       version = onetime.contacts.version + 1,
       identity_version = CASE
         WHEN onetime.contacts.source = 'one_time_public_signup'
          AND COALESCE(EXCLUDED.phone_normalized, '') <> COALESCE(onetime.contacts.phone_normalized, '')
           THEN onetime.contacts.identity_version + 1
         ELSE onetime.contacts.identity_version
       END,
       updated_at = now()
     RETURNING contact_key, email_normalized, phone_normalized, source`,
    [
      contactKey,
      publicContactId,
      config.accountKey,
      config.productKey,
      payload.contact_name.trim(),
      payload.audience_type,
      payload.family_or_school.trim(),
      payload.location.trim(),
      payload.timezone,
      email,
      phone,
      payload.reminder_preference,
      payload.reminder_preference === 'none' ? null : CONSENT_POLICY,
      payload.reminder_consent,
      'one_time_public_signup',
      OFFER_VERSION,
      CONTENT_VERSION,
    ],
  );
  const returned = result.rows[0];
  const returnedPhone = returned?.phone_normalized ? String(returned.phone_normalized) : null;
  return {
    contactKey: String(returned?.contact_key),
    emailForOutbox: returned?.email_normalized ? String(returned.email_normalized) : email,
    phoneAcceptedForPublicOutbox: returnedPhone === phone ? returnedPhone : null,
  };
}

async function upsertSignup(
  client: Queryable,
  config: AppConfig,
  payload: LeadPayload,
  contactKey: string,
  signupKey: string,
) {
  await client.query(
    `INSERT INTO onetime.signup_leads (
       signup_key, contact_key, account_key, product_key, offer_version, content_version, classification, metadata
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT (contact_key, offer_version, content_version) DO NOTHING`,
    [
      signupKey,
      contactKey,
      config.accountKey,
      config.productKey,
      OFFER_VERSION,
      CONTENT_VERSION,
      payload.audience_type,
      JSON.stringify({
        source_landing_page: payload.attribution.landing_path ?? '/signup',
        browser_timezone: payload.browser_timezone ?? null,
        location: payload.location,
        reminder_preference: payload.reminder_preference,
      }),
    ],
  );
}

async function insertAudit(
  client: Queryable,
  config: AppConfig,
  payload: LeadPayload,
  contactKey: string,
  signupKey: string,
) {
  const eventKey = stableKey('audit', [signupKey, 'captured']);
  await client.query(
    `INSERT INTO onetime.audit_events
     (event_key, account_key, product_key, contact_key, signup_key, event_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      eventKey,
      config.accountKey,
      config.productKey,
      contactKey,
      signupKey,
      'lead_captured',
      JSON.stringify({
        classification: payload.audience_type,
        source: 'one_time_public_signup',
        no_payment: true,
        no_access_grant: true,
        no_automatic_task: true,
      }),
    ],
  );
}

async function insertOutboxIntents(
  client: Queryable,
  config: AppConfig,
  payload: LeadPayload,
  contactKey: string,
  signupKey: string,
  email: string,
  phone: string | null,
) {
  const events = outboxEvents(config, payload, contactKey, signupKey, email, phone);
  for (const event of events) {
    await client.query(
      `INSERT INTO onetime.outbox_events
       (delivery_key, account_key, product_key, contact_key, signup_key, event_type, channel, transport_mode, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       ON CONFLICT (delivery_key) DO NOTHING`,
      [
        event.deliveryKey,
        config.accountKey,
        config.productKey,
        contactKey,
        signupKey,
        event.eventType,
        event.channel,
        config.outboxTransportMode,
        JSON.stringify(event.payload),
      ],
    );
  }
}

function outboxDeliveryKeys(
  config: AppConfig,
  payload: LeadPayload,
  contactKey: string,
  signupKey: string,
  email: string,
  phone: string | null,
) {
  return outboxEvents(config, payload, contactKey, signupKey, email, phone).map(
    (event) => event.deliveryKey,
  );
}

function outboxEvents(
  config: AppConfig,
  payload: LeadPayload,
  contactKey: string,
  signupKey: string,
  email: string,
  phone: string | null,
): OutboxEvent[] {
  const deliveryPolicy = {
    policy_version: DELIVERY_POLICY_VERSION,
    occurrence_id: null,
    deliver_by: null,
  };
  const events: OutboxEvent[] = [];

  if (payload.audience_type === 'family') {
    events.push({
      deliveryKey: stableKey('delivery', [signupKey, DELIVERY_EVENT_TYPES.familySignupEmailAck]),
      eventType: DELIVERY_EVENT_TYPES.familySignupEmailAck,
      channel: 'email',
      payload: {
        ...deliveryPolicy,
        recipient_hash: stableKey('recipient', [email]),
        sender_configured: Boolean(config.emailFrom && config.emailReplyTo),
        classification: payload.audience_type,
      },
    });
  }

  events.push({
    deliveryKey: stableKey('delivery', [signupKey, 'internal_email_alert']),
    eventType: DELIVERY_EVENT_TYPES.internalLeadAlert,
    channel: 'internal_email',
    payload: {
      ...deliveryPolicy,
      owner_alias_configured: Boolean(config.ownerTestEmail),
      contact_key: contactKey,
      signup_key: signupKey,
    },
  });

  const wantsWhatsapp =
    payload.reminder_preference === 'whatsapp' || payload.reminder_preference === 'both';
  if (payload.audience_type === 'family' && wantsWhatsapp && phone && payload.reminder_consent) {
    const whatsappEventType = DELIVERY_EVENT_TYPES.familySignupWhatsAppConfirmation;
    events.push({
      deliveryKey: stableKey('delivery', [signupKey, whatsappEventType]),
      eventType: whatsappEventType,
      channel: 'whatsapp',
      payload: {
        ...deliveryPolicy,
        recipient_hash: stableKey('recipient', [phone]),
        suppression_checked: true,
        public_recipient: true,
      },
    });
  }

  return events;
}
