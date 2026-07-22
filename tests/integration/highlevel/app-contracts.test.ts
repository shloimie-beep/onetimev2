import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { HIGHLEVEL_CONTRACT_VERSION } from '../../../packages/contracts/src/highlevel/index.ts';
import {
  createMemoryPool,
  inTransaction,
  runMigrations,
  type DbPool,
} from '../../../packages/db/src/index.ts';
import {
  DeterministicFakeHighLevelAdapter,
  acceptParentActivation,
  admitContentOutcome,
  captureLead,
  createAccountUser,
  createParentActivation,
  enqueueHighLevelEvent,
  handleHighLevelAction,
  runHighLevelProjectionBatch,
  scheduleClassFulfillmentForLead,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;

const contactEmail = 'operator.parent@example.test';
const actionSecret = 'test-only-highlevel-action-secret-0001';
const now = new Date('2026-07-22T10:00:00.000Z');

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
    HIGHLEVEL_ACTIONS_MODE: 'enabled',
    HIGHLEVEL_ACTION_KEY_ID: 'test-highlevel-key',
    HIGHLEVEL_ACTION_SECRET: actionSecret,
    HIGHLEVEL_ACTION_RATE_LIMIT_MAX: '20',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('One Time to HighLevel transactional journey', () => {
  it('emits each adult-only event exactly once and dispatches one idempotent provider intent', async () => {
    const lead = await captureLead({ pool, config, payload: leadPayload(), now });
    await captureLead({ pool, config, payload: leadPayload(), now });
    const ownerUserKey = await createAccountUser({
      pool,
      config,
      email: 'owner.highlevel@example.test',
      password: 'OwnerPass!234',
      displayName: 'Owner',
      role: 'owner',
      mfaCapable: true,
    });
    await seedHousehold();

    const invitation = await createParentActivation({
      pool,
      config,
      actor: { userKey: ownerUserKey, role: 'owner' },
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'parent-invitation-highlevel-001',
        email: contactEmail,
        display_name: 'Operator Parent',
        household_key: 'household_highlevel',
        relationship_key: 'relationship_highlevel',
        relationship_label: 'Parent',
      },
      now,
    });
    await createParentActivation({
      pool,
      config,
      actor: { userKey: ownerUserKey, role: 'owner' },
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'parent-invitation-highlevel-001',
        email: contactEmail,
        display_name: 'Operator Parent',
        household_key: 'household_highlevel',
        relationship_key: 'relationship_highlevel',
        relationship_label: 'Parent',
      },
      now,
    });
    const token = invitation.token_for_local_proof;
    if (!token) throw new Error('Expected local parent proof token.');
    await acceptParentActivation({
      pool,
      config,
      payload: { token, password: 'ParentPass!234' },
      now: new Date('2026-07-22T10:01:00.000Z'),
    });
    await grantHouseholdAccess();

    await scheduleClassFulfillmentForLead({
      pool,
      config,
      contactKey: lead.contact_key,
      signupKey: lead.signup_key,
      now,
    });
    await scheduleClassFulfillmentForLead({
      pool,
      config,
      contactKey: lead.contact_key,
      signupKey: lead.signup_key,
      now,
    });

    const outcome = contentOutcome();
    await admitContentOutcome({ pool, config, payload: outcome, now });
    await admitContentOutcome({ pool, config, payload: outcome, now });

    const events = await highLevelEvents();
    expect(events.map((event) => event.event_name).sort()).toEqual([
      'adult.signup.submitted',
      'class.reminder.requested',
      'parent.portal.activated',
      'parent.portal.invitation_requested',
      'recording.available',
    ]);
    expect(JSON.stringify(events)).not.toMatch(
      /operator\.parent|student|learner|password|security_token|zoom\.us|vimeo\.com/i,
    );

    const adapter = new DeterministicFakeHighLevelAdapter();
    const dispatchAt = new Date('2026-07-22T11:00:00.000Z');
    const first = await runHighLevelProjectionBatch({ pool, config, adapter, now: dispatchAt });
    const replay = await runHighLevelProjectionBatch({ pool, config, adapter, now: dispatchAt });
    expect(first).toMatchObject({ enabled: true, claimed: 5, delivered: 5, adapterCalls: 5 });
    expect(replay).toMatchObject({ enabled: true, claimed: 0, delivered: 0, adapterCalls: 0 });
    expect(adapter.calls).toHaveLength(5);
    expect(adapter.calls.flatMap((call) => call.tagsToAdd).sort()).toEqual([
      'OT | Class Reminder Pending',
      'OT | Lead',
      'OT | Portal Active',
      'OT | Portal Invited',
      'OT | Recording Available',
    ]);
  });

  it('fails closed for missing consent, suppression, DND, unconfirmed classes, and unapproved content', async () => {
    const lead = await captureLead({ pool, config, payload: leadPayload(), now });
    const baseline = await highLevelEventCount();
    await pool.query(
      `UPDATE onetime.contacts SET suppression_state = 'suppressed' WHERE contact_key = $1`,
      [lead.contact_key],
    );
    const suppressed = await inTransaction(pool, (client) =>
      enqueueHighLevelEvent(client, config, {
        eventName: 'adult.signup.submitted',
        contactKey: lead.contact_key,
        idempotencyKey: 'suppressed-event-0001',
        actor: { kind: 'system', reference: 'test' },
        occurredAt: now,
        protectedPath: '/signup',
      }),
    );
    expect(suppressed).toMatchObject({ state: 'blocked', code: 'SUPPRESSED' });
    await pool.query(
      `UPDATE onetime.contacts SET suppression_state = 'active' WHERE contact_key = $1`,
      [lead.contact_key],
    );
    await pool.query(
      `INSERT INTO onetime.highlevel_contact_preferences
         (account_key, product_key, contact_key, email_dnd)
       VALUES ($1, $2, $3, true)`,
      [config.accountKey, config.productKey, lead.contact_key],
    );
    const dnd = await inTransaction(pool, (client) =>
      enqueueHighLevelEvent(client, config, {
        eventName: 'adult.signup.submitted',
        contactKey: lead.contact_key,
        idempotencyKey: 'dnd-event-0001',
        actor: { kind: 'system', reference: 'test' },
        occurredAt: now,
        protectedPath: '/signup',
      }),
    );
    expect(dnd).toMatchObject({ state: 'blocked', code: 'DND_ACTIVE' });
    await pool.query('DELETE FROM onetime.highlevel_contact_preferences');

    const unconfirmed = await inTransaction(pool, (client) =>
      enqueueHighLevelEvent(client, config, {
        eventName: 'class.reminder.requested',
        contactKey: lead.contact_key,
        idempotencyKey: 'unconfirmed-event-0001',
        actor: { kind: 'system', reference: 'test' },
        occurredAt: now,
        protectedPath: '/app/parent',
        confirmed: false,
        entitled: true,
      }),
    );
    expect(unconfirmed).toMatchObject({ state: 'blocked', code: 'CLASS_NOT_CONFIRMED' });
    const unapproved = await inTransaction(pool, (client) =>
      enqueueHighLevelEvent(client, config, {
        eventName: 'recording.available',
        contactKey: lead.contact_key,
        idempotencyKey: 'unapproved-event-0001',
        actor: { kind: 'system', reference: 'test' },
        occurredAt: now,
        protectedPath: '/app/parent',
        approved: false,
        entitled: true,
      }),
    );
    expect(unapproved).toMatchObject({ state: 'blocked', code: 'CONTENT_NOT_APPROVED' });
    expect(await highLevelEventCount()).toBe(baseline);
  });

  it('allows only one of two concurrent dispatchers to claim the same intent', async () => {
    await captureLead({ pool, config, payload: leadPayload(), now });
    const adapter = new DeterministicFakeHighLevelAdapter();
    const [left, right] = await Promise.all([
      runHighLevelProjectionBatch({ pool, config, adapter, limit: 1, now }),
      runHighLevelProjectionBatch({ pool, config, adapter, limit: 1, now }),
    ]);
    expect(
      [left, right].reduce((sum, result) => sum + (result.enabled ? result.claimed : 0), 0),
    ).toBe(1);
    expect(
      [left, right].reduce((sum, result) => sum + (result.enabled ? result.delivered : 0), 0),
    ).toBe(1);
    expect(adapter.calls).toHaveLength(1);
  });
});

