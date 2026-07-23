import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { supportEventV1Schema } from '../../../packages/contracts/src/support/index.ts';
import {
  createAccountUser,
  createOt89SignedHeaders,
  createSupportId,
  requeueSupportDeadLetter,
  runSupportDeliveryBatch,
} from '../../../packages/domain/src/index.ts';
import { supportAttachmentLimits } from '../../../packages/domain/src/support/attachments.ts';
import { createApp } from '../../../apps/web/src/server/app.ts';

let pool: DbPool;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;
let config: AppConfig;
let subscriberUserKey: string;
let otherUserKey: string;

beforeEach(async () => {
  pool = createMemoryPool();
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: '2026.07.16-test',
    COMMIT_SHA: '0123456789abcdef0123456789abcdef01234567',
    OUTBOX_TRANSPORT_MODE: 'sink',
    OT89_SUPPORT_ENABLED: 'true',
    OT89_MOCK_BNA_ENABLED: 'true',
    OT89_SUPPORT_DELIVERY_MODE: 'mock',
    OT89_SUPPORT_BNA_BASE_URL: 'http://127.0.0.1:1',
    OT89_SUPPORT_HMAC_KEY_ID: 'ot89-onetime-integration',
    OT89_SUPPORT_HMAC_SECRET: 'ot89-test-secret-do-not-use',
    OT89_BNA_TO_ONETIME_HMAC_KEY_ID: 'ot89-bna-integration',
    OT89_BNA_TO_ONETIME_HMAC_SECRET: 'ot89-test-secret-do-not-use-reverse',
  });
  await runMigrations(pool);
  subscriberUserKey = await createAccountUser({
    pool,
    config,
    email: 'subscriber@example.test',
    password: 'SubscriberPass!234',
    displayName: 'Subscriber Parent',
    role: 'parent',
  });
  otherUserKey = await createAccountUser({
    pool,
    config,
    email: 'other@example.test',
    password: 'OtherPass!234',
    displayName: 'Other Parent',
    role: 'viewer',
  });
  await createActiveCurrentAccess(subscriberUserKey, futureIso());
  const app = createApp({ config, pool });
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
  config = { ...config, ot89SupportBnaBaseUrl: baseUrl };
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

