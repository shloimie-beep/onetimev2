import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const required = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
};

const baseUrl = required('PREVIEW_BASE_URL').replace(/\/$/, '');
const databaseUrl = required('DATABASE_PUBLIC_URL');
const operatorConfigPath = required('ONE_TIME_OPERATOR_PRIVATE_CONFIG');
const highLevelTokenPath = required('HIGHLEVEL_PRIVATE_TOKEN_PATH');
const locationId = required('HIGHLEVEL_LOCATION_ID');
const workflowId = required('HIGHLEVEL_TISHA_BAV_WORKFLOW_ID');
const idempotencyKey = required('OPERATOR_SMOKE_IDEMPOTENCY_KEY');

const operatorConfig = JSON.parse(await readFile(operatorConfigPath, 'utf8')) as {
  env?: { ONE_TIME_OWNER_TEST_EMAIL?: string };
};
const email = operatorConfig.env?.ONE_TIME_OWNER_TEST_EMAIL?.trim().toLocaleLowerCase();
if (!email) throw new Error('The protected operator email is unavailable.');
const highLevelToken = (await readFile(highLevelTokenPath, 'utf8')).trim();
if (!highLevelToken) throw new Error('The protected HighLevel token is unavailable.');

const payload = {
  email,
  first_name: 'Operator',
  newsletter_opt_in: false,
  source: 'current_state_reconciliation_20260722',
  idempotency_key: idempotencyKey,
  homepage: '',
};
const register = async () => {
  const response = await fetch(`${baseUrl}/api/v1/events/tisha-bav-2026/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Registration returned HTTP ${response.status}.`);
  return (await response.json()) as {
    success: boolean;
    duplicate_submission: boolean;
    registration_key: string | null;
    confirmation_queued: boolean;
    ghl_sync_status: string;
  };
};

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});
const existingRegistration = await pool.query<{ registration_key: string }>(
  `SELECT registration_key
     FROM onetime.event_registrations
    WHERE account_key = 'rabbi_sheller_provider'
      AND product_key = 'one_time_mishnah_class'
      AND event_code = 'tisha-bav-2026'
      AND email_normalized = $1
    LIMIT 1`,
  [email],
);
const readOnly = process.env.OPERATOR_SMOKE_READ_ONLY === '1';
const repairFalsePositive = process.env.OPERATOR_SMOKE_RETRY_DELIVERY === '1';
const existingRegistrationKey = existingRegistration.rows[0]?.registration_key;
if (repairFalsePositive) {
  if (!existingRegistrationKey) {
    throw new Error('The operator registration is unavailable for a bounded retry.');
  }
  await pool.query(
    `UPDATE onetime.event_delivery_events
        SET status = 'failed',
            completed_at = NULL,
            public_metadata = public_metadata || '{"reconciled_false_positive":true}'::jsonb,
            updated_at = now()
      WHERE account_key = 'rabbi_sheller_provider'
        AND product_key = 'one_time_mishnah_class'
        AND event_code = 'tisha-bav-2026'
        AND registration_key = $1
        AND provider = 'highlevel'
        AND status = 'succeeded'`,
    [existingRegistrationKey],
  );
}
const first = readOnly ? null : await register();
const second = readOnly ? null : await register();
const registrationKey = first?.registration_key ?? existingRegistrationKey;
if (!registrationKey) throw new Error('The operator registration is unavailable.');
if (!readOnly && first?.registration_key !== second?.registration_key) {
  throw new Error('The repeated registration did not preserve one registration key.');
}

const databaseEvidence = await pool.query<{
  registration_count: number;
  delivery_count: number;
  delivery_status: string | null;
  attempts: number | null;
  workflow_configured: boolean | null;
  failed_stage: string | null;
  provider_http_status: number | null;
}>(
  `SELECT
     (SELECT count(*)::int
        FROM onetime.event_registrations
       WHERE account_key = 'rabbi_sheller_provider'
         AND product_key = 'one_time_mishnah_class'
         AND event_code = 'tisha-bav-2026'
         AND email_normalized = $1) AS registration_count,
     count(*)::int AS delivery_count,
     max(status) AS delivery_status,
     max(attempts)::int AS attempts,
     bool_or((public_metadata->>'workflow_configured')::boolean) AS workflow_configured,
     max(public_metadata->>'failed_stage') AS failed_stage,
     max((public_metadata->>'provider_http_status')::int) AS provider_http_status
   FROM onetime.event_delivery_events
   WHERE account_key = 'rabbi_sheller_provider'
     AND product_key = 'one_time_mishnah_class'
     AND event_code = 'tisha-bav-2026'
     AND registration_key = $2
     AND provider = 'highlevel'`,
  [email, registrationKey],
);