describe('HighLevel to One Time bot actions', () => {
  it('authenticates, scopes, deduplicates, and returns only protected adult-safe results', async () => {
    const lead = await captureLead({ pool, config, payload: leadPayload(), now });
    const unauthorized = await handleHighLevelAction({
      pool,
      config,
      keyId: 'test-highlevel-key',
      secret: 'wrong-secret-value-that-is-long-enough',
      payload: actionPayload('bot.member_login', lead.contact_key, 'login-action-0001'),
      now,
    });
    expect(unauthorized).toMatchObject({
      status: 401,
      body: { ok: false, code: 'HIGHLEVEL_ACTION_AUTH_FAILED' },
    });
    const wrongScopePayload = actionPayload(
      'bot.member_login',
      lead.contact_key,
      'wrong-scope-action-0001',
    );
    const wrongScope = await invokeAction({
      ...wrongScopePayload,
      scope: { ...wrongScopePayload.scope, product_key: 'wrong-product' },
    });
    expect(wrongScope).toMatchObject({
      status: 403,
      body: { ok: false, code: 'HIGHLEVEL_SCOPE_MISMATCH' },
    });

    const signup = await invokeAction({
      ...actionPayload('bot.complete_signup', lead.contact_key, 'signup-action-0001'),
      data: { details_complete: true },
    });
    expect(signup.body).toMatchObject({
      ok: true,
      protected_reference: { path: '/signup' },
      result: { signup_completed: true },
    });

    const login = await invokeAction(
      actionPayload('bot.member_login', lead.contact_key, 'login-action-0001'),
    );
    const replay = await invokeAction(
      actionPayload('bot.member_login', lead.contact_key, 'login-action-0001'),
    );
    expect(login.body).toMatchObject({
      ok: true,
      replayed: false,
      protected_reference: { path: '/login' },
      result: { account_active_claimed: false },
    });
    expect(replay.body).toMatchObject({ ok: true, replayed: true });

    const rateLimited = await handleHighLevelAction({
      pool,
      config: { ...config, highLevelActionRateLimitMax: 1 },
      keyId: 'test-highlevel-key',
      secret: actionSecret,
      payload: actionPayload('bot.member_login', lead.contact_key, 'login-action-0002'),
      now,
    });
    expect(rateLimited).toMatchObject({
      status: 429,
      body: { ok: false, code: 'HIGHLEVEL_ACTION_RATE_LIMITED' },
    });

    const classInfo = await invokeAction(
      actionPayload('bot.next_confirmed_class_info', lead.contact_key, 'class-action-0001'),
    );
    expect(classInfo.body).toMatchObject({
      ok: true,
      protected_reference: { path: '/app/parent' },
      result: { confirmed_update_available: false, join_available: false },
    });
    expect(JSON.stringify([login.body, classInfo.body])).not.toMatch(
      /student|password|token|zoom\.us|vimeo\.com/i,
    );
  });

  it('keeps password help non-enumerating and never returns or stores a token in HighLevel receipts', async () => {
    const lead = await captureLead({ pool, config, payload: leadPayload(), now });
    await createAccountUser({
      pool,
      config,
      email: contactEmail,
      password: 'ParentPass!234',
      displayName: 'Operator Parent',
      role: 'parent',
      mfaCapable: false,
    });
    const response = await invokeAction(
      actionPayload('bot.password_help', lead.contact_key, 'password-action-0001'),
    );
    expect(response.body).toMatchObject({
      ok: true,
      protected_reference: { path: '/forgot-password' },
      result: {
        request_accepted: true,
        account_existence_disclosed: false,
        token_returned_to_highlevel: false,
      },
    });
    const receipts = await pool.query(
      `SELECT response_json FROM onetime.highlevel_action_receipts WHERE action_name = 'bot.password_help'`,
    );
    expect(JSON.stringify(receipts.rows)).not.toMatch(
      /reset-password#|security_token|token_for_local_proof|operator\.parent/i,
    );
  });

  it('applies opt-out before later sends and authorizes no acknowledgement', async () => {
    const lead = await captureLead({ pool, config, payload: leadPayload(), now });
    const before = await highLevelEventCount();
    const optOut = await invokeAction({
      ...actionPayload('bot.apply_opt_out', lead.contact_key, 'optout-action-0001'),
      data: { channel: 'all' },
    });
    expect(optOut.body).toMatchObject({
      ok: true,
      protected_reference: null,
      result: { suppression_applied: true, acknowledgement_authorized: false },
    });
    const later = await inTransaction(pool, (client) =>
      enqueueHighLevelEvent(client, config, {
        eventName: 'parent.portal.activated',
        contactKey: lead.contact_key,
        idempotencyKey: 'post-optout-event-0001',
        actor: { kind: 'system', reference: 'test' },
        occurredAt: now,
        protectedPath: '/app/parent',
        data: { portal_status: 'active' },
      }),
    );
    expect(later).toMatchObject({ state: 'blocked', code: 'SUPPRESSED' });
    expect(await highLevelEventCount()).toBe(before);
  });
});