describe('OT-89A subscriber support producer', () => {
  it('hides the ticket route from anonymous and non-subscriber users', async () => {
    const anonymousPage = await fetch(`${baseUrl}/app/support`);
    expect(anonymousPage.status).toBe(200);
    expect(anonymousPage.headers.get('cache-control')).toContain('no-store');
    expect(anonymousPage.headers.get('x-robots-tag')).toContain('noindex');
    const anonymousHtml = await anonymousPage.text();
    expect(anonymousHtml).toContain('/signup');
    expect(anonymousHtml).not.toContain('data-support-form');

    const anonymousPost = await fetch(`${baseUrl}/api/v1/support/tickets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validSupportPayload()),
    });
    expect(anonymousPost.status).toBe(401);

    const other = await loginAs('other@example.test', 'OtherPass!234');
    const nonSubscriberPage = await fetch(`${baseUrl}/app/support`, {
      headers: { cookie: other.cookies },
    });
    expect(await nonSubscriberPage.text()).not.toContain('data-support-form');
    const denied = await postSupport(other, validSupportPayload('non-sub'));
    expect(denied.status).toBe(403);
    const count = await pool.query(
      'SELECT count(*)::int AS count FROM onetime.support_submissions',
    );
    expect(Number(count.rows[0].count)).toBe(0);
  });

  it('fails closed when support is disabled and never displays a black-hole form', async () => {
    const disabledConfig = {
      ...config,
      ot89SupportEnabled: false,
      ot89SupportDeliveryMode: 'disabled' as const,
    };
    const disabledApp = createApp({ config: disabledConfig, pool });
    const disabledServer = await listen(disabledApp);
    try {
      const disabledBaseUrl = serverBaseUrl(disabledServer);
      const login = await loginAsAt(
        disabledBaseUrl,
        'subscriber@example.test',
        'SubscriberPass!234',
      );
      const page = await fetch(`${disabledBaseUrl}/app/support`, {
        headers: { cookie: login.cookies },
      });
      const html = await page.text();
      expect(page.status).toBe(200);
      expect(html).toContain('crm-root');
      expect(html).not.toContain('data-support-form');

      const api = await postSupportAt(disabledBaseUrl, login, validSupportPayload('support-off'));
      expect(api.status).toBe(503);
      const submissions = await pool.query(
        'SELECT count(*)::int AS count FROM onetime.support_submissions',
      );
      expect(countValue(submissions.rows[0].count)).toBe(0);
    } finally {
      await new Promise<void>((resolve) => disabledServer.close(() => resolve()));
    }
  });

  it('revokes an expired current-access session at submit and creates no durable rows', async () => {
    const login = await loginAs('subscriber@example.test', 'SubscriberPass!234');
    const page = await fetch(`${baseUrl}/app/support`, { headers: { cookie: login.cookies } });
    expect(await page.text()).toContain('crm-root');
    await expireSubscriberCurrentAccess();
    const response = await postSupport(login, validSupportPayload('expired'));
    expect(response.status).toBe(401);
    const rows = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM onetime.support_submissions) AS submissions,
        (SELECT count(*)::int FROM onetime.support_attachments) AS attachments,
        (SELECT count(*)::int FROM onetime.support_outbox) AS outbox`,
    );
    expect(countValue(rows.rows[0].submissions)).toBe(0);
    expect(countValue(rows.rows[0].attachments)).toBe(0);
    expect(countValue(rows.rows[0].outbox)).toBe(0);
  });

  it('commits a subscriber receipt and outbox without synchronously calling BNA', async () => {
    const login = await loginAs('subscriber@example.test', 'SubscriberPass!234');
    const response = await postSupport(login, validSupportPayload('active'));
    expect(response.status).toBe(202);
    const body = (await response.json()) as {
      success: true;
      receipt_id: string;
      source_ticket_id: string;
      status_path: string;
      delivery_state: string;
    };
    expect(body).toMatchObject({ success: true, delivery_state: 'queued' });
    const stored = await pool.query(
      `SELECT submissions.entitlement_id, submissions.actor_user_key, outbox.raw_body,
              outbox.status, projection.delivery_state
         FROM onetime.support_submissions AS submissions
         JOIN onetime.support_outbox AS outbox ON outbox.source_ticket_id = submissions.source_ticket_id
         JOIN onetime.support_status_projection AS projection
           ON projection.source_ticket_id = submissions.source_ticket_id
        WHERE submissions.receipt_id = $1`,
      [body.receipt_id],
    );
    expect(stored.rows[0]).toMatchObject({
      actor_user_key: subscriberUserKey,
      status: 'PENDING',
      delivery_state: 'queued',
    });
    const event = supportEventV1Schema.parse(JSON.parse(String(stored.rows[0].raw_body)));
    expect(event.authorization.entitlement_status).toBe('active');
    expect(event.scope).toMatchObject({
      account_key: config.accountKey,
      product_key: config.productKey,
    });
    expect(event.ticket).toMatchObject({
      category: 'technical_bug',
      severity: 'high',
      redacted_summary: 'Class page fails active',
    });
    expect(event.ticket.operator_triage).toMatchObject({
      bna_triage_candidate: true,
      decision_state: 'triage_candidate',
    });
    expect(event.ticket.message).toContain('[REDACTED:email]');
    const mockRows = await pool.query(
      'SELECT count(*)::int AS count FROM onetime.support_mock_bna_events',
    );
    expect(Number(mockRows.rows[0].count)).toBe(0);
  });

  it('returns the existing receipt for duplicate support submissions', async () => {
    const login = await loginAs('subscriber@example.test', 'SubscriberPass!234');
    const payload = validSupportPayload('duplicate-submit');
    const first = await postSupport(login, payload);
    expect(first.status).toBe(202);
    const firstBody = (await first.json()) as {
      receipt_id: string;
      duplicate_submission: boolean;
    };
    expect(firstBody.duplicate_submission).toBe(false);

    const duplicate = await postSupport(login, payload);
    expect(duplicate.status).toBe(202);
    const duplicateBody = (await duplicate.json()) as {
      receipt_id: string;
      duplicate_submission: boolean;
    };
    expect(duplicateBody).toMatchObject({
      receipt_id: firstBody.receipt_id,
      duplicate_submission: true,
    });
    const submissions = await pool.query(
      'SELECT count(*)::int AS count FROM onetime.support_submissions',
    );
    expect(countValue(submissions.rows[0].count)).toBe(1);
  });

  it('accepts exactly 10 MiB decoded attachments through base64 JSON transport and rejects 10 MiB plus one byte', async () => {
    const login = await loginAs('subscriber@example.test', 'SubscriberPass!234');
    const jpeg = await imageFixture('jpeg', 8, 8);
    const exactA = jpegWithAppSegments(jpeg, supportAttachmentLimits.maxImageBytes);
    const exactB = jpegWithAppSegments(jpeg, supportAttachmentLimits.maxImageBytes);
    const exactPayload = validSupportPayload('exact-10mib');
    exactPayload.attachments = [
      imageUpload('exact-a.jpg', 'image/jpeg', exactA),
      imageUpload('exact-b.jpg', 'image/jpeg', exactB),
    ];
    const exact = await postSupport(login, exactPayload);
    expect(exact.status).toBe(202);
    const exactBody = (await exact.json()) as { source_ticket_id: string };
    const stored = await pool.query(
      'SELECT count(*)::int AS count FROM onetime.support_attachments WHERE source_ticket_id = $1',
      [exactBody.source_ticket_id],
    );
    expect(countValue(stored.rows[0].count)).toBe(2);

    const overPayload = validSupportPayload('over-10mib');
    overPayload.attachments = [
      imageUpload('over-a.jpg', 'image/jpeg', exactA),
      imageUpload('over-b.jpg', 'image/jpeg', exactB),
      {
        filename: 'one-byte.txt',
        media_type: 'text/plain',
        content_base64: Buffer.from('x').toString('base64'),
      },
    ];
    const over = await postSupport(login, overPayload);
    expect(over.status).toBe(400);
    const overBody = (await over.json()) as { code: string };
    expect(overBody.code).toBe('ATTACHMENT_TOTAL_TOO_LARGE');
  });

  it('delivers asynchronously to the deterministic mock and caches same-account status', async () => {
    const login = await loginAs('subscriber@example.test', 'SubscriberPass!234');
    const response = await postSupport(login, validSupportPayload('deliver'));
    const receipt = (await response.json()) as { receipt_id: string; source_ticket_id: string };

    const summary = await runSupportDeliveryBatch({ pool, config });
    expect(summary).toMatchObject({ claimed: 1, delivered: 1, retried: 0, deadLettered: 0 });

    const status = await fetch(`${baseUrl}/api/v1/support/receipts/${receipt.receipt_id}/status`, {
      headers: { cookie: login.cookies },
    });
    expect(status.status).toBe(200);
    const statusJson = (await status.json()) as {
      receipt: { delivery_state: string; bna_ticket_ref: string | null };
    };
    expect(statusJson.receipt.delivery_state).toBe('delivered');
    expect(statusJson.receipt.bna_ticket_ref).toMatch(/^bna_/);

    const outbox = await pool.query(
      'SELECT status, attempts FROM onetime.support_outbox WHERE source_ticket_id = $1',
      [receipt.source_ticket_id],
    );
    expect(outbox.rows[0]).toMatchObject({ status: 'DELIVERED', attempts: 1 });
  });

  it('retries outages, dead-letters permanent failures, and supports audited requeue', async () => {
    const login = await loginAs('subscriber@example.test', 'SubscriberPass!234');
    await postSupport(login, validSupportPayload('retry'));
    const networkSummary = await runSupportDeliveryBatch({
      pool,
      config: { ...config, ot89SupportBnaBaseUrl: 'http://127.0.0.1:9' },
      options: { requestTimeoutMs: 10 },
    });
    expect(networkSummary).toMatchObject({ claimed: 1, retried: 1 });
    let projection = await pool.query(
      'SELECT delivery_state FROM onetime.support_status_projection',
    );
    expect(projection.rows[0].delivery_state).toBe('delivery_delayed');

    await pool.query(
      `UPDATE onetime.support_outbox
          SET attempts = 11, next_attempt_at = now(), status = 'PENDING', lease_expires_at = NULL`,
    );
    const deadSummary = await runSupportDeliveryBatch({
      pool,
      config: { ...config, ot89SupportBnaBaseUrl: `${baseUrl}/missing` },
      options: { requestTimeoutMs: 10 },
    });
    expect(deadSummary.deadLettered).toBe(1);
    projection = await pool.query('SELECT delivery_state FROM onetime.support_status_projection');
    expect(projection.rows[0].delivery_state).toBe('dead_letter');

    const ticket = await pool.query('SELECT source_ticket_id FROM onetime.support_outbox');
    const requeued = await requeueSupportDeadLetter({
      pool,
      config,
      sourceTicketId: String(ticket.rows[0].source_ticket_id),
      actorUserKey: subscriberUserKey,
      reason: 'operator retry after fixture outage',
    });
    expect(requeued).toBe(true);
    const outboxAfterRequeue = await pool.query('SELECT status FROM onetime.support_outbox');
    const projectionAfterRequeue = await pool.query(
      'SELECT delivery_state FROM onetime.support_status_projection',
    );
    const requeueAudit = await pool.query(
      `SELECT count(*)::int AS count FROM onetime.support_audit_events
        WHERE event_type = 'support_dead_letter_requeued'`,
    );
    expect(outboxAfterRequeue.rows[0].status).toBe('PENDING');
    expect(projectionAfterRequeue.rows[0].delivery_state).toBe('delivery_delayed');
    expect(countValue(requeueAudit.rows[0].count)).toBe(1);
  });

  it('authorizes private attachment transfer only after delivered signed event', async () => {
    const login = await loginAs('subscriber@example.test', 'SubscriberPass!234');
    const payload = validSupportPayload('attachment');
    payload.attachments = [
      {
        filename: 'debug.txt',
        media_type: 'text/plain',
        content_base64: Buffer.from('debug log').toString('base64'),
      },
    ];
    const response = await postSupport(login, payload);
    const receipt = (await response.json()) as { source_ticket_id: string };
    const attachment = await pool.query(
      'SELECT attachment_id, sha256 FROM onetime.support_attachments WHERE source_ticket_id = $1',
      [receipt.source_ticket_id],
    );
    const attachmentId = String(attachment.rows[0].attachment_id);
    const target = `/api/internal/support/attachments/v1/${attachmentId}`;

    const beforeDelivery = await fetch(`${baseUrl}${target}`, {
      headers: signedAttachmentHeaders(target),
    });
    expect(beforeDelivery.status).toBe(404);

    await runSupportDeliveryBatch({ pool, config });
    const afterDelivery = await fetch(`${baseUrl}${target}`, {
      headers: signedAttachmentHeaders(target),
    });
    expect(afterDelivery.status).toBe(200);
    expect(afterDelivery.headers.get('cache-control')).toContain('no-store');
    expect(afterDelivery.headers.get('x-content-type-options')).toBe('nosniff');
    expect(afterDelivery.headers.get('content-disposition')).toContain('attachment');
    expect(afterDelivery.headers.get('x-ot89-content-sha256')).toBe(
      String(attachment.rows[0].sha256),
    );
    expect(await afterDelivery.text()).toBe('debug log');
  });

  it('keeps duplicate and collision behavior deterministic in the mock consumer', async () => {
    const login = await loginAs('subscriber@example.test', 'SubscriberPass!234');
    await postSupport(login, validSupportPayload('duplicate'));
    const outbox = await pool.query(
      'SELECT event_id, source_ticket_id, raw_body FROM onetime.support_outbox',
    );
    const rawBody = String(outbox.rows[0].raw_body);
    const first = await postSignedMockEvent(
      rawBody,
      String(outbox.rows[0].event_id),
      'A'.repeat(32),
    );
    expect(first.status).toBe(202);
    const duplicate = await postSignedMockEvent(
      rawBody,
      String(outbox.rows[0].event_id),
      'B'.repeat(32),
    );
    expect(duplicate.status).toBe(200);

    const changed = JSON.stringify({
      ...JSON.parse(rawBody),
      ticket: { ...JSON.parse(rawBody).ticket, title: 'Changed title' },
    });
    const collision = await postSignedMockEvent(
      changed,
      String(outbox.rows[0].event_id),
      'C'.repeat(32),
    );
    expect(collision.status).toBe(409);
  });

  it('denies cross-user receipt reads even with an opaque receipt id', async () => {
    const login = await loginAs('subscriber@example.test', 'SubscriberPass!234');
    const otherSourceTicketId = createSupportId('ots');
    const otherReceipt = createSupportId('otr');
    await pool.query(
      `INSERT INTO onetime.support_submissions
       (source_ticket_id, receipt_id, event_id, outbox_id, account_key, product_key,
        actor_user_key, actor_role, entitlement_id, entitlement_checked_at, category, title,
        message, issue_details, client_context, reply_preference, idempotency_key,
        request_hash, body_fingerprint, privacy)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'parent','ent_other',now(),'technical_bug','Other receipt',
        'Other message saved for access testing.','{}'::jsonb,'{}'::jsonb,'in_app',
        'other-idem',$8,$9,'{}'::jsonb)`,
      [
        otherSourceTicketId,
        otherReceipt,
        createSupportId('evt'),
        createSupportId('otx'),
        config.accountKey,
        config.productKey,
        otherUserKey,
        'a'.repeat(64),
        'b'.repeat(64),
      ],
    );
    await pool.query(
      `INSERT INTO onetime.support_status_projection
       (source_ticket_id, receipt_id, account_key, product_key, actor_user_key, status,
        public_summary, delivery_state)
       VALUES ($1,$2,$3,$4,$5,'new','Other receipt','queued')`,
      [otherSourceTicketId, otherReceipt, config.accountKey, config.productKey, otherUserKey],
    );
    const response = await fetch(`${baseUrl}/api/v1/support/receipts/${otherReceipt}/status`, {
      headers: { cookie: login.cookies },
    });
    expect(response.status).toBe(404);
  });
});

