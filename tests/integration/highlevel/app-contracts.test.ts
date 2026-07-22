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
  type HighLevelAdapter,
  type HighLevelProjection,
  type HighLevelProviderOperationContext,
  acceptParentActivation,
  admitContentOutcome,
  captureLead,
  createAccountUser,
  createParentActivation,
  enqueueHighLevelEvent,
  handleHighLevelAction,
  runHighLevelProjectionBatch,
  scheduleClassFulfillmentForLead,
  signHighLevelActionRequest,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;

const contactEmail = 'operator.parent@example.test';
const actionSecret = 'test-only-highlevel-action-secret-0001';
const now = new Date('2026-07-22T10:00:00.000Z');
let nonceSequence = 0;

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
  nonceSequence = 0;
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
    const dispatchConfig = await canaryConfigForAll('journey-canary-run-0001');
    const first = await runHighLevelProjectionBatch({
      pool,
      config: dispatchConfig,
      adapter,
      now: dispatchAt,
    });
    const replay = await runHighLevelProjectionBatch({
      pool,
      config: dispatchConfig,
      adapter,
      now: dispatchAt,
    });
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
    const dispatchConfig = await canaryConfigForAll('concurrent-canary-run-0001');
    const [left, right] = await Promise.all([
      runHighLevelProjectionBatch({ pool, config: dispatchConfig, adapter, limit: 1, now }),
      runHighLevelProjectionBatch({ pool, config: dispatchConfig, adapter, limit: 1, now }),
    ]);
    expect(
      [left, right].reduce((sum, result) => sum + (result.enabled ? result.claimed : 0), 0),
    ).toBe(1);
    expect(
      [left, right].reduce((sum, result) => sum + (result.enabled ? result.delivered : 0), 0),
    ).toBe(1);
    expect(adapter.calls).toHaveLength(1);
  });

  it('claims only exact provider-canary rows and leaves disabled or mock backlog held', async () => {
    const lead = await captureLead({ pool, config, payload: leadPayload(), now });
    await inTransaction(pool, (client) =>
      enqueueHighLevelEvent(
        client,
        { ...config, highLevelEventSyncMode: 'disabled' },
        {
          eventName: 'parent.portal.activated',
          contactKey: lead.contact_key,
          idempotencyKey: 'disabled-backlog-event-0001',
          actor: { kind: 'system', reference: 'test' },
          occurredAt: now,
          protectedPath: '/app/parent',
          data: { portal_status: 'active' },
        },
      ),
    );
    await inTransaction(pool, (client) =>
      enqueueHighLevelEvent(client, config, {
        eventName: 'parent.portal.invitation_requested',
        contactKey: lead.contact_key,
        idempotencyKey: 'mock-backlog-event-0001',
        actor: { kind: 'system', reference: 'test' },
        occurredAt: now,
        protectedPath: '/app/parent',
        data: { portal_status: 'invited' },
      }),
    );
    const providerQueued = await inTransaction(pool, (client) =>
      enqueueHighLevelEvent(
        client,
        { ...config, highLevelEventSyncMode: 'provider' },
        {
          eventName: 'recording.available',
          contactKey: lead.contact_key,
          idempotencyKey: 'provider-canary-event-0001',
          actor: { kind: 'system', reference: 'test' },
          occurredAt: now,
          protectedPath: '/app/parent',
          approved: true,
          entitled: true,
        },
      ),
    );
    if (providerQueued.state === 'blocked') throw new Error('Expected provider canary row.');
    const providerHeld = await inTransaction(pool, (client) =>
      enqueueHighLevelEvent(
        client,
        { ...config, highLevelEventSyncMode: 'provider' },
        {
          eventName: 'adult.signup.submitted',
          contactKey: lead.contact_key,
          idempotencyKey: 'provider-not-allowlisted-event-0001',
          actor: { kind: 'system', reference: 'test' },
          occurredAt: now,
          protectedPath: '/signup',
        },
      ),
    );
    if (providerHeld.state === 'blocked') throw new Error('Expected held provider row.');
    const adapter = new DeterministicFakeHighLevelAdapter();
    const providerConfig = {
      ...config,
      highLevelEventSyncMode: 'provider' as const,
      highLevelPrivateIntegrationsToken: 'test-provider-token',
      highLevelCanaryRunId: 'provider-canary-run-0001',
      highLevelCanaryDeliveryKeys: [providerQueued.deliveryKey],
      highLevelCanaryBudget: 1,
    };
    const result = await runHighLevelProjectionBatch({
      pool,
      config: providerConfig,
      adapter,
      now,
    });
    expect(result).toMatchObject({ enabled: true, claimed: 1, delivered: 1, adapterCalls: 1 });
    expect(adapter.calls).toHaveLength(1);
    const rows = await pool.query(
      `SELECT transport_mode, status, transport_authorization_state
         FROM onetime.outbox_events
        WHERE channel = 'highlevel'
        ORDER BY transport_mode, delivery_key`,
    );
    expect(rows.rows.filter((row) => row.transport_mode !== 'provider')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'pending', transport_authorization_state: 'held' }),
      ]),
    );
    expect(rows.rows.filter((row) => row.transport_mode === 'provider')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'delivered',
          transport_authorization_state: 'completed',
        }),
        expect.objectContaining({
          status: 'pending',
          transport_authorization_state: 'held',
        }),
      ]),
    );
  });

  it.each(['upsert', 'add_tags'] as const)(
    'quarantines a crash after %s and never repeats the uncertain provider operation',
    async (failurePoint) => {
      await captureLead({ pool, config, payload: leadPayload(), now });
      const dispatchConfig = await canaryConfigForAll(`crash-${failurePoint}-run-0001`);
      const adapter = new CrashAfterEffectAdapter(failurePoint);
      const first = await runHighLevelProjectionBatch({
        pool,
        config: dispatchConfig,
        adapter,
        limit: 1,
        now,
      });
      const replay = await runHighLevelProjectionBatch({
        pool,
        config: dispatchConfig,
        adapter,
        limit: 1,
        now: new Date(now.getTime() + config.highLevelRowLeaseMs + 1),
      });
      expect(first).toMatchObject({ enabled: true, claimed: 1, quarantined: 1 });
      expect(replay).toMatchObject({ enabled: true, claimed: 0, adapterCalls: 0 });
      expect(adapter.upsertEffects).toBe(1);
      expect(adapter.tagEffects).toBe(failurePoint === 'add_tags' ? 1 : 0);
      const row = await pool.query(
        `SELECT status, transport_authorization_state
           FROM onetime.outbox_events WHERE channel = 'highlevel'`,
      );
      expect(row.rows[0]).toMatchObject({
        status: 'dead_letter',
        transport_authorization_state: 'uncertain',
      });
    },
  );

  it('keeps a slow row fenced beyond the former shared 60-second lease', async () => {
    await captureLead({ pool, config, payload: leadPayload(), now });
    const dispatchConfig = await canaryConfigForAll('slow-row-canary-run-0001');
    const adapter = new SlowAdapter();
    const first = runHighLevelProjectionBatch({
      pool,
      config: dispatchConfig,
      adapter,
      limit: 1,
      now,
    });
    await adapter.started;
    const competing = await runHighLevelProjectionBatch({
      pool,
      config: dispatchConfig,
      adapter: new DeterministicFakeHighLevelAdapter(),
      limit: 1,
      now: new Date(now.getTime() + 61_000),
    });
    expect(competing).toMatchObject({ enabled: true, claimed: 0, adapterCalls: 0 });
    adapter.release();
    await expect(first).resolves.toMatchObject({ enabled: true, delivered: 1, quarantined: 0 });
  });
});