const highLevelHeaders = {
  authorization: `Bearer ${highLevelToken}`,
  version: '2021-07-28',
  accept: 'application/json',
};
const contactsUrl = new URL('/contacts/', 'https://services.leadconnectorhq.com');
contactsUrl.searchParams.set('locationId', locationId);
contactsUrl.searchParams.set('query', email);
contactsUrl.searchParams.set('limit', '20');
const contactsResponse = await fetch(contactsUrl, { headers: highLevelHeaders });
if (!contactsResponse.ok) {
  throw new Error(`HighLevel contact read returned HTTP ${contactsResponse.status}.`);
}
const contactsPayload = (await contactsResponse.json()) as {
  contacts?: Array<{ id?: string; email?: string; tags?: string[] }>;
};
const exactContacts = (contactsPayload.contacts ?? []).filter(
  (contact) => contact.email?.trim().toLocaleLowerCase() === email,
);
const exactContact = exactContacts[0];
let authoritativeContact: { id?: string; tags?: string[] } | undefined;
if (exactContact?.id) {
  const contactResponse = await fetch(
    new URL(
      `/contacts/${encodeURIComponent(exactContact.id)}`,
      'https://services.leadconnectorhq.com',
    ),
    { headers: highLevelHeaders },
  );
  if (!contactResponse.ok) {
    throw new Error(`HighLevel contact read returned HTTP ${contactResponse.status}.`);
  }
  const contactPayload = (await contactResponse.json()) as {
    contact?: { id?: string; tags?: string[] };
  };
  authoritativeContact = contactPayload.contact;
}
const tags = new Set(authoritativeContact?.tags ?? exactContact?.tags ?? []);

const workflowsUrl = new URL('/workflows/', 'https://services.leadconnectorhq.com');
workflowsUrl.searchParams.set('locationId', locationId);
const workflowsResponse = await fetch(workflowsUrl, { headers: highLevelHeaders });
if (!workflowsResponse.ok) {
  throw new Error(`HighLevel workflow read returned HTTP ${workflowsResponse.status}.`);
}
const workflowsPayload = (await workflowsResponse.json()) as {
  workflows?: Array<{ id?: string; status?: string }>;
};
const workflowMatches = (workflowsPayload.workflows ?? []).filter(
  (workflow) => workflow.id === workflowId,
);
let row = databaseEvidence.rows[0];
const finalizeVerifiedDelivery = process.env.OPERATOR_SMOKE_FINALIZE_VERIFIED_DELIVERY === '1';
let finalizationApplied = false;
if (finalizeVerifiedDelivery) {
  const verified =
    readOnly &&
    row?.delivery_count === 1 &&
    exactContacts.length === 1 &&
    tags.has("OT | Event | Tisha B'Av 2026 | Registered") &&
    tags.has("OT | Source | Tisha B'Av 2026") &&
    !tags.has('OT | Weekly Newsletter') &&
    workflowMatches.length === 1 &&
    workflowMatches[0]?.status === 'published';
  if (!verified) {
    throw new Error('The protected provider evidence is not sufficient to finalize delivery.');
  }
  const finalized = await pool.query(
    `UPDATE onetime.event_delivery_events
        SET status = 'succeeded',
            completed_at = COALESCE(completed_at, now()),
            public_metadata =
              (public_metadata - 'failed_stage' - 'provider_http_status') ||
              '{"workflow_configured":true,"tags_verified":true,"operator_reconciliation_finalized":true}'::jsonb,
            updated_at = now()
      WHERE account_key = 'rabbi_sheller_provider'
        AND product_key = 'one_time_mishnah_class'
        AND event_code = 'tisha-bav-2026'
        AND registration_key = $1
        AND provider = 'highlevel'
        AND status = 'failed'`,
    [registrationKey],
  );
  finalizationApplied = finalized.rowCount === 1;
  if (finalizationApplied && row) {
    row = {
      ...row,
      delivery_status: 'succeeded',
      workflow_configured: true,
      failed_stage: null,
      provider_http_status: null,
    };
  }
}
await pool.end();
process.stdout.write(
  `${JSON.stringify({
    contact_fingerprint: sha256(email).slice(0, 16),
    read_only: readOnly,
    false_positive_repair_requested: repairFalsePositive,
    verified_delivery_finalization_requested: finalizeVerifiedDelivery,
    verified_delivery_finalization_applied: finalizationApplied,
    first_success: first?.success ?? null,
    first_duplicate: first?.duplicate_submission ?? null,
    first_confirmation_queued: first?.confirmation_queued ?? null,
    first_ghl_sync_status: first?.ghl_sync_status ?? null,
    second_success: second?.success ?? null,
    second_duplicate: second?.duplicate_submission ?? null,
    same_registration_key: readOnly ? null : first?.registration_key === second?.registration_key,
    registration_count: row?.registration_count ?? 0,
    highlevel_delivery_count: row?.delivery_count ?? 0,
    highlevel_delivery_status: row?.delivery_status ?? null,
    highlevel_delivery_attempts: row?.attempts ?? null,
    workflow_request_accepted: row?.workflow_configured ?? false,
    failed_stage: row?.failed_stage ?? null,
    provider_http_status: row?.provider_http_status ?? null,
    ghl_exact_contact_count: exactContacts.length,
    ghl_direct_contact_read: Boolean(authoritativeContact?.id),
    ghl_contact_reference_hash: exactContact?.id ? sha256(exactContact.id).slice(0, 16) : null,
    registered_tag_present: tags.has("OT | Event | Tisha B'Av 2026 | Registered"),
    source_tag_present: tags.has("OT | Source | Tisha B'Av 2026"),
    newsletter_tag_present: tags.has('OT | Weekly Newsletter'),
    workflow_match_count: workflowMatches.length,
    workflow_status: workflowMatches[0]?.status ?? null,
  })}\n`,
);

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