type LoginResult = {
  cookies: string;
  json: { success: true; csrf_token: string };
};

async function createActiveCurrentAccess(userKey: string, validUntil: string) {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ('support_household_subscriber',$1,$2,'Subscriber Family')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES (
       'support_relationship_subscriber',
       $1,
       $2,
       'support_household_subscriber',
       $3,
       'Parent',
       'primary_guardian'
     )`,
    [config.accountKey, config.productKey, userKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, last_event_key)
     VALUES (
       'support_current_access',
       $1,
       $2,
       'support_household_subscriber',
       'active',
       'free_pilot',
       now() - interval '1 hour',
       $3::timestamptz,
       'support-fixture-free-pilot',
       1,
       now(),
       $4,
       'ot-launch-01-current-access-v1',
       'support_current_access_event'
     )`,
    [config.accountKey, config.productKey, validUntil, 'd'.repeat(64)],
  );
}

async function expireSubscriberCurrentAccess() {
  await pool.query(
    `UPDATE onetime.account_access_projections
        SET expires_at = $3::timestamptz,
            source_updated_at = now(),
            updated_at = now()
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = 'support_household_subscriber'`,
    [config.accountKey, config.productKey, pastIso()],
  );
}

async function getLoginCsrf(targetBaseUrl = baseUrl) {
  const page = await fetch(`${targetBaseUrl}/login`);
  const html = await page.text();
  const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error('missing csrf token');
  return { token, cookies: cookieHeader(page.headers) };
}