describe('HighLevel to One Time bot actions', () => {
  it('authenticates, scopes, deduplicates, and returns only protected adult-safe results', async () => {
    const lead = await captureLead({ pool, config, payload: leadPayload(), now });
    const unauthorizedRequest = signedActionRequest(
      actionPayload('bot.member_login', lead.contact_key, 'login-action-0001'),
      { secret: 'wrong-secret-value-that-is-long-enough' },
    );
    const unauthorized = await handleHighLevelAction({
      pool,
      config,
      ...unauthorizedRequest,
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
      ...signedActionRequest(
        actionPayload('bot.member_login', lead.contact_key, 'login-action-0002'),
      ),
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

  it('rejects body mutation, stale or future timestamps, and captured signed-header replay', async () => {
    const lead = await captureLead({ pool, config, payload: leadPayload(), now });
    const original = actionPayload(
      'bot.member_login',
      lead.contact_key,
      'signed-login-action-0001',
    );
    const signed = signedActionRequest(original);
    const mutated = await handleHighLevelAction({
      pool,
      config,
      headers: signed.headers,
      rawBody: Buffer.from(JSON.stringify({ ...original, request_id: 'mutated-request' })),
      now,
    });
    expect(mutated).toMatchObject({
      status: 401,
      body: { ok: false, code: 'HIGHLEVEL_ACTION_AUTH_FAILED' },
    });

    for (const timestamp of [
      Math.floor((now.getTime() - config.highLevelActionSignatureToleranceMs - 1_000) / 1000),
      Math.floor((now.getTime() + config.highLevelActionSignatureToleranceMs + 1_000) / 1000),
    ]) {
      const rejected = await handleHighLevelAction({
        pool,
        config,
        ...signedActionRequest(original, { timestamp: String(timestamp) }),
        now,
      });
      expect(rejected).toMatchObject({
        status: 401,
        body: { ok: false, code: 'HIGHLEVEL_ACTION_AUTH_FAILED' },
      });
    }

    const first = await handleHighLevelAction({ pool, config, ...signed, now });
    const capturedReplay = await handleHighLevelAction({ pool, config, ...signed, now });
    expect(first.body).toMatchObject({ ok: true, replayed: false });
    expect(capturedReplay).toMatchObject({
      status: 409,
      body: { ok: false, code: 'HIGHLEVEL_ACTION_REPLAYED' },
    });
  });

  it('checks signed account, product, and location scope before consuming the nonce', async () => {
    const lead = await captureLead({ pool, config, payload: leadPayload(), now });
    for (const [scopeKey, wrongValue] of [
      ['account_key', 'wrong-account'],
      ['product_key', 'wrong-product'],
      ['location_id', 'wrong-location'],
    ] as const) {
      const payload = actionPayload(
        'bot.member_login',
        lead.contact_key,
        `signed-wrong-${scopeKey}-action-0001`,
      );
      const request = signedActionRequest({
        ...payload,
        scope: { ...payload.scope, [scopeKey]: wrongValue },
      });
      const rejected = await handleHighLevelAction({ pool, config, ...request, now });
      expect(rejected).toMatchObject({
        status: 403,
        body: { ok: false, code: 'HIGHLEVEL_SCOPE_MISMATCH' },
      });
      const nonce = await pool.query(
        `SELECT count(*)::int AS count FROM onetime.highlevel_action_nonces
          WHERE nonce = $1`,
        [request.headers.nonce],
      );
      expect(Number(nonce.rows[0]?.count ?? 0)).toBe(0);
    }
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
    ...signedActionRequest(payload),
    now,
  });
}

function signedActionRequest(
  payload: unknown,
  overrides: { secret?: string; timestamp?: string; nonce?: string } = {},
) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const idempotencyKey = String((payload as { idempotency_key?: unknown }).idempotency_key ?? '');
  const timestamp = overrides.timestamp ?? String(Math.floor(now.getTime() / 1000));
  const nonce =
    overrides.nonce ?? `highlevel-action-nonce-${String(++nonceSequence).padStart(6, '0')}`;
  const keyId = 'test-highlevel-key';
  return {
    headers: {
      keyId,
      timestamp,
      nonce,
      idempotencyKey,
      signature: signHighLevelActionRequest({
        secret: overrides.secret ?? actionSecret,
        keyId,
        timestamp,
        nonce,
        idempotencyKey,
        rawBody,
      }),
    },
    rawBody,
  };
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

async function canaryConfigForAll(runId: string): Promise<AppConfig> {
  const rows = await pool.query(
    `SELECT delivery_key
       FROM onetime.outbox_events
      WHERE channel = 'highlevel' AND transport_mode = $1
      ORDER BY delivery_key`,
    [config.highLevelEventSyncMode],
  );
  const deliveryKeys = rows.rows.map((row) => String(row.delivery_key));
  if (deliveryKeys.length < 1) throw new Error('Expected HighLevel canary delivery rows.');
  return {
    ...config,
    highLevelCanaryRunId: runId,
    highLevelCanaryDeliveryKeys: deliveryKeys,
    highLevelCanaryBudget: deliveryKeys.length,
  };
}

class CrashAfterEffectAdapter implements HighLevelAdapter {
  upsertEffects = 0;
  tagEffects = 0;

  constructor(private readonly failurePoint: 'upsert' | 'add_tags') {}

  async upsertContact(_input: HighLevelProjection, _context: HighLevelProviderOperationContext) {
    this.upsertEffects += 1;
    if (this.failurePoint === 'upsert') throw new Error('SIMULATED_CRASH_AFTER_UPSERT');
    return { providerContactId: 'provider-contact-fixture' };
  }

  async addTags(
    _input: { locationId: string; providerContactId: string; tagsToAdd: string[] },
    _context: HighLevelProviderOperationContext,
  ) {
    this.tagEffects += 1;
    if (this.failurePoint === 'add_tags') throw new Error('SIMULATED_CRASH_AFTER_ADD_TAG');
  }
}

class SlowAdapter implements HighLevelAdapter {
  readonly started: Promise<void>;
  private signalStarted: () => void = () => {};
  private readonly gate: Promise<void>;
  private openGate: () => void = () => {};

  constructor() {
    this.started = new Promise<void>((resolve) => {
      this.signalStarted = resolve;
    });
    this.gate = new Promise<void>((resolve) => {
      this.openGate = resolve;
    });
  }

  async upsertContact(_input: HighLevelProjection, _context: HighLevelProviderOperationContext) {
    this.signalStarted();
    await this.gate;
    return { providerContactId: 'slow-provider-contact-fixture' };
  }

  async addTags(
    _input: { locationId: string; providerContactId: string; tagsToAdd: string[] },
    _context: HighLevelProviderOperationContext,
  ) {}

  release() {
    this.openGate();
  }
}
