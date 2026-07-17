import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  asBotKey,
  asCanonicalUserKey,
  asChatRef,
  asProviderUserRef,
  botCapabilities,
  type BotCapability,
  type CanonicalOneTimeActor,
  type NormalizedBotUpdate,
} from '../../../packages/contracts/src/telegram/types.ts';
import { createTelegramWebhookHandler } from '../../../apps/telegram-bot/src/ingress.ts';
import { TelegramCommandEngine } from '../../../packages/domain/src/telegram/commands.ts';
import {
  constantTimeStringEqual,
  DeterministicTestPayloadCodec,
} from '../../../packages/domain/src/telegram/crypto.ts';
import { TelegramIdentityResolver } from '../../../packages/domain/src/telegram/identity.ts';
import {
  FixtureOneTimeBotApplicationAdapter,
  MemoryAuditSink,
  MemoryConfirmationRepository,
  MemoryConsumerLeaseRepository,
  MemoryIdentityMappingRepository,
  MemoryInboxRepository,
  MockBotTransportAdapter,
} from '../../../packages/domain/src/telegram/memory.ts';
import {
  TelegramBotWorkerEngine,
  TelegramPollingConflictError,
  acquireConsumerLeaseOrThrow,
  runMockPollingAdapter,
  validateTelegramRuntimeTopology,
} from '../../../packages/domain/src/telegram/worker.ts';
import { telegramTransportReadiness } from '../../../packages/domain/src/telegram/transport.ts';

const botKey = asBotKey('one_time_internal_ops');
const providerUserRef = asProviderUserRef('telegram_user_fixture');
const chatRef = asChatRef('telegram_chat_fixture');
const actor = actorFixture([...botCapabilities]);

describe('OT-51P ingress boundary', () => {
  it('rejects wrong method, content type, secret, oversized and deep JSON without enqueueing', async () => {
    const inbox = new MemoryInboxRepository();
    const handler = createTelegramWebhookHandler({
      botKey,
      environment: 'local',
      secretToken: 'secret-token',
      contentType: 'application/json',
      maxBytes: 128,
      maxDepth: 4,
      maxStringLength: 80,
      maxArrayLength: 4,
      inbox,
      codec: new DeterministicTestPayloadCodec(),
    });

    expect((await callHandler(handler, { method: 'GET', secret: 'secret-token' })).status).toBe(
      405,
    );
    expect(
      (await callHandler(handler, { contentType: 'text/plain', secret: 'secret-token' })).status,
    ).toBe(415);
    expect((await callHandler(handler, { secret: 'wrong' })).status).toBe(401);
    expect(
      (
        await callHandler(handler, {
          secret: 'secret-token',
          body: JSON.stringify({ update_id: 1, message: { text: 'x'.repeat(200) } }),
        })
      ).status,
    ).toBe(413);
    expect(
      (
        await callHandler(handler, {
          secret: 'secret-token',
          body: JSON.stringify({ update_id: 1, a: { b: { c: { d: { e: true } } } } }),
        })
      ).status,
    ).toBe(400);
  });

  it('normalizes only the allowed Telegram subset, hashes IDs, encrypts payload, and dedupes', async () => {
    const inbox = new MemoryInboxRepository();
    const handler = createTelegramWebhookHandler({
      botKey,
      environment: 'local',
      secretToken: 'secret-token',
      contentType: 'application/json',
      maxBytes: 2048,
      maxDepth: 8,
      maxStringLength: 200,
      maxArrayLength: 4,
      inbox,
      codec: new DeterministicTestPayloadCodec(),
    });
    const body = JSON.stringify({
      update_id: 51,
      message: {
        message_id: 7,
        text: '/scope',
        from: { id: 12345, username: 'do-not-store' },
        chat: { id: 67890, type: 'private' },
      },
    });

    const first = await callHandler(handler, { secret: 'secret-token', body });
    const duplicate = await callHandler(handler, { secret: 'secret-token', body });

    expect(first).toMatchObject({ status: 200, json: { ok: true, duplicate: false } });
    expect(duplicate).toMatchObject({ status: 200, json: { ok: true, duplicate: true } });
    const item = await inbox.claimNext(new Date('2026-07-14T10:00:00Z'), 'test', 1000);
    expect(JSON.stringify(item)).not.toContain('12345');
    expect(JSON.stringify(item)).not.toContain('67890');
    expect(JSON.stringify(item)).not.toContain('do-not-store');
  });

  it('keeps the secret comparison contract boolean and length-safe', () => {
    expect(constantTimeStringEqual('same-secret', 'same-secret')).toBe(true);
    expect(constantTimeStringEqual('same-secret', 'other-secret')).toBe(false);
    expect(constantTimeStringEqual('short', 'a-much-longer-secret')).toBe(false);
  });
});

