import {
  leadPayloadSchema,
  type LeadPayload,
  type LeadSuccessResponse,
} from '../../../contracts/src/index.ts';
import type { AppConfig } from '../../../config/src/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
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
};

type OutboxEvent = {
  deliveryKey: string;
  eventType: string;
  channel: 'email' | 'whatsapp' | 'internal_email';
  payload: Record<string, unknown>;
};

const OFFER_VERSION = 'free-until-rosh-hashanah-2026';
const CONTENT_VERSION = 'landing-v1-2026-07-14';
const CONSENT_POLICY = 'one-time-class-reminders-v1-2026-07-14';
const DELIVERY_POLICY_VERSION = 'ot36-immediate-ack-v1';

export async function captureLead({
  pool,
  config,
  payload,
}: CaptureLeadInput): Promise<LeadSuccessResponse> {
  const parsed = leadPayloadSchema.parse(payload);
  const email = normalizeEmail(parsed.email);
  const phone = normalizePhone(parsed.phone);
  const reqHash = requestHash(parsed);
  const contactKey = stableKey('contact', [config.accountKey, config.productKey, email]);
  const signupKey = stableKey('signup', [contactKey, OFFER_VERSION, CONTENT_VERSION]);
  const message = successCopy(parsed.audience_type);
  const responseBase = {
    success: true as const,
    duplicate_submission: false,
    classification: parsed.audience_type,
    contact_key: contactKey,
    signup_key: signupKey,
    confirmation_queued: true as const,
    outbox_intents: outboxDeliveryKeys(config, parsed, contactKey, signupKey),
    message,
  };

  return inTransaction(pool, async (client) => {
    const duplicate = await client.query(
      `SELECT response_json
         FROM onetime.idempotency_records
        WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3`,
      [config.accountKey, config.productKey, parsed.idempotency_key],
    );
    if (duplicate.rowCount) {
      const previous = duplicate.rows[0].response_json as LeadSuccessResponse;
      return { ...previous, duplicate_submission: true };
    }

    await upsertContact(client, config, parsed, contactKey, email, phone);
    await upsertSignup(client, config, parsed, contactKey, signupKey);
    await insertAudit(client, config, parsed, contactKey, signupKey);
    await insertOutboxIntents(client, config, parsed, contactKey, signupKey, email, phone);
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
}

async function upsertContact(
  client: Queryable,
  config: AppConfig,
  payload: LeadPayload,
  contactKey: string,
  email: string,
  phone: string | null,
) {
  await client.query(
    `INSERT INTO onetime.contacts (
       contact_key, account_key, product_key, display_name, family_school_classification,
       family_or_school, location_text, timezone, email_normalized, phone_normalized,
       reminder_preference, consent_policy_version, consent_recorded_at, source,
       offer_version, content_version, lead_status, last_activity_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CASE WHEN $13 THEN now() ELSE NULL END,$14,$15,$16,'new',now())
     ON CONFLICT (account_key, product_key, email_normalized)
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       family_school_classification = EXCLUDED.family_school_classification,
       family_or_school = EXCLUDED.family_or_school,
       location_text = EXCLUDED.location_text,
       timezone = EXCLUDED.timezone,
       phone_normalized = COALESCE(EXCLUDED.phone_normalized, onetime.contacts.phone_normalized),
       reminder_preference = EXCLUDED.reminder_preference,
       consent_policy_version = EXCLUDED.consent_policy_version,
       consent_recorded_at = COALESCE(EXCLUDED.consent_recorded_at, onetime.contacts.consent_recorded_at),
       offer_version = $15,
       content_version = $16,
       lead_status = CASE WHEN onetime.contacts.lead_status = 'archived' THEN 'new' ELSE onetime.contacts.lead_status END,
       last_activity_at = now(),
       version = onetime.contacts.version + 1,
       updated_at = now()`,
    [
      contactKey,
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
) {
  return outboxEvents(
    config,
    payload,
    contactKey,
    signupKey,
    normalizeEmail(payload.email),
    normalizePhone(payload.phone),
  ).map((event) => event.deliveryKey);
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
  const events: OutboxEvent[] = [
    {
      deliveryKey: stableKey('delivery', [signupKey, 'email_ack']),
      eventType: 'email_acknowledgement',
      channel: 'email',
      payload: {
        ...deliveryPolicy,
        recipient_hash: stableKey('recipient', [email]),
        sender_configured: Boolean(config.emailFrom && config.emailReplyTo),
        classification: payload.audience_type,
      },
    },
    {
      deliveryKey: stableKey('delivery', [signupKey, 'internal_email_alert']),
      eventType: 'internal_lead_alert',
      channel: 'internal_email',
      payload: {
        ...deliveryPolicy,
        owner_alias_configured: Boolean(config.ownerTestEmail),
        contact_key: contactKey,
        signup_key: signupKey,
      },
    },
  ];

  const wantsWhatsapp =
    payload.reminder_preference === 'whatsapp' || payload.reminder_preference === 'both';
  if (wantsWhatsapp && phone && payload.reminder_consent) {
    events.push({
      deliveryKey: stableKey('delivery', [signupKey, 'whatsapp_confirmation']),
      eventType: 'whatsapp_confirmation',
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