async function loginAs(email: string, password: string): Promise<LoginResult> {
  return loginAsAt(baseUrl, email, password);
}

async function loginAsAt(
  targetBaseUrl: string,
  email: string,
  password: string,
): Promise<LoginResult> {
  const csrf = await getLoginCsrf(targetBaseUrl);
  const response = await fetch(`${targetBaseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      cookie: csrf.cookies,
      'content-type': 'application/json',
      'x-csrf-token': csrf.token,
    },
    body: JSON.stringify({ email, password, csrf_token: csrf.token }),
  });
  expect(response.status).toBe(200);
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    json: (await response.json()) as LoginResult['json'],
  };
}

async function postSupport(login: LoginResult, payload: Record<string, unknown>) {
  return postSupportAt(baseUrl, login, payload);
}

async function postSupportAt(
  targetBaseUrl: string,
  login: LoginResult,
  payload: Record<string, unknown>,
) {
  return fetch(`${targetBaseUrl}/api/v1/support/tickets`, {
    method: 'POST',
    headers: {
      cookie: login.cookies,
      'content-type': 'application/json',
      'x-csrf-token': login.json.csrf_token,
    },
    body: JSON.stringify(payload),
  });
}

async function listen(app: ReturnType<typeof createApp>) {
  return new Promise<ReturnType<ReturnType<typeof createApp>['listen']>>((resolve, reject) => {
    const nextServer = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(nextServer);
    });
  });
}

function serverBaseUrl(targetServer: ReturnType<ReturnType<typeof createApp>['listen']>) {
  const address = targetServer.address();
  if (typeof address !== 'object' || !address) throw new Error('missing server address');
  return `http://127.0.0.1:${address.port}`;
}

function validSupportPayload(
  suffix = 'default',
): Record<string, unknown> & { attachments?: unknown[] } {
  return {
    category: 'technical_bug',
    title: `Class page fails ${suffix}`,
    message: `The class page fails after login for parent@example.test with password: secret-${suffix}.`,
    reply_preference: 'in_app',
    issue_details: {
      steps_to_reproduce: ['Sign in', 'Open class page'],
      expected_behavior: 'The class page opens.',
      actual_behavior: 'The class page shows an error.',
      occurrence: 'always',
      first_observed_at: null,
      error_code: 'CLASS_PAGE_ERROR',
      provider: 'none',
    },
    client_context: {
      route_template: '/app/classes/[classId]',
      app_release: '2026.07.16-test',
      locale: 'en-US',
      timezone: 'Asia/Jerusalem',
    },
    attachments: [],
    idempotency_key: `support-${suffix}-${Date.now()}`,
  };
}

function imageUpload(filename: string, mediaType: string, bytes: Buffer) {
  return { filename, media_type: mediaType, content_base64: bytes.toString('base64') };
}

async function imageFixture(format: 'jpeg' | 'png', width: number, height: number) {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 248, g: 210, b: 64 },
    },
    limitInputPixels: false,
  });
  return format === 'png' ? image.png().toBuffer() : image.jpeg().toBuffer();
}