describe('OT-51P identity and commands', () => {
  it('default-denies group, forwarded, unmapped, unsupported roles, and absent capabilities', async () => {
    const context = await buildContext(actorFixture(['gateway.scope.read']));
    await context.mappings.upsertProtectedMapping(mappingFixture());

    const group = await context.engine.handle(
      updateFixture({ text: '/scope', chatContext: 'group' }),
    );
    expect(group[0]?.text).toContain('authorized owner/admin private chats');

    const forwarded = await context.engine.handle(
      updateFixture({ text: '/scope', isForwarded: true }),
    );
    expect(forwarded[0]?.text).toContain('authorized owner/admin private chats');

    const unmappedContext = await buildContext(actorFixture(['gateway.scope.read']));
    const unmapped = await unmappedContext.engine.handle(updateFixture({ text: '/scope' }));
    expect(unmapped[0]?.text).toContain('authorized owner/admin private chats');

    const viewerContext = await buildContext(actorFixture(['gateway.scope.read'], 'viewer'));
    await viewerContext.mappings.upsertProtectedMapping(mappingFixture());
    const viewer = await viewerContext.engine.handle(updateFixture({ text: '/scope' }));
    expect(viewer[0]?.text).toContain('authorized owner/admin private chats');

    const absent = await context.engine.handle(updateFixture({ text: '/classes' }));
    expect(absent[0]?.text).toContain('authorized owner/admin private chats');
  });

  it('runs supported reads, owner-only audit, question reads, and refuses ambiguous free text', async () => {
    const context = await buildContext(
      actorFixture([
        'gateway.scope.read',
        'crm.contact.read_redacted',
        'telegram.audit.read_recent',
        'class.question.list',
      ]),
    );
    await context.mappings.upsertProtectedMapping(mappingFixture());
    const scope = await context.engine.handle(updateFixture({ text: '/scope' }));
    const contact = await context.engine.handle(
      updateFixture({ text: '/contact fictional-parent' }),
    );
    const questions = await context.engine.handle(updateFixture({ text: '/questions' }));
    const ambiguous = await context.engine.handle(
      updateFixture({ text: 'open or close something' }),
    );

    expect(scope[0]?.text).toContain('one_time_mishnah_class');
    expect(contact[0]?.text).toContain('Redacted contact');
    expect(questions[0]?.text).toContain('Questions:');
    expect(ambiguous[0]?.text).toContain('more specific');
    expect(context.audit.events.some((event) => event.outcome === 'completed')).toBe(true);

    const adminContext = await buildContext(actorFixture(['telegram.audit.read_recent'], 'admin'));
    await adminContext.mappings.upsertProtectedMapping(mappingFixture());
    const auditDenied = await adminContext.engine.handle(updateFixture({ text: '/gateway-audit' }));
    expect(auditDenied[0]?.text).toContain('authorized owner/admin private chats');
  });

  it('covers W12-05 operator reads, approved retry preview, and webhook/token refusals', async () => {
    const context = await buildContext(actor);
    await context.mappings.upsertProtectedMapping(mappingFixture());

    const today = await context.engine.handle(updateFixture({ text: "today's class" }));
    const contact = await context.engine.handle(
      updateFixture({ updateId: 'w12-read-2', text: 'find contact contact_public_fixture' }),
    );
    const link = await context.engine.handle(
      updateFixture({ updateId: 'w12-read-3', text: '/link contact contact_public_fixture' }),
    );
    const delivery = await context.engine.handle(
      updateFixture({ updateId: 'w12-read-4', text: '/delivery' }),
    );
    const vimeo = await context.engine.handle(
      updateFixture({ updateId: 'w12-read-5', text: 'vimeo status' }),
    );
    const forbidden = await context.engine.handle(
      updateFixture({ updateId: 'w12-read-6', text: 'register production webhook' }),
    );

    expect(today[0]?.text).toContain('Upcoming classes');
    expect(contact[0]?.text).toContain('Redacted contact contact_public_fixture');
    expect(link[0]?.text).toContain('/app/contact/contact_public_fixture');
    expect(delivery[0]?.text).toContain('Delivery status');
    expect(vimeo[0]?.text).toContain('Content pipeline');
    expect(forbidden[0]?.text).toContain('not available');

    const retryPreview = await context.engine.handle(
      updateFixture({ updateId: 'w12-write-1', text: '/delivery-retry delivery_fixture_1' }),
    );
    expect(retryPreview[0]?.text).toContain('Preview delivery.retry');
    const retryConfirmed = await context.engine.handle(
      updateFixture({
        updateId: 'w12-write-2',
        kind: 'callback_query',
        callbackData: requireString(retryPreview[0]?.buttons?.[0]?.callbackData),
      }),
    );
    expect(retryConfirmed[0]?.text).toContain('Completed delivery.retry');
  });

  it('previews, confirms, cancels, expires, and replays every write', async () => {
    const context = await buildContext(actor);
    await context.mappings.upsertProtectedMapping(mappingFixture());

    const directPreview = await context.engine.handle(
      updateFixture({ updateId: '99', text: '/task-create Quick follow up' }),
    );
    expect(directPreview[0]?.text).toContain('Preview task.create');
    expect(directPreview[0]?.text).toContain('Payload hash:');
    const directConfirmed = await context.engine.handle(
      updateFixture({
        updateId: '99-confirm',
        kind: 'callback_query',
        callbackData: requireString(directPreview[0]?.buttons?.[0]?.callbackData),
      }),
    );
    expect(directConfirmed[0]?.text).toContain('Completed task.create');

    const preview = await context.engine.handle(
      updateFixture({ updateId: '100', text: 'create task Call parent' }),
    );
    const confirmData = preview[0]?.buttons?.[0]?.callbackData;
    const cancelData = preview[0]?.buttons?.[1]?.callbackData;
    expect(preview[0]?.text).toContain('Preview task.create');
    expect(confirmData).toMatch(/^confirm:v1:/);
    expect(cancelData).toMatch(/^cancel:v1:/);

    const confirmed = await context.engine.handle(
      updateFixture({
        updateId: '101',
        kind: 'callback_query',
        callbackData: requireString(confirmData),
      }),
    );
    const duplicate = await context.engine.handle(
      updateFixture({
        updateId: '102',
        kind: 'callback_query',
        callbackData: requireString(confirmData),
      }),
    );
    expect(confirmed[0]?.text).toContain('Completed task.create');
    expect(duplicate[0]?.text).toContain('Completed task.create');
    expect(context.adapter.writes.size).toBe(2);

    const cancelPreview = await context.engine.handle(
      updateFixture({ updateId: '103', text: 'mark task task_1 as done' }),
    );
    const cancelled = await context.engine.handle(
      updateFixture({
        updateId: '104',
        kind: 'callback_query',
        callbackData: requireString(cancelPreview[0]?.buttons?.[1]?.callbackData),
      }),
    );
    expect(cancelled[0]?.text).toContain('Cancelled');

    const expiredPreview = await context.engine.handle(
      updateFixture({ updateId: '105', text: 'create task Expire me' }),
      new Date('2026-07-14T10:00:00Z'),
    );
    const expired = await context.engine.handle(
      updateFixture({
        updateId: '106',
        kind: 'callback_query',
        callbackData: requireString(expiredPreview[0]?.buttons?.[0]?.callbackData),
      }),
      new Date('2026-07-14T10:10:00Z'),
    );
    expect(expired[0]?.text).toContain('expired');
  });

  it('denies confirmation replay when security version changes before confirm', async () => {
    const mutableActor = actorFixture(['task.create']);
    const context = await buildContext(mutableActor);
    await context.mappings.upsertProtectedMapping(mappingFixture());
    const preview = await context.engine.handle(
      updateFixture({ updateId: '200', text: 'create task Check security' }),
    );
    mutableActor.securityVersion = 2;
    const denied = await context.engine.handle(
      updateFixture({
        updateId: '201',
        kind: 'callback_query',
        callbackData: requireString(preview[0]?.buttons?.[0]?.callbackData),
      }),
    );
    expect(denied[0]?.text).toContain('Confirmation denied');
  });
});