function leadPayload() {
  return {
    contact_name: 'Operator Parent',
    family_or_school: 'Operator Family',
    audience_type: 'family' as const,
    location: 'Jerusalem',
    timezone: 'Asia/Jerusalem',
    email: contactEmail,
    phone: '',
    reminder_preference: 'email' as const,
    reminder_consent: true,
    consent_context: {
      policy_version: 'communications-2026-07-15.1',
      purpose: 'optional_class_reminders' as const,
      source: 'public_signup' as const,
      channels: ['email' as const],
      captured_at: now.toISOString(),
      withdrawal_state: 'not_withdrawn' as const,
      suppression_state: 'active',
    },
    idempotency_key: 'operator-lead-highlevel-0001',
    attribution: { landing_path: '/signup' },
  };
}

function contentOutcome() {
  return {
    idempotency_key: 'highlevel-recording-outcome-0001',
    item_key: 'recording_highlevel_2026_07_22',
    title: 'Approved recording',
    item_type: 'video' as const,
    revision_number: 1,
    lifecycle_state: 'published' as const,
    entitlement_scope: 'all_active_learners' as const,
    transcript_metadata: { summary: 'Approved summary' },
    source_metadata: { source_label: 'approved_content' },
    review_sheet_metadata: {},
    playback_metadata: { provider: 'local_sink' },
    provider_event_ref: 'provider-event-private',
    source_ref: 'source-private',
  };
}