function jpegWithAppSegments(input: Buffer, targetBytes: number) {
  if (
    input[0] !== 0xff ||
    input[1] !== 0xd8 ||
    input[input.length - 2] !== 0xff ||
    input[input.length - 1] !== 0xd9
  ) {
    throw new Error('expected JPEG fixture');
  }
  const extraBytes = targetBytes - input.length;
  if (extraBytes < 0) throw new Error('target smaller than fixture');
  const segments: Buffer[] = [];
  let remaining = extraBytes;
  let sequence = 0;
  while (remaining > 0) {
    if (remaining < 4) throw new Error('target leaves an impossible JPEG segment remainder');
    const segmentSize = Math.min(remaining, 65_537);
    const payloadLength = segmentSize - 4;
    const segment = Buffer.alloc(segmentSize, 0x41);
    segment[0] = 0xff;
    segment[1] = 0xe1;
    segment.writeUInt16BE(payloadLength + 2, 2);
    segment.write('OT89', 4, 'ascii');
    if (payloadLength > 5) segment.writeUInt16BE(sequence % 65_536, 8);
    segments.push(segment);
    remaining -= segmentSize;
    sequence += 1;
  }
  return Buffer.concat([input.subarray(0, 2), ...segments, input.subarray(2)]);
}

function signedAttachmentHeaders(target: string) {
  return createOt89SignedHeaders({
    keyId: config.ot89BnaToOnetimeHmacKeyId,
    secret: config.ot89BnaToOnetimeHmacSecret,
    method: 'GET',
    requestTarget: target,
    rawBody: Buffer.alloc(0),
  });
}

async function postSignedMockEvent(rawBody: string, eventId: string, nonce: string) {
  return fetch(`${baseUrl}/api/internal/integrations/onetime/support-events/v1`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...createOt89SignedHeaders({
        keyId: config.ot89SupportHmacKeyId,
        secret: config.ot89SupportHmacSecret,
        method: 'POST',
        requestTarget: '/api/internal/integrations/onetime/support-events/v1',
        rawBody,
        eventId,
        nonce,
      }),
    },
    body: rawBody,
  });
}

function futureIso() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function pastIso() {
  return new Date(Date.now() - 60 * 1000).toISOString();
}

function cookieHeader(headers: Headers) {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

function mergeCookies(...headers: string[]) {
  const cookies = new Map<string, string>();
  for (const header of headers) {
    for (const part of header.split(';')) {
      const [key, value] = part.trim().split('=');
      if (key && value) cookies.set(key, value);
    }
  }
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

function countValue(value: unknown) {
  if (Array.isArray(value)) return Number(value[0] ?? 0);
  return Number(value ?? 0);
}