describe('OT-51P worker and topology', () => {
  it('claims safely, reclaims expired leases, retries, and dead-letters without long-running processes', async () => {
    const context = await buildContext(actor);
    await context.mappings.upsertProtectedMapping(mappingFixture());
    const payloadRef = await context.codec.encrypt(updateFixture({ text: '/scope' }), {
      botKey,
      environment: 'local',
      classification: 'normalized_update',
    });
    const enqueued = await context.inbox.enqueue(updateFixture({ text: '/scope' }), payloadRef);
    const worker = new TelegramBotWorkerEngine(
      context.inbox,
      context.codec,
      context.engine,
      context.transport,
      context.audit,
      {
        ownerId: 'worker-1',
        leaseMs: 50,
        handlerDeadlineMs: 1000,
        maxAttempts: 2,
        baseBackoffMs: 1,
        jitter: () => 0,
      },
    );
    const first = await worker.runOnce(new Date('2026-07-14T10:00:00Z'));
    expect(first).toMatchObject({ claimed: true, disposition: 'completed' });
    expect(context.inbox.state(enqueued.inboxKey)?.status).toBe('completed');
    expect(context.transport.replies[0]?.text).toContain('Scope: account');

    const brokenCodec = {
      encrypt: context.codec.encrypt.bind(context.codec),
      decrypt: async () => {
        throw new Error('fixture handler failure');
      },
    };
    const retryInbox = new MemoryInboxRepository();
    await retryInbox.enqueue(updateFixture({ updateId: '300', text: '/scope' }), payloadRef);
    const retryWorker = new TelegramBotWorkerEngine(
      retryInbox,
      brokenCodec,
      context.engine,
      context.transport,
      context.audit,
      {
        ownerId: 'worker-2',
        leaseMs: 50,
        handlerDeadlineMs: 1000,
        maxAttempts: 2,
        baseBackoffMs: 1,
        jitter: () => 0,
      },
    );
    expect(await retryWorker.runOnce(new Date('2026-07-14T10:00:00Z'))).toMatchObject({
      disposition: 'retry',
    });
    expect(await retryWorker.runOnce(new Date('2026-07-14T10:00:01Z'))).toMatchObject({
      disposition: 'dead_letter',
    });
  });

  it('enforces one consumer owner, webhook/poll exclusion, graceful stop, and mocked 409 shutdown', async () => {
    const leases = new MemoryConsumerLeaseRepository();
    const input = {
      botKey,
      environment: 'local' as const,
      tokenFingerprint: 'token-fingerprint',
      ownerId: 'owner-a',
      leaseMs: 1000,
      now: new Date('2026-07-14T10:00:00Z'),
    };
    await expect(acquireConsumerLeaseOrThrow(leases, input)).resolves.toBe(1);
    await expect(
      acquireConsumerLeaseOrThrow(leases, { ...input, ownerId: 'owner-b' }),
    ).rejects.toThrow(/already owned/);
    expect(() =>
      validateTelegramRuntimeTopology({
        webhookEnabled: true,
        localPollingEnabled: true,
        productionPollingEnabled: false,
      }),
    ).toThrow(/mutually exclusive/);
    expect(() =>
      validateTelegramRuntimeTopology({
        webhookEnabled: false,
        localPollingEnabled: false,
        productionPollingEnabled: true,
      }),
    ).toThrow(/not implemented/);

    const shutdowns: string[] = [];
    const stopped = await runMockPollingAdapter({
      poll: async () => {
        throw new TelegramPollingConflictError();
      },
      onUpdate: async () => undefined,
      onShutdown: async (reason) => {
        shutdowns.push(reason);
      },
    });
    expect(stopped).toMatchObject({ stopped: true, reason: 'telegram_409_conflict' });
    expect(shutdowns).toEqual(['telegram_409_conflict']);
  });

  it('reports Telegram readiness only after protected config, mapping, lease, and canary are present', () => {
    expect(
      telegramTransportReadiness({
        enabled: true,
        botKey: 'one_time_internal_ops',
        environment: 'staging',
        tokenConfigured: true,
        ownerMappingConfigured: true,
        singleConsumerGate: true,
        canaryChatConfigured: true,
      }),
    ).toMatchObject({ readiness_state: 'configured' });
    expect(
      telegramTransportReadiness({
        enabled: true,
        botKey: 'one_time_internal_ops',
        environment: 'staging',
        tokenConfigured: false,
        ownerMappingConfigured: true,
        singleConsumerGate: true,
        canaryChatConfigured: true,
      }),
    ).toMatchObject({ readiness_state: 'not_configured' });
  });
});