function actionPayload(
  actionName:
    | 'bot.complete_signup'
    | 'bot.next_confirmed_class_info'
    | 'bot.member_login'
    | 'bot.password_help'
    | 'bot.apply_opt_out',
  contactKey: string,
  idempotencyKey: string,
) {
  return {
    contract_version: HIGHLEVEL_CONTRACT_VERSION,
    action_name: actionName,
    request_id: `request-${idempotencyKey}`,
    idempotency_key: idempotencyKey,
    requested_at: now.toISOString(),
    actor: { kind: 'highlevel_bot' as const, bot_key: 'OT-A1' as const },
    scope: {
      account_key: config.accountKey,
      product_key: config.productKey,
      location_id: config.highLevelLocationId,
    },
    adult_contact: { contact_key: contactKey, adult_only: true as const },
    data: {},
  };
}

async function invokeAction(payload: unknown) {
  return handleHighLevelAction({
    pool,
    config,
    keyId: 'test-highlevel-key',
    secret: actionSecret,
    payload,
    now,
  });
}

async function seedHousehold() {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ('household_highlevel', $1, $2, 'HighLevel Family')`,
    [config.accountKey, config.productKey],
  );
}

async function grantHouseholdAccess() {
  await pool.query(
    `INSERT INTO onetime.billing_entitlement_projections
       (entitlement_key, account_key, product_key, principal_key, principal_type,
        status, policy_version, source, reason, effective_at, evaluated_at, grants_access)
     VALUES ('billing_entitlement_highlevel', $1, $2, 'household_highlevel', 'opaque',
             'active', '2026-07-22.1', 'test_fixture', 'active_test_entitlement', $3, $3, true)`,
    [config.accountKey, config.productKey, now],
  );
}

async function highLevelEvents() {
  const result = await pool.query(
    `SELECT payload FROM onetime.outbox_events WHERE channel = 'highlevel' ORDER BY event_type`,
  );
  return result.rows.map((row) => row.payload as { event_name: string });
}

async function highLevelEventCount() {
  const result = await pool.query(
    `SELECT count(*)::int AS count FROM onetime.outbox_events WHERE channel = 'highlevel'`,
  );
  return Number(result.rows[0]?.count ?? 0);
}