async function buildContext(testActor: CanonicalOneTimeActor) {
  const mappings = new MemoryIdentityMappingRepository();
  const confirmations = new MemoryConfirmationRepository();
  const inbox = new MemoryInboxRepository();
  const audit = new MemoryAuditSink();
  const codec = new DeterministicTestPayloadCodec();
  const transport = new MockBotTransportAdapter();
  const adapter = new FixtureOneTimeBotApplicationAdapter(testActor);
  const resolver = new TelegramIdentityResolver(mappings, adapter);
  const engine = new TelegramCommandEngine(resolver, adapter, confirmations, codec, audit);
  return { mappings, confirmations, inbox, audit, codec, transport, adapter, engine };
}

function actorFixture(
  capabilities: BotCapability[],
  role: CanonicalOneTimeActor['role'] = 'owner',
) {
  return {
    userKey: asCanonicalUserKey('user_one_time_owner'),
    displayLabel: 'One Time Owner',
    accountKey: 'one_time',
    productKey: 'one_time_mishnah_class',
    membershipKey: 'membership_owner',
    membershipStatus: 'active',
    userStatus: 'active',
    role,
    securityVersion: 1,
    capabilities,
  } satisfies CanonicalOneTimeActor;
}

function mappingFixture() {
  return {
    mappingKey: 'mapping_fixture',
    botKey,
    environment: 'local' as const,
    providerUserRef,
    chatRef,
    canonicalUserKey: actor.userKey,
    accountKey: 'one_time',
    productKey: 'one_time_mishnah_class',
    membershipKey: 'membership_owner',
    mappingVersion: 1,
    securityVersion: 1,
    status: 'active' as const,
  };
}

function updateFixture(overrides: Partial<NormalizedBotUpdate>): NormalizedBotUpdate {
  const update: NormalizedBotUpdate = {
    updateId: overrides.updateId ?? '1',
    kind: overrides.kind ?? 'message',
    botKey,
    environment: 'local',
    providerUserRef,
    chatRef,
    chatContext: overrides.chatContext ?? 'private',
    isForwarded: overrides.isForwarded ?? false,
    isEdited: overrides.isEdited ?? false,
    isAnonymousAdmin: overrides.isAnonymousAdmin ?? false,
    receivedAt: '2026-07-14T10:00:00Z',
  };
  if (overrides.text !== undefined) update.text = overrides.text;
  if (overrides.callbackData !== undefined) update.callbackData = overrides.callbackData;
  return update;
}

function requireString(value: string | undefined): string {
  if (!value) throw new Error('expected callback data');
  return value;
}

async function callHandler(
  handler: ReturnType<typeof createTelegramWebhookHandler>,
  input: {
    method?: string;
    secret?: string;
    contentType?: string;
    body?: string;
  },
) {
  const body = input.body ?? JSON.stringify({ update_id: 1, message: { text: 'status' } });
  const request = Readable.from([body]) as IncomingMessage;
  request.method = input.method ?? 'POST';
  request.headers = {
    'content-type': input.contentType ?? 'application/json',
    'x-telegram-bot-api-secret-token': input.secret ?? '',
  };
  let responseBody = '';
  const response = {
    statusCode: 200,
    setHeader: () => undefined,
    end: (chunk: string) => {
      responseBody = chunk;
    },
  } as unknown as ServerResponse;
  await handler(request, response);
  return {
    status: response.statusCode,
    json: JSON.parse(responseBody) as Record<string, unknown>,
  };
}
